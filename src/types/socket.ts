import { ClientGameState, GameSettings, Player, PlayerResult } from "./game";
import { Slogan } from "./slogan";

export interface ClientToServerEvents {
  "client:create-room": (data: { playerName: string }) => void;
  "client:create-solo": (data: { playerName: string }) => void;
  "client:join-room": (data: { roomCode: string; playerName: string }) => void;
  "client:start-game": (data: { roomCode: string }) => void;
  "client:submit-answer": (data: {
    roomCode: string;
    brand: string;
    year: number;
  }) => void;
  "client:next-round": (data: { roomCode: string }) => void;
  "client:leave-room": (data: { roomCode: string }) => void;
  "client:request-sync": (data: { roomCode: string }) => void;
}

export interface ServerToClientEvents {
  "server:room-created": (data: {
    roomCode: string;
    player: Player;
  }) => void;
  "server:player-joined": (data: {
    player: Player;
    players: Player[];
  }) => void;
  "server:player-left": (data: {
    playerId: string;
    players: Player[];
  }) => void;
  "server:game-started": (data: { gameState: ClientGameState }) => void;
  "server:round-start": (data: {
    slogan: string;
    difficulty: string;
    roundNumber: number;
    timeoutSeconds: number;
  }) => void;
  "server:answer-received": (data: { playerId: string }) => void;
  "server:round-reveal": (data: {
    card: Slogan;
    playerResults: PlayerResult[];
    players: Player[];
  }) => void;
  "server:game-over": (data: {
    players: Player[];
  }) => void;
  "server:error": (data: { message: string; code: string }) => void;
  "server:state-sync": (data: { gameState: ClientGameState }) => void;
  "server:countdown": (data: { secondsLeft: number }) => void;
}
