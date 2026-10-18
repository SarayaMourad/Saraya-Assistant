export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type Item = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
  filename?: string;
  filenames?: string[];
  source?: string;
  actionId?: string;
  preview?: string;
  requiresConfirmation?: boolean;
  pending?: boolean;
  recetteState?: "REVIEW_DATA" | "REVIEW_CORRECTIONS" | "READY_TO_RECORD" | "RECORDED";
  recetteData?: any;
  recetteCalculations?: any;
  recetteFinal?: any;
  shiftId?: string;
};
