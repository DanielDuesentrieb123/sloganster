import { RedactedSlogan, Slogan } from "./slogan";

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
  connected: boolean;
}

export interface PlayerAnswer {
  playerId: string;
  brand: string;
  year: number;
}

export interface PlayerResult {
  playerId: string;
  playerName: string;
  submittedBrand: string;
  submittedYear: number;
  brandCorrect: boolean;
  yearCorrect: boolean;
  pointsEarned: number;
}

export interface GameSettings {
  maxRounds: number;
  roundTimeSeconds: number;
}

export type GameStatus = "waiting" | "playing" | "revealing" | "finished";

export interface GameRoom {
  roomCode: string;
  players: Player[];
  status: GameStatus;
  settings: GameSettings;
  deck: Slogan[];
  currentCard: Slogan | null;
  roundNumber: number;
  answers: Map<string, PlayerAnswer>;
  roundTimer: ReturnType<typeof setTimeout> | null;
  isSinglePlayer: boolean;
}

export interface ClientGameState {
  roomCode: string;
  players: Player[];
  status: GameStatus;
  settings: GameSettings;
  currentSlogan: RedactedSlogan | null;
  myId: string | null;
  roundNumber: number;
  hasSubmitted: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  maxRounds: 10,
  roundTimeSeconds: 20,
};
