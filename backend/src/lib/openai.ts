import OpenAI from "openai";

export type OpenAIStatus =
  | "ready"
  | "missing_key"
  | "invalid_key"
  | "no_credit"
  | "rate_limited"
  | "model_unavailable"
  | "unavailable";

function cleanKey(key?: string | null) {
  const value = key?.trim();
  return value || undefined;
}

export function getOpenAI(key?: string | null) {
  const apiKey = cleanKey(key) || cleanKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    const error = new Error("NO_OPENAI_KEY");
    (error as Error & { code?: string }).code = "NO_OPENAI_KEY";
    throw error;
  }
  // Use the official OpenAI endpoint. Never send the key to Google.
  return new OpenAI({ apiKey, timeout: 60000, maxRetries: 2 });
}

function getErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { status: undefined as number | undefined, code: undefined as string | undefined, type: undefined as string | undefined };
  const c = error as { status?: number; code?: string; type?: string; error?: { code?: string; type?: string } };
  return { status: c.status, code: c.code || c.error?.code, type: c.type || c.error?.type };
}

export function classifyOpenAIError(error: unknown): OpenAIStatus {
  if (error instanceof Error && error.message === "NO_OPENAI_KEY") return "missing_key";
  const { status, code, type } = getErrorDetails(error);
  if (status === 401 || status === 403) return "invalid_key";
  if (code === "insufficient_quota" || type === "insufficient_quota") return "no_credit";
  if (status === 429) return "rate_limited";
  if (status === 404 || code === "model_not_found") return "model_unavailable";
  return "unavailable";
}

export function openaiStatusMessage(status: OpenAIStatus) {
  switch (status) {
    case "ready": return "OpenAI connecté. Clé API opérationnelle.";
    case "missing_key": return "Ajoutez votre clé API OpenAI dans les paramètres.";
    case "invalid_key": return "Clé API OpenAI invalide, non autorisée ou révoquée.";
    case "no_credit": return "Le quota ou la facturation OpenAI ne permet pas cette requête.";
    case "rate_limited": return "OpenAI limite temporairement les requêtes. Réessayez dans un instant.";
    case "model_unavailable": return "Le modèle OpenAI configuré est indisponible.";
    default: return "OpenAI est momentanément indisponible.";
  }
}

export function friendlyOpenAIError(error: unknown) {
  return openaiStatusMessage(classifyOpenAIError(error));
}

export async function verifyOpenAIAccess(key?: string | null) {
  let client: OpenAI;
  try { client = getOpenAI(key); } catch (error) {
    const status = classifyOpenAIError(error);
    return { ok: false, status, message: openaiStatusMessage(status) };
  }
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  try {
    await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Réponds uniquement: OK" }],
      max_tokens: 8
    });
    return { ok: true, status: "ready" as const, message: openaiStatusMessage("ready"), model };
  } catch (error) {
    const status = classifyOpenAIError(error);
    return { ok: false, status, message: openaiStatusMessage(status), model };
  }
}
