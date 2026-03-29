export interface Slogan {
  id: string;
  slogan: string;
  brand: string;
  year: number;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  youtubeId?: string;
}

export interface RedactedSlogan {
  id: string;
  slogan: string;
  difficulty: "easy" | "medium" | "hard";
}
