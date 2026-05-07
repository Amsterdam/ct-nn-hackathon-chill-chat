const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type Stage = "neutral" | "teasing" | "mocking";
export type Mode = "teasing" | "bullying";
export type ChatMessage = { author: string; text: string };
export type GeneratedMessage = ChatMessage & { stage: Stage };
export type GeneratedChat = { target: string; messages: GeneratedMessage[] };
export type Mediation = { title: string; body: string; suggestion: string };
export type FreezeContent = { summary: string; redirect_prompt: string };

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

export const postGenerateChat = (
  options: { length?: number; topic?: string; mode?: Mode } = {},
) => post<GeneratedChat>("/api/generate_chat", { length: 14, mode: "bullying", ...options });

export const postMediation = (messages: ChatMessage[], flagCount: number) =>
  post<Mediation>("/api/mediation", { messages, flag_count: flagCount });

export const postFreeze = (messages: ChatMessage[]) =>
  post<FreezeContent>("/api/freeze", { messages });
