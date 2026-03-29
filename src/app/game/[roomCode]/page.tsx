"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "../../../hooks/useSocket";
import { ClientGameState, PlayerResult } from "../../../types/game";
import { Slogan } from "../../../types/slogan";
import YearSlider from "../../../components/game/YearSlider";
import YouTubeEmbed from "../../../components/game/YouTubeEmbed";

type Phase = "waiting" | "guessing" | "revealing" | "finished";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;
  const socket = useSocket();

  const [myId, setMyId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");

  // Guessing state
  const [brandGuess, setBrandGuess] = useState("");
  const [yearGuess, setYearGuess] = useState(1990);
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [currentSlogan, setCurrentSlogan] = useState("");

  // Reveal state
  const [revealCard, setRevealCard] = useState<Slogan | null>(null);
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [answeredPlayerIds, setAnsweredPlayerIds] = useState<Set<string>>(
    new Set()
  );

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const storedId = sessionStorage.getItem("playerId");
    if (storedId) {
      setMyId(storedId);
    } else {
      router.push("/");
      return;
    }
    const timer = setTimeout(() => {
      socket.emit("client:request-sync", { roomCode });
    }, 100);
    return () => clearTimeout(timer);
  }, [router, socket, roomCode]);

  useEffect(() => {
    const onStateSync = (data: { gameState: ClientGameState }) => {
      setGameState(data.gameState);
      if (data.gameState.myId) setMyId(data.gameState.myId);
    };

    const onGameStarted = (data: { gameState: ClientGameState }) => {
      setGameState(data.gameState);
      if (data.gameState.myId) setMyId(data.gameState.myId);
    };

    const onRoundStart = (data: {
      slogan: string;
      difficulty: string;
      roundNumber: number;
      timeoutSeconds: number;
    }) => {
      setPhase("guessing");
      setCurrentSlogan(data.slogan);
      setBrandGuess("");
      setYearGuess(1990);
      setSubmitted(false);
      setCountdown(data.timeoutSeconds);
      setRevealCard(null);
      setPlayerResults([]);
      setAnsweredPlayerIds(new Set());

      // Update round number in local state
      setGameState((prev) =>
        prev ? { ...prev, roundNumber: data.roundNumber, status: "playing" } : prev
      );

      // Start countdown
      if (countdownRef.current) clearInterval(countdownRef.current);
      let secondsLeft = data.timeoutSeconds;
      countdownRef.current = setInterval(() => {
        secondsLeft--;
        setCountdown(secondsLeft);
        if (secondsLeft <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }, 1000);
    };

    const onAnswerReceived = (data: { playerId: string }) => {
      setAnsweredPlayerIds((prev) => new Set(prev).add(data.playerId));
    };

    const onRoundReveal = (data: {
      card: Slogan;
      playerResults: PlayerResult[];
      players: ClientGameState["players"];
    }) => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setPhase("revealing");
      setRevealCard(data.card);
      setPlayerResults(data.playerResults);
      setGameState((prev) =>
        prev ? { ...prev, players: data.players, status: "revealing" } : prev
      );
    };

    const onGameOver = (data: { players: ClientGameState["players"] }) => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setPhase("finished");
      setGameState((prev) =>
        prev ? { ...prev, players: data.players, status: "finished" } : prev
      );
    };

    const onPlayerJoined = (data: { players: ClientGameState["players"] }) => {
      setGameState((prev) => (prev ? { ...prev, players: data.players } : prev));
    };

    const onPlayerLeft = (data: { players: ClientGameState["players"] }) => {
      setGameState((prev) => (prev ? { ...prev, players: data.players } : prev));
    };

    socket.on("server:state-sync", onStateSync);
    socket.on("server:game-started", onGameStarted);
    socket.on("server:round-start", onRoundStart);
    socket.on("server:answer-received", onAnswerReceived);
    socket.on("server:round-reveal", onRoundReveal);
    socket.on("server:game-over", onGameOver);
    socket.on("server:player-joined", onPlayerJoined);
    socket.on("server:player-left", onPlayerLeft);

    return () => {
      socket.off("server:state-sync", onStateSync);
      socket.off("server:game-started", onGameStarted);
      socket.off("server:round-start", onRoundStart);
      socket.off("server:answer-received", onAnswerReceived);
      socket.off("server:round-reveal", onRoundReveal);
      socket.off("server:game-over", onGameOver);
      socket.off("server:player-joined", onPlayerJoined);
      socket.off("server:player-left", onPlayerLeft);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [socket]);

  const handleSubmit = useCallback(() => {
    if (submitted || !brandGuess.trim()) return;
    setSubmitted(true);
    socket.emit("client:submit-answer", {
      roomCode,
      brand: brandGuess.trim(),
      year: yearGuess,
    });
  }, [submitted, brandGuess, yearGuess, socket, roomCode]);

  const handleNextRound = useCallback(() => {
    socket.emit("client:next-round", { roomCode });
  }, [socket, roomCode]);

  const maxRounds = gameState?.settings.maxRounds ?? 10;
  const players = gameState?.players ?? [];
  const myResult = playerResults.find((r) => r.playerId === myId);
  const isSolo = players.length === 1;
  const isHost = players.find((p) => p.id === myId)?.isHost ?? false;

  // FINISHED
  if (phase === "finished") {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const isWinner = winner?.id === myId;
    return (
      <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <div className="w-full max-w-lg text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            <div className="text-6xl">{isWinner || isSolo ? "🏆" : "🎮"}</div>
            <h1 className="text-3xl font-bold text-gray-800">
              {isSolo
                ? "Spiel beendet!"
                : isWinner
                  ? "Du hast gewonnen!"
                  : `${winner?.name} hat gewonnen!`}
            </h1>

            <div className="space-y-2">
              <h2 className="text-sm font-medium text-gray-500">Endstand</h2>
              {sorted.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    i === 0
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">
                      {i + 1}.
                    </span>
                    <span className="font-medium text-gray-800">{p.name}</span>
                  </div>
                  <span className="font-bold text-orange-600">
                    {p.score} Punkte
                  </span>
                </div>
              ))}
              <p className="text-sm text-gray-400 mt-2">
                Max. erreichbar: {maxRounds * 4} Punkte
              </p>
            </div>

            <button
              onClick={() => {
                sessionStorage.clear();
                router.push("/");
              }}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Neues Spiel
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-gradient-to-br from-amber-50 to-orange-100 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-orange-600">Sloganster</h1>
          <p className="text-xs text-gray-400">
            Runde {gameState?.roundNumber ?? 0}/{maxRounds}
            {!isSolo && ` | Raum: ${roomCode}`}
          </p>
        </div>
        <div className="flex gap-2">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                answeredPlayerIds.has(p.id) && phase === "guessing"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <span>{p.name}</span>
              <span className="font-bold">{p.score}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          {/* GUESSING PHASE */}
          {phase === "guessing" && (
            <>
              {/* Countdown */}
              <div className="text-center">
                <span
                  className={`text-5xl font-bold tabular-nums ${
                    countdown <= 5 ? "text-red-500" : "text-gray-300"
                  }`}
                >
                  {countdown}
                </span>
              </div>

              {/* Slogan Card */}
              <div className="bg-white rounded-xl shadow-lg p-6 text-center border-2 border-orange-200">
                <p className="text-2xl font-bold text-gray-800 leading-relaxed">
                  &ldquo;{currentSlogan}&rdquo;
                </p>
              </div>

              {/* Brand Input */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Welche Marke?
                </label>
                <input
                  type="text"
                  value={brandGuess}
                  onChange={(e) => setBrandGuess(e.target.value)}
                  placeholder="Marke eingeben..."
                  disabled={submitted}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                  autoFocus
                />
              </div>

              {/* Year Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Aus welchem Jahr?
                </label>
                <YearSlider
                  value={yearGuess}
                  onChange={setYearGuess}
                  disabled={submitted}
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={submitted || !brandGuess.trim()}
                className={`w-full py-4 font-bold text-lg rounded-xl transition-colors ${
                  submitted
                    ? "bg-green-500 text-white cursor-default"
                    : "bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white"
                }`}
              >
                {submitted ? "Abgegeben ✓" : "Antwort abgeben"}
              </button>
            </>
          )}

          {/* REVEAL PHASE */}
          {phase === "revealing" && revealCard && (
            <>
              {/* Correct Answer */}
              <div className="bg-white rounded-xl shadow-lg p-6 text-center border-2 border-orange-200 space-y-3">
                <p className="text-xl font-bold text-gray-800 leading-relaxed">
                  &ldquo;{revealCard.slogan}&rdquo;
                </p>
                <div className="flex items-center justify-center gap-4">
                  <span className="text-2xl font-bold text-orange-600">
                    {revealCard.brand}
                  </span>
                  <span className="text-2xl font-bold text-gray-400">
                    {revealCard.year}
                  </span>
                </div>
              </div>

              {/* My Result */}
              {myResult && (
                <div className="bg-white rounded-xl shadow-md p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Deine Marke:</span>
                    <span className="font-medium text-gray-800">
                      {myResult.submittedBrand || "—"}{" "}
                      {myResult.brandCorrect ? (
                        <span className="text-green-500">✓ +1</span>
                      ) : (
                        <span className="text-red-400">✗</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Dein Jahr:</span>
                    <span className="font-medium text-gray-800">
                      {myResult.submittedYear || "—"}{" "}
                      {myResult.yearCorrect ? (
                        <span className="text-green-500">✓ +3</span>
                      ) : (
                        <span className="text-red-400">
                          ✗ ({Math.abs(myResult.submittedYear - revealCard.year)}{" "}
                          daneben)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-center pt-2 border-t">
                    <span className="text-lg font-bold text-orange-600">
                      +{myResult.pointsEarned} Punkte
                    </span>
                  </div>
                </div>
              )}

              {/* Other Players Results */}
              {!isSolo && playerResults.length > 1 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500">
                    Alle Spieler
                  </h3>
                  {playerResults
                    .sort((a, b) => b.pointsEarned - a.pointsEarned)
                    .map((r) => (
                      <div
                        key={r.playerId}
                        className={`flex items-center justify-between px-4 py-2 rounded-lg ${
                          r.playerId === myId
                            ? "bg-orange-50 border border-orange-200"
                            : "bg-gray-50"
                        }`}
                      >
                        <span className="text-sm text-gray-700">
                          {r.playerName}: {r.submittedBrand || "—"} ({r.submittedYear})
                        </span>
                        <span className="text-sm font-bold text-orange-600">
                          +{r.pointsEarned}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* YouTube Video */}
              {revealCard.youtubeId && (
                <YouTubeEmbed videoId={revealCard.youtubeId} />
              )}

              {/* Next Round */}
              {(isHost || isSolo) && (
                <button
                  onClick={handleNextRound}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg rounded-xl transition-colors"
                >
                  {(gameState?.roundNumber ?? 0) >= maxRounds
                    ? "Ergebnis anzeigen"
                    : "Nächste Runde →"}
                </button>
              )}
              {!isHost && !isSolo && (
                <p className="text-center text-gray-400 text-sm">
                  Warte auf den Host...
                </p>
              )}
            </>
          )}

          {/* WAITING PHASE */}
          {phase === "waiting" && (
            <div className="text-center text-gray-400">
              Spiel wird geladen...
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
