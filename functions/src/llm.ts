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

export const DEFAULT_MODEL = 'gemma-4-31b-it';

export interface GemmaOptions {
  /** Total time for all attempts; must stay below the Cloud Function timeout (min. 60 s). */
  budgetMs?: number;
  /** Extra attempts after a transient failure (5xx, network error). */
  retries?: number;
  backoffMs?: number;
}

const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const MIN_ATTEMPT_MS = 10_000;

interface GeminiBody {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { status?: string; message?: string; details?: { reason?: string }[] };
}

export class GemmaProvider implements LlmProvider {
  readonly name: string;
  private readonly budgetMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;

  constructor(
    private apiKey: string,
    private model = DEFAULT_MODEL,
    opts: GemmaOptions = {},
  ) {
    this.name = model;
    this.budgetMs = opts.budgetMs ?? 50_000;
    this.retries = opts.retries ?? 2;
    this.backoffMs = opts.backoffMs ?? 1_000;
  }

  async generate(req: LlmRequest): Promise<string> {
    if (!this.apiKey?.trim()) throw new LlmConfigError('GEMINI_API_KEY is empty (emulator: functions/.secret.local)');
    const deadline = Date.now() + this.budgetMs;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.once(req, deadline - Date.now());
      } catch (e) {
        const wait = this.backoffMs * 3 ** attempt;
        const canRetry = e instanceof LlmError && e.retryable && attempt < this.retries && deadline - Date.now() - wait >= MIN_ATTEMPT_MS;
        if (!canRetry) throw e;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  private async once({ system, user, temperature = 0.2, maxOutputTokens = 2048 }: LlmRequest, timeoutMs: number): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature, maxOutputTokens },
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

    // Gemma 4 may return thinking parts — only the final answer is used
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
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
