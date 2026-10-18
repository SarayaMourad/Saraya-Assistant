import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, signToken } from "../lib/auth";
import { AuthenticatedRequest } from "../types";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(1)
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() }
    });

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const token = signToken(user.id);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch {
    return res.status(400).json({ error: "Données de connexion invalides" });
  }
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { id: true, email: true, name: true, role: true }
    });
    if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
    return res.json(user);
  } catch {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/password", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = z.object({
      currentPassword: z.string().min(1, "Mot de passe actuel requis"),
      newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères")
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });

    if (!user) {
      return res.status(401).json({ error: "Utilisateur introuvable" });
    }

    const currentPasswordIsValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!currentPasswordIsValid) {
      return res.status(400).json({ error: "Mot de passe actuel incorrect" });
    }

    if (body.currentPassword === body.newPassword) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'ancien" });
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    return res.json({ message: "Mot de passe modifié avec succès." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Données invalides" });
    }
    console.error("PASSWORD CHANGE ERROR:", error);
    return res.status(500).json({ error: "Impossible de modifier le mot de passe" });
  }
});

export default router;
