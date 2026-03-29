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

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const socketMap = new Map<string, { roomCode: string; playerId: string }>();

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

      // Auto-start solo game
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

      // Start first round immediately
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

      // Start first round
      const updatedRoom = startNextRound(roomCode);
      if (!updatedRoom) return;

      // Send game-started to all players
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

      // Notify all players that someone answered
      io.to(roomCode).emit("server:answer-received", {
        playerId: mapping.playerId,
      });

      // If all answered, reveal immediately
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
        io.to(roomCode).emit("server:game-over", {
          players: updatedRoom.players,
        });
      } else {
        emitRoundStart(io, roomCode);
      }
    });

    socket.on("client:request-sync", ({ roomCode }) => {
      const mapping = socketMap.get(socket.id);
      if (!mapping) return;

      const room = getRoom(roomCode);
      if (!room) return;

      socket.emit("server:state-sync", {
        gameState: getClientGameState(room, mapping.playerId),
      });

      // If game is in playing state, also re-send round info
      if (room.status === "playing" && room.currentCard) {
        socket.emit("server:round-start", {
          slogan: room.currentCard.slogan,
          difficulty: room.currentCard.difficulty,
          roundNumber: room.roundNumber,
          timeoutSeconds: room.settings.roundTimeSeconds,
        });
      }
    });

    socket.on("client:leave-room", () => {
      handleDisconnect(socket, io);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      handleDisconnect(socket, io);
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

  // Start countdown timer
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

function handleDisconnect(
  socket: TypedSocket,
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
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
