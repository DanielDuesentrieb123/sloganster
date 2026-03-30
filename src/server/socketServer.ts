import { Server, Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "../types/socket";
import {
  createRoom,
  joinRoom,
  startGame,
  startNextRound,
  submitAnswer,
  revealRound,
  removePlayer,
  getClientGameState,
} from "./gameManager";
import { getRoom } from "./roomStore";
import { addHighscore, getHighscores } from "./highscoreStore";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const socketMap = new Map<string, { roomCode: string; playerId: string }>();
// Grace period timers for disconnected players
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DISCONNECT_GRACE_MS = 30_000;

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  io.on("connection", (socket: TypedSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on("client:create-room", ({ playerName }) => {
      const { room, player } = createRoom(playerName, false);
      socket.join(room.roomCode);
      socketMap.set(socket.id, {
        roomCode: room.roomCode,
        playerId: player.id,
      });

      socket.emit("server:room-created", {
        roomCode: room.roomCode,
        player,
      });
      socket.emit("server:state-sync", {
        gameState: getClientGameState(room, player.id),
      });
    });

    socket.on("client:create-solo", ({ playerName }) => {
      const { room, player } = createRoom(playerName, true);
      socket.join(room.roomCode);
      socketMap.set(socket.id, {
        roomCode: room.roomCode,
        playerId: player.id,
      });

      const started = startGame(room.roomCode, player.id);
      if (!started) {
        socket.emit("server:error", {
          message: "Solo-Spiel konnte nicht gestartet werden",
          code: "START_FAILED",
        });
        return;
      }

      socket.emit("server:room-created", {
        roomCode: room.roomCode,
        player,
      });

      const updatedRoom = startNextRound(room.roomCode);
      if (updatedRoom && updatedRoom.currentCard) {
        socket.emit("server:game-started", {
          gameState: getClientGameState(updatedRoom, player.id),
        });
        emitRoundStart(io, updatedRoom.roomCode);
      }
    });

    socket.on("client:join-room", ({ roomCode, playerName }) => {
      const result = joinRoom(roomCode.toUpperCase(), playerName);
      if (!result) {
        socket.emit("server:error", {
          message: "Raum nicht gefunden oder Spiel bereits gestartet",
          code: "ROOM_NOT_FOUND",
        });
        return;
      }

      const { room, player } = result;
      socket.join(room.roomCode);
      socketMap.set(socket.id, {
        roomCode: room.roomCode,
        playerId: player.id,
      });

      socket.emit("server:state-sync", {
        gameState: getClientGameState(room, player.id),
      });
      socket.to(room.roomCode).emit("server:player-joined", {
        player,
        players: room.players,
      });
    });

    // Rejoin after disconnect — reconnects an existing player
    socket.on("client:rejoin-room", ({ roomCode, playerId }) => {
      const room = getRoom(roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return;

      // Cancel any pending disconnect timer
      const timerKey = `${roomCode}:${playerId}`;
      const timer = disconnectTimers.get(timerKey);
      if (timer) {
        clearTimeout(timer);
        disconnectTimers.delete(timerKey);
        console.log(`[Socket] Cancelled disconnect timer for ${player.name}`);
      }

      // Mark player as connected again
      player.connected = true;

      // Re-map socket and join room
      socket.join(roomCode);
      socketMap.set(socket.id, { roomCode, playerId });

      console.log(`[Socket] ${player.name} rejoined room ${roomCode}`);

      // Send full state
      socket.emit("server:state-sync", {
        gameState: getClientGameState(room, playerId),
      });

      // Re-send round info if game is active
      if (room.status === "playing" && room.currentCard) {
        socket.emit("server:round-start", {
          slogan: room.currentCard.slogan,
          difficulty: room.currentCard.difficulty,
          roundNumber: room.roundNumber,
          timeoutSeconds: room.settings.roundTimeSeconds,
        });
      }
    });

    socket.on("client:start-game", ({ roomCode }) => {
      const mapping = socketMap.get(socket.id);
      if (!mapping) return;

      const room = startGame(roomCode, mapping.playerId);
      if (!room) {
        socket.emit("server:error", {
          message: "Spiel konnte nicht gestartet werden",
          code: "START_FAILED",
        });
        return;
      }

      const updatedRoom = startNextRound(roomCode);
      if (!updatedRoom) return;

      for (const player of updatedRoom.players) {
        const sockets = getSocketsForPlayer(player.id);
        for (const sid of sockets) {
          io.to(sid).emit("server:game-started", {
            gameState: getClientGameState(updatedRoom, player.id),
          });
        }
      }

      emitRoundStart(io, roomCode);
    });

    socket.on("client:submit-answer", ({ roomCode, brand, year }) => {
      const mapping = socketMap.get(socket.id);
      if (!mapping) return;

      const result = submitAnswer(roomCode, mapping.playerId, brand, year);
      if (!result) {
        socket.emit("server:error", {
          message: "Antwort konnte nicht eingereicht werden",
          code: "SUBMIT_FAILED",
        });
        return;
      }

      io.to(roomCode).emit("server:answer-received", {
        playerId: mapping.playerId,
      });

      if (result.allAnswered) {
        doReveal(io, roomCode);
      }
    });

    socket.on("client:next-round", ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (!room || room.status !== "revealing") return;

      const updatedRoom = startNextRound(roomCode);
      if (!updatedRoom) return;

      if (updatedRoom.status === "finished") {
        // Save highscores for all players
        const maxScore = updatedRoom.settings.maxRounds * 4;
        for (const player of updatedRoom.players) {
          addHighscore({
            playerName: player.name,
            score: player.score,
            maxScore,
            rounds: updatedRoom.settings.maxRounds,
            isSolo: updatedRoom.isSinglePlayer,
            playerCount: updatedRoom.players.length,
            date: new Date().toISOString(),
          });
        }

        io.to(roomCode).emit("server:game-over", {
          players: updatedRoom.players,
        });
      } else {
        emitRoundStart(io, roomCode);
      }
    });

    socket.on("client:request-sync", ({ roomCode, playerId }) => {
      let mapping = socketMap.get(socket.id);

      // If no mapping but playerId provided, try to rejoin
      if (!mapping && playerId) {
        const room = getRoom(roomCode);
        if (room) {
          const player = room.players.find((p) => p.id === playerId);
          if (player) {
            // Cancel disconnect timer
            const timerKey = `${roomCode}:${playerId}`;
            const timer = disconnectTimers.get(timerKey);
            if (timer) {
              clearTimeout(timer);
              disconnectTimers.delete(timerKey);
            }

            player.connected = true;
            socket.join(roomCode);
            socketMap.set(socket.id, { roomCode, playerId });
            mapping = { roomCode, playerId };
            console.log(`[Socket] Auto-rejoined ${player.name} via request-sync`);
          }
        }
      }

      if (!mapping) return;

      const room = getRoom(roomCode);
      if (!room) return;

      socket.emit("server:state-sync", {
        gameState: getClientGameState(room, mapping.playerId),
      });

      // Re-send round info if game is active
      if (room.status === "playing" && room.currentCard) {
        socket.emit("server:round-start", {
          slogan: room.currentCard.slogan,
          difficulty: room.currentCard.difficulty,
          roundNumber: room.roundNumber,
          timeoutSeconds: room.settings.roundTimeSeconds,
        });
      }
    });

    socket.on("client:get-highscores", () => {
      socket.emit("server:highscores", { highscores: getHighscores(10) });
    });

    socket.on("client:leave-room", () => {
      // Explicit leave — remove immediately, no grace period
      const mapping = socketMap.get(socket.id);
      if (!mapping) return;

      const { roomCode, playerId } = mapping;
      const room = removePlayer(roomCode, playerId);

      if (room) {
        io.to(roomCode).emit("server:player-left", {
          playerId,
          players: room.players,
        });
      }

      socket.leave(roomCode);
      socketMap.delete(socket.id);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      const mapping = socketMap.get(socket.id);
      if (!mapping) return;

      const { roomCode, playerId } = mapping;
      const room = getRoom(roomCode);
      socketMap.delete(socket.id);

      if (!room) return;

      // During a game: use grace period (player might reconnect)
      if (room.status !== "waiting") {
        const player = room.players.find((p) => p.id === playerId);
        if (player) {
          player.connected = false;
          console.log(`[Socket] ${player.name} disconnected, grace period ${DISCONNECT_GRACE_MS / 1000}s`);
        }

        const timerKey = `${roomCode}:${playerId}`;
        // Clear any existing timer
        const existing = disconnectTimers.get(timerKey);
        if (existing) clearTimeout(existing);

        disconnectTimers.set(
          timerKey,
          setTimeout(() => {
            disconnectTimers.delete(timerKey);
            console.log(`[Socket] Grace period expired, removing player from ${roomCode}`);
            const currentRoom = removePlayer(roomCode, playerId);
            if (currentRoom) {
              io.to(roomCode).emit("server:player-left", {
                playerId,
                players: currentRoom.players,
              });
            }
          }, DISCONNECT_GRACE_MS)
        );
      } else {
        // In lobby: remove immediately
        const updatedRoom = removePlayer(roomCode, playerId);
        if (updatedRoom) {
          io.to(roomCode).emit("server:player-left", {
            playerId,
            players: updatedRoom.players,
          });
        }
      }
    });
  });
}

function emitRoundStart(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string
) {
  const room = getRoom(roomCode);
  if (!room || !room.currentCard) return;

  io.to(roomCode).emit("server:round-start", {
    slogan: room.currentCard.slogan,
    difficulty: room.currentCard.difficulty,
    roundNumber: room.roundNumber,
    timeoutSeconds: room.settings.roundTimeSeconds,
  });

  if (room.roundTimer) clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => {
    doReveal(io, roomCode);
  }, room.settings.roundTimeSeconds * 1000);
}

function doReveal(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string
) {
  const result = revealRound(roomCode);
  if (!result) return;

  const { results, card, room } = result;

  io.to(roomCode).emit("server:round-reveal", {
    card,
    playerResults: results,
    players: room.players,
  });
}

function getSocketsForPlayer(playerId: string): string[] {
  const sockets: string[] = [];
  for (const [socketId, mapping] of socketMap.entries()) {
    if (mapping.playerId === playerId) {
      sockets.push(socketId);
    }
  }
  return sockets;
}
