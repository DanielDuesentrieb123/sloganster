"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "../../../hooks/useSocket";
import { ClientGameState, Player } from "../../../types/game";

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;
  const socket = useSocket();
  const [players, setPlayers] = useState<Player[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const storedId = sessionStorage.getItem("playerId");
    if (storedId) setMyId(storedId);

    const timer = setTimeout(() => {
      socket.emit("client:request-sync", { roomCode, playerId: storedId || undefined });
    }, 100);

    const onReconnect = () => {
      if (storedId) {
        socket.emit("client:rejoin-room", { roomCode, playerId: storedId });
      }
    };
    socket.on("connect", onReconnect);

    return () => {
      clearTimeout(timer);
      socket.off("connect", onReconnect);
    };
  }, [socket, roomCode]);

  useEffect(() => {
    const onStateSync = (data: { gameState: ClientGameState }) => {
      setPlayers(data.gameState.players);
      if (data.gameState.myId) setMyId(data.gameState.myId);
    };

    const onPlayerJoined = (data: { player: Player; players: Player[] }) => {
      setPlayers(data.players);
    };

    const onPlayerLeft = (data: { playerId: string; players: Player[] }) => {
      setPlayers(data.players);
    };

    const onGameStarted = () => {
      router.push(`/game/${roomCode}`);
    };

    socket.on("server:state-sync", onStateSync);
    socket.on("server:player-joined", onPlayerJoined);
    socket.on("server:player-left", onPlayerLeft);
    socket.on("server:game-started", onGameStarted);

    return () => {
      socket.off("server:state-sync", onStateSync);
      socket.off("server:player-joined", onPlayerJoined);
      socket.off("server:player-left", onPlayerLeft);
      socket.off("server:game-started", onGameStarted);
    };
  }, [socket, roomCode, router]);

  const isHost = players.find((p) => p.id === myId)?.isHost ?? false;

  const handleStart = () => {
    socket.emit("client:start-game", { roomCode });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    socket.emit("client:leave-room", { roomCode });
    sessionStorage.clear();
    router.push("/");
  };

  return (
    <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-orange-600 mb-1">
            Sloganster
          </h1>
          <p className="text-gray-500">Warteraum</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Raum-Code</p>
            <button
              onClick={handleCopy}
              className="text-4xl font-mono font-bold tracking-[0.3em] text-orange-600 hover:text-orange-700 transition-colors"
            >
              {roomCode}
            </button>
            <p className="text-xs text-gray-400 mt-1">
              {copied ? "Kopiert!" : "Klick zum Kopieren"}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-3">
              Spieler ({players.length})
            </h2>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    player.id === myId
                      ? "bg-orange-50 border border-orange-200"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold text-sm">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">
                      {player.name}
                      {player.id === myId && (
                        <span className="text-orange-500 text-xs ml-1">(Du)</span>
                      )}
                    </span>
                  </div>
                  {player.isHost && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {isHost && (
              <button
                onClick={handleStart}
                disabled={players.length < 2}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors"
              >
                {players.length < 2 ? "Warte auf Mitspieler..." : "Spiel starten"}
              </button>
            )}
            {!isHost && (
              <div className="text-center py-4 text-gray-500">
                Warte, bis der Host das Spiel startet...
              </div>
            )}
            <button
              onClick={handleLeave}
              className="w-full py-2 text-gray-400 hover:text-red-500 text-sm transition-colors"
            >
              Raum verlassen
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
