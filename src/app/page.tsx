"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "../hooks/useSocket";

export default function HomePage() {
  const router = useRouter();
  const socket = useSocket();
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSolo = useCallback(() => {
    if (!playerName.trim()) {
      setError("Bitte gib deinen Namen ein");
      return;
    }
    setLoading(true);
    setError("");

    socket.once("server:room-created", ({ roomCode, player }) => {
      sessionStorage.setItem("playerId", player.id);
      sessionStorage.setItem("playerName", playerName);
      sessionStorage.setItem("roomCode", roomCode);
      router.push(`/game/${roomCode}`);
    });

    socket.once("server:error", ({ message }) => {
      setError(message);
      setLoading(false);
    });

    socket.emit("client:create-solo", { playerName: playerName.trim() });
  }, [playerName, socket, router]);

  const handleCreate = useCallback(() => {
    if (!playerName.trim()) {
      setError("Bitte gib deinen Namen ein");
      return;
    }
    setLoading(true);
    setError("");

    socket.once("server:room-created", ({ roomCode, player }) => {
      sessionStorage.setItem("playerId", player.id);
      sessionStorage.setItem("playerName", playerName);
      sessionStorage.setItem("roomCode", roomCode);
      router.push(`/lobby/${roomCode}`);
    });

    socket.once("server:error", ({ message }) => {
      setError(message);
      setLoading(false);
    });

    socket.emit("client:create-room", { playerName: playerName.trim() });
  }, [playerName, socket, router]);

  const handleJoin = useCallback(() => {
    if (!playerName.trim()) {
      setError("Bitte gib deinen Namen ein");
      return;
    }
    if (!roomCode.trim()) {
      setError("Bitte gib den Raum-Code ein");
      return;
    }
    setLoading(true);
    setError("");

    socket.once("server:state-sync", ({ gameState }) => {
      const me = gameState.players.find((p) => p.name === playerName.trim());
      if (me) {
        sessionStorage.setItem("playerId", me.id);
      }
      sessionStorage.setItem("playerName", playerName);
      sessionStorage.setItem("roomCode", roomCode.toUpperCase());
      router.push(`/lobby/${roomCode.toUpperCase()}`);
    });

    socket.once("server:error", ({ message }) => {
      setError(message);
      setLoading(false);
    });

    socket.emit("client:join-room", {
      roomCode: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
    });
  }, [playerName, roomCode, socket, router]);

  return (
    <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-orange-600 mb-2">
            Sloganster
          </h1>
          <p className="text-gray-600 text-lg">
            Erkennst du die Werbung?
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dein Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Name eingeben..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg text-gray-900"
              maxLength={20}
            />
          </div>

          {mode === "menu" && (
            <div className="space-y-3">
              <button
                onClick={handleSolo}
                disabled={loading}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold text-lg rounded-xl transition-colors"
              >
                {loading ? "Starte..." : "Solo spielen"}
              </button>
              <button
                onClick={() => setMode("create")}
                className="w-full py-4 bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-bold text-lg rounded-xl transition-colors"
              >
                Multiplayer erstellen
              </button>
              <button
                onClick={() => setMode("join")}
                className="w-full py-3 text-orange-500 hover:text-orange-700 font-medium transition-colors"
              >
                Spiel beitreten
              </button>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-3">
              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold text-lg rounded-xl transition-colors"
              >
                {loading ? "Erstelle Raum..." : "Raum erstellen"}
              </button>
              <button
                onClick={() => { setMode("menu"); setError(""); }}
                className="w-full py-2 text-gray-500 hover:text-gray-700"
              >
                Zurück
              </button>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raum-Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="z.B. AB3K"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-2xl text-center font-mono tracking-widest text-gray-900"
                  maxLength={4}
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold text-lg rounded-xl transition-colors"
              >
                {loading ? "Trete bei..." : "Beitreten"}
              </button>
              <button
                onClick={() => { setMode("menu"); setError(""); }}
                className="w-full py-2 text-gray-500 hover:text-gray-700"
              >
                Zurück
              </button>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-center text-sm">{error}</p>
          )}
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          Rate berühmte Werbeslogans — welche Marke und aus welchem Jahr?
        </p>
      </div>
    </main>
  );
}
