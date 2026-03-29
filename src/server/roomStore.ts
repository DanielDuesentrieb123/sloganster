import { GameRoom } from "../types/game";

const rooms = new Map<string, GameRoom>();

export function getRoom(roomCode: string): GameRoom | undefined {
  return rooms.get(roomCode);
}

export function setRoom(roomCode: string, room: GameRoom): void {
  rooms.set(roomCode, room);
}

export function deleteRoom(roomCode: string): void {
  rooms.delete(roomCode);
}

export function roomExists(roomCode: string): boolean {
  return rooms.has(roomCode);
}

// Cleanup rooms that have been empty or finished for more than 5 minutes
const CLEANUP_INTERVAL = 60_000;
const ROOM_TTL = 5 * 60_000;

const roomTimestamps = new Map<string, number>();

export function markRoomActivity(roomCode: string): void {
  roomTimestamps.set(roomCode, Date.now());
}

setInterval(() => {
  const now = Date.now();
  for (const [code, timestamp] of roomTimestamps.entries()) {
    const room = rooms.get(code);
    if (!room) {
      roomTimestamps.delete(code);
      continue;
    }
    const allDisconnected = room.players.every((p) => !p.connected);
    const isFinished = room.status === "finished";
    if ((allDisconnected || isFinished) && now - timestamp > ROOM_TTL) {
      rooms.delete(code);
      roomTimestamps.delete(code);
    }
  }
}, CLEANUP_INTERVAL);
