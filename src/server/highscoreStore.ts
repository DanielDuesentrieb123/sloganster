import * as fs from "fs";
import * as path from "path";

export interface HighscoreEntry {
  playerName: string;
  score: number;
  maxScore: number;
  rounds: number;
  isSolo: boolean;
  playerCount: number;
  date: string;
}

const MAX_ENTRIES = 50;
const DATA_FILE = path.join(process.cwd(), "highscores.json");

let highscores: HighscoreEntry[] = [];

// Load from file on startup
function loadFromFile(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      highscores = JSON.parse(data);
      console.log(`[Highscore] Loaded ${highscores.length} entries`);
    }
  } catch (err) {
    console.error("[Highscore] Failed to load:", err);
    highscores = [];
  }
}

function saveToFile(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(highscores, null, 2), "utf-8");
  } catch (err) {
    console.error("[Highscore] Failed to save:", err);
  }
}

// Initialize
loadFromFile();

export function addHighscore(entry: HighscoreEntry): void {
  highscores.push(entry);
  // Sort by score descending, then by percentage
  highscores.sort((a, b) => {
    const pctA = a.score / a.maxScore;
    const pctB = b.score / b.maxScore;
    if (b.score !== a.score) return b.score - a.score;
    return pctB - pctA;
  });
  // Keep only top entries
  if (highscores.length > MAX_ENTRIES) {
    highscores = highscores.slice(0, MAX_ENTRIES);
  }
  saveToFile();
}

export function getHighscores(limit: number = 10): HighscoreEntry[] {
  return highscores.slice(0, limit);
}
