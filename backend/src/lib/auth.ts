import jwt from "jsonwebtoken";
import { Response } from "express";
import { AuthenticatedRequest } from "../types";

const secret = process.env.JWT_SECRET || "development-secret-change-me";

export function signToken(userId: string) {
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: Function) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, secret) as { userId: string };
    req.auth = { userId: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: "Session expirée" });
  }
}
