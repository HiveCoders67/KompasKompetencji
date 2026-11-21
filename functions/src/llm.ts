/*
 * LLM provider (docs/03 § 1). Prototype: Gemma 4 via the Gemini API (free tier), key only in Cloud Functions
 * (secret GEMINI_API_KEY). No fallback to other models — on quota exhaustion the user gets QUOTA_MESSAGE.
 * Production: an on-premise model (e.g. Bielik / PLLuM) behind the same interface.
 */

export interface LlmRequest {
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmProvider {
  readonly name: string;
  generate(req: LlmRequest): Promise<string>;
}

export const QUOTA_MESSAGE = 'Wyczerpano dostępne zasoby asystenta AI. Spróbuj ponownie później.';

export class LlmQuotaError extends Error {
  constructor() {
    super(QUOTA_MESSAGE);
  }
}

export class LlmError extends Error {}

export const DEFAULT_MODEL = 'gemma-4-31b-it';

export class GemmaProvider implements LlmProvider {
  readonly name: string;
  constructor(
    private apiKey: string,
    private model = DEFAULT_MODEL,
  ) {
    this.name = model;
  }

  async generate({ system, user, temperature = 0.2, maxOutputTokens = 2048 }: LlmRequest): Promise<string> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    });
    if (res.status === 429) throw new LlmQuotaError();
    const body = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      error?: { status?: string; message?: string };
    } | null;
    if (body?.error?.status === 'RESOURCE_EXHAUSTED') throw new LlmQuotaError();
    if (!res.ok) throw new LlmError(`Gemini API ${res.status}: ${body?.error?.message ?? 'błąd'}`);
    // Gemma 4 may return thinking parts — only the final answer is used
    const text = (body?.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new LlmError('Pusta odpowiedź modelu.');
    return text;
  }
}

/** Extracts the first JSON object from a model answer (tolerates ```json fences and surrounding text). */
export function parseJsonObject<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
