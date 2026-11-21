/*
 * LLM provider (docs/03 § 1). Prototype: Gemini 3.5 Flash-Lite via the Gemini API (free tier), key only in Cloud Functions
 * (secret GEMINI_API_KEY). No fallback to other models — on quota exhaustion the user gets QUOTA_MESSAGE.
 * Production: an on-premise model (e.g. Bielik / PLLuM) behind the same interface.
 */

export interface LlmRequest {
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Structured output (Gemini API `responseSchema`, OpenAPI subset) — the answer is then valid JSON of this shape. */
  jsonSchema?: object;
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

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';
export const DEFAULT_THINKING: ThinkingLevel = 'minimal';

/** Backoff for transient 500/503 responses (total wait stays well below the callable timeout). */
const RETRY_DELAYS_MS = [1500, 4000, 8000];

export class GeminiProvider implements LlmProvider {
  readonly name: string;
  constructor(
    private apiKey: string,
    private model = DEFAULT_MODEL,
    /** Thinking adds latency (tens of seconds for Gemma 4 on the free tier); 'minimal' keeps answers interactive. */
    private thinkingLevel: ThinkingLevel = DEFAULT_THINKING,
  ) {
    this.name = model;
  }

  async generate({ system, user, temperature = 0.2, maxOutputTokens = 2048, jsonSchema }: LlmRequest): Promise<string> {
    const structured = jsonSchema ? { responseMimeType: 'application/json', responseSchema: jsonSchema } : {};
    const request = () =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature, maxOutputTokens, thinkingConfig: { thinkingLevel: this.thinkingLevel }, ...structured },
        }),
      });
    // Transient overload (500/503 "high demand") is retried on the SAME model with backoff — this is not a model fallback.
    let res = await request();
    for (const delayMs of RETRY_DELAYS_MS) {
      if (res.status !== 500 && res.status !== 503) break;
      await new Promise((r) => setTimeout(r, delayMs));
      res = await request();
    }
    if (res.status === 429) throw new LlmQuotaError();
    const body = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      error?: { status?: string; message?: string };
    } | null;
    if (body?.error?.status === 'RESOURCE_EXHAUSTED') throw new LlmQuotaError();
    if (!res.ok) throw new LlmError(`Gemini API ${res.status}: ${body?.error?.message ?? 'błąd'}`);
    // the model may return thinking parts — only the final answer is used
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
