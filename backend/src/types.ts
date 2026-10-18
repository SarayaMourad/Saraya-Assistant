import { Request } from "express";

export type AuthenticatedRequest = Request & {
  auth?: { userId: string };
};

export type ChatAction =
  | { type: "add_stock"; data: { itemId: string; quantity: number; note?: string } }
  | { type: "add_item"; data: { name: string; unit: string; initialQuantity?: number } }
  | { type: "update_item"; data: { itemId: string; name?: string; unit?: string; quantityDelta?: number } }
  | { type: "delete_item"; data: { itemId: string } }
  | {
      type: "close_shift";
      data: {
        shiftType: "MORNING" | "EVENING";
        cashExpected: number;
        cashCounted: number;
        consumed: { itemId: string; quantity: number }[];
        notes?: string;
      };
    };
