import { Slogan, RedactedSlogan } from "../types/slogan";

export function shuffleDeck(slogans: Slogan[]): Slogan[] {
  const deck = [...slogans];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function redactSlogan(slogan: Slogan): RedactedSlogan {
  return {
    id: slogan.id,
    slogan: slogan.slogan,
    difficulty: slogan.difficulty,
  };
}

export function isBrandCorrect(submitted: string, actual: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-zäöüß0-9]/g, "");

  const sub = normalize(submitted);
  const act = normalize(actual);

  if (!sub) return false;

  // Exact match
  if (sub === act) return true;

  // One contains the other (e.g. "Raiffeisenbank" matches "Volksbanken Raiffeisenbanken")
  if (act.includes(sub) || sub.includes(act)) return true;

  // Levenshtein distance for typos (allow ~20% error rate)
  const maxDist = Math.max(1, Math.floor(act.length * 0.25));
  if (levenshtein(sub, act) <= maxDist) return true;

  return false;
}

export function isYearCorrect(
  submitted: number,
  actual: number,
  tolerance: number = 2
): boolean {
  return Math.abs(submitted - actual) <= tolerance;
}

export function calculatePoints(
  brandCorrect: boolean,
  yearCorrect: boolean
): number {
  let points = 0;
  if (brandCorrect) points += 1;
  if (yearCorrect) points += 3;
  return points;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
