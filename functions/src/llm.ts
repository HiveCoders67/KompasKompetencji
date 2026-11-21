/*
 * LLM provider (docs/03 § 1). Gemini API (paid tier, default Gemini 3.5 Flash-Lite), key only in Cloud Functions
 * (secret GEMINI_API_KEY). No fallback to other models — on quota exhaustion the user gets QUOTA_MESSAGE.
 * Production: an on-premise model (e.g. Bielik / PLLuM) behind the same interface.
 */

export interface LlmRequest {
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask the API for a JSON response (responseMimeType); the caller still parses defensively. */
  json?: boolean;
  /** Structured output (Gemini `responseSchema`, OpenAPI subset); implies `json`. */
  jsonSchema?: object;
}

export interface LlmProvider {
  readonly name: string;
  generate(req: LlmRequest): Promise<string>;
}

/** docs/03 § 1 — shown on HTTP 429 or resource exhaustion (incl. depleted credits), no fallback model. */
export const QUOTA_MESSAGE = 'Wyczerpano dostępne zasoby asystenta AI. Spróbuj ponownie później.';
export const CONFIG_MESSAGE =
  'Asystent AI nie jest poprawnie skonfigurowany (klucz API lub dostęp do modelu). Skontaktuj się z administratorem.';
export const TIMEOUT_MESSAGE = 'Asystent AI nie odpowiedział na czas. Spróbuj ponownie.';
export const UNAVAILABLE_MESSAGE = 'Asystent AI jest chwilowo niedostępny. Spróbuj ponownie za chwilę.';

/** Error messages (`message`) are technical details for logs; user-facing texts are the constants above. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}
/** Rate limit / exhausted quota or credits. */
export class LlmQuotaError extends LlmError {}
/** Missing or rejected API key, no access to the model — retrying will not help. */
export class LlmConfigError extends LlmError {}
/** The model did not answer within the time budget. */
export class LlmTimeoutError extends LlmError {}

// Fastest / cheapest Gemini model; with minimal thinking ~1.5 s per answer, 10/10 on the assistant test set (2026-11-21)
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
/** 'minimal' = fastest; 'default' = the model's own default thinking level. */
export const DEFAULT_THINKING_LEVEL: ThinkingLevel | 'default' = 'minimal';
/** Parses GEMINI_THINKING_LEVEL; unknown values / 'default' → model default (no thinkingConfig sent). */
export const parseThinkingLevel = (v: string | undefined): ThinkingLevel | undefined =>
  (THINKING_LEVELS as readonly string[]).includes(v ?? '') ? (v as ThinkingLevel) : undefined;

export interface GeminiOptions {
  /** Total time for all attempts; must stay below the Cloud Function timeout (min. 60 s). */
  budgetMs?: number;
  /** Extra attempts after a transient failure (5xx, network error). */
  retries?: number;
  backoffMs?: number;
  /**
   * Thinking level sent to the API; undefined = model default. (Gemma 4 accepts only "minimal",
   * Gemini 3.x Flash models also low / medium / high.)
   */
  thinkingLevel?: ThinkingLevel;
  /** Called before each retry with the reason of the failed attempt (for logs). */
  onRetry?: (attempt: number, detail: string) => void;
}

const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const MIN_ATTEMPT_MS = 10_000;

interface GeminiBody {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { status?: string; message?: string; details?: { reason?: string }[] };
}

export class GeminiProvider implements LlmProvider {
  readonly name: string;
  private readonly budgetMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly onRetry?: (attempt: number, detail: string) => void;
  private readonly thinkingLevel?: ThinkingLevel;

  constructor(
    private apiKey: string,
    private model = DEFAULT_MODEL,
    opts: GeminiOptions = {},
  ) {
    this.name = model;
    this.budgetMs = opts.budgetMs ?? 50_000;
    // Gemini returns 503 "high demand" in bursts — spread the attempts over the time budget (2, 4, 8, 16 s)
    this.retries = opts.retries ?? 4;
    this.backoffMs = opts.backoffMs ?? 2_000;
    this.onRetry = opts.onRetry;
    this.thinkingLevel = opts.thinkingLevel;
  }

  async generate(req: LlmRequest): Promise<string> {
    if (!this.apiKey?.trim()) throw new LlmConfigError('GEMINI_API_KEY is empty (emulator: functions/.secret.local)');
    const deadline = Date.now() + this.budgetMs;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.once(req, deadline - Date.now());
      } catch (e) {
        const wait = this.backoffMs * 2 ** attempt;
        const canRetry = e instanceof LlmError && e.retryable && attempt < this.retries && deadline - Date.now() - wait >= MIN_ATTEMPT_MS;
        if (!canRetry) throw e;
        this.onRetry?.(attempt + 1, (e as Error).message);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  private async once({ system, user, temperature = 0.2, maxOutputTokens = 2048, json, jsonSchema }: LlmRequest, timeoutMs: number): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            ...(json || jsonSchema ? { responseMimeType: 'application/json' } : {}),
            ...(jsonSchema ? { responseSchema: jsonSchema } : {}),
            ...(this.thinkingLevel ? { thinkingConfig: { thinkingLevel: this.thinkingLevel } } : {}),
          },
        }),
        signal: AbortSignal.timeout(Math.max(timeoutMs, 1)),
      });
    } catch (e) {
      const err = e as Error;
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new LlmTimeoutError(`Gemini API: no response within ${timeoutMs} ms`);
      throw new LlmError(`Gemini API network error: ${err.message}`, true);
    }
    const body = (await res.json().catch(() => null)) as GeminiBody | null;
    const detail = `Gemini API ${res.status} (${this.model}): ${body?.error?.message ?? res.statusText}`;

    if (res.status === 429 || body?.error?.status === 'RESOURCE_EXHAUSTED') throw new LlmQuotaError(detail);
    const keyRejected = body?.error?.details?.some((d) => d.reason === 'API_KEY_INVALID') ?? false;
    if (res.status === 401 || res.status === 403 || res.status === 404 || keyRejected) throw new LlmConfigError(detail);
    if (!res.ok) throw new LlmError(detail, TRANSIENT_STATUS.has(res.status));

    // thinking models may return thought parts — only the final answer is used
    const candidate = body?.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) {
      const reason = body?.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'unknown';
      throw new LlmError(`Empty model response (${this.model}, reason: ${reason})`);
    }
    return text;
  }
}

/** Extracts the first JSON object from a model answer (tolerates ```json fences and surrounding text). */
export function parseJsonObject<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  // JSON mode may return the object wrapped in an array
  try {
    const whole = JSON.parse(raw.trim()) as unknown;
    const obj = Array.isArray(whole) ? whole[0] : whole;
    if (obj && typeof obj === 'object') return obj as T;
  } catch {
    /* fall through to extracting the first {...} */
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
