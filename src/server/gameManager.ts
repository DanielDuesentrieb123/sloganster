import { v4 as uuidv4 } from "uuid";
import {
  GameRoom,
  Player,
  PlayerAnswer,
  PlayerResult,
  DEFAULT_SETTINGS,
  ClientGameState,
} from "../types/game";
import { Slogan } from "../types/slogan";
import {
  shuffleDeck,
  redactSlogan,
  isBrandCorrect,
  isYearCorrect,
  calculatePoints,
} from "../lib/gameLogic";
import { generateRoomCode } from "../lib/roomCodes";
import { getRoom, setRoom, roomExists, markRoomActivity } from "./roomStore";
import slogansData from "../data/slogans.json";

const slogans: Slogan[] = slogansData as Slogan[];

export function createRoom(
  playerName: string,
  isSinglePlayer: boolean = false
): { room: GameRoom; player: Player } {
  let roomCode: string;
  do {
    roomCode = generateRoomCode();
  } while (roomExists(roomCode));

  const player: Player = {
    id: uuidv4(),
    name: playerName,
    isHost: true,
    score: 0,
    connected: true,
  };

  const room: GameRoom = {
    roomCode,
    players: [player],
    status: "waiting",
    settings: { ...DEFAULT_SETTINGS },
    deck: [],
    currentCard: null,
    roundNumber: 0,
    answers: new Map(),
    roundTimer: null,
    isSinglePlayer,
  };

  setRoom(roomCode, room);
  markRoomActivity(roomCode);

  return { room, player };
}

export function joinRoom(
  roomCode: string,
  playerName: string
): { room: GameRoom; player: Player } | null {
  const room = getRoom(roomCode);
  if (!room || room.status !== "waiting") return null;

  const player: Player = {
    id: uuidv4(),
    name: playerName,
    isHost: false,
    score: 0,
    connected: true,
  };

  room.players.push(player);
  markRoomActivity(roomCode);

  return { room, player };
}

export function startGame(
  roomCode: string,
  playerId: string
): GameRoom | null {
  const room = getRoom(roomCode);
  if (!room || room.status !== "waiting") return null;

  const host = room.players.find((p) => p.id === playerId);
  if (!host?.isHost) return null;

  // Allow singleplayer (1 player) or multiplayer (2+)
  if (!room.isSinglePlayer && room.players.length < 2) return null;

  room.deck = shuffleDeck(slogans);
  room.status = "playing";
  room.roundNumber = 0;

  markRoomActivity(roomCode);
  return room;
}

export function startNextRound(roomCode: string): GameRoom | null {
  const room = getRoom(roomCode);
  if (!room || (room.status !== "playing" && room.status !== "revealing"))
    return null;

  // Check if game should end
  if (room.roundNumber >= room.settings.maxRounds) {
    room.status = "finished";
    room.currentCard = null;
    return room;
  }

  // Deal next card
  if (room.deck.length === 0) {
    room.deck = shuffleDeck(slogans);
  }

  room.currentCard = room.deck.pop() || null;
  room.roundNumber++;
  room.answers = new Map();
  room.status = "playing";

  markRoomActivity(roomCode);
  return room;
}

export function submitAnswer(
  roomCode: string,
  playerId: string,
  brand: string,
  year: number
): { allAnswered: boolean; room: GameRoom } | null {
  const room = getRoom(roomCode);
  if (!room || room.status !== "playing") return null;

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  room.answers.set(playerId, { playerId, brand, year });
  markRoomActivity(roomCode);

  const connectedPlayers = room.players.filter((p) => p.connected);
  const allAnswered = connectedPlayers.every((p) =>
    room.answers.has(p.id)
  );

  return { allAnswered, room };
}

export function revealRound(roomCode: string): {
  results: PlayerResult[];
  card: Slogan;
  room: GameRoom;
} | null {
  const room = getRoom(roomCode);
  if (!room || !room.currentCard) return null;

  const card = room.currentCard;
  room.status = "revealing";

  const results: PlayerResult[] = room.players.map((player) => {
    const answer = room.answers.get(player.id);
    if (!answer) {
      return {
        playerId: player.id,
        playerName: player.name,
        submittedBrand: "",
        submittedYear: 0,
        brandCorrect: false,
        yearCorrect: false,
        pointsEarned: 0,
      };
    }

    const brandCorrect = isBrandCorrect(answer.brand, card.brand);
    const yearCorrect = isYearCorrect(answer.year, card.year);
    const pointsEarned = calculatePoints(brandCorrect, yearCorrect);

    player.score += pointsEarned;

    return {
      playerId: player.id,
      playerName: player.name,
      submittedBrand: answer.brand,
      submittedYear: answer.year,
      brandCorrect,
      yearCorrect,
      pointsEarned,
    };
  });

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  markRoomActivity(roomCode);
  return { results, card, room };
}

export function removePlayer(
  roomCode: string,
  playerId: string
): GameRoom | null {
  const room = getRoom(roomCode);
  if (!room) return null;

  const playerIndex = room.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return null;

  if (room.status === "waiting") {
    room.players.splice(playerIndex, 1);
    if (room.players.length > 0 && !room.players.some((p) => p.isHost)) {
      room.players[0].isHost = true;
    }
  } else {
    room.players[playerIndex].connected = false;
  }

  markRoomActivity(roomCode);
  return room;
}

export function getClientGameState(
  room: GameRoom,
  playerId?: string
): ClientGameState {
  return {
    roomCode: room.roomCode,
    players: room.players,
    status: room.status,
    settings: room.settings,
    currentSlogan: room.currentCard ? redactSlogan(room.currentCard) : null,
    myId: playerId || null,
    roundNumber: room.roundNumber,
    hasSubmitted: playerId ? room.answers.has(playerId) : false,
  };
}
