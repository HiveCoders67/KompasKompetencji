import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import {
  DEMO_OFFICE_ID,
  STEPS_A,
  STEPS_B,
  completeEvaluation as completeDomain,
  pathOf,
  today,
  toTracking,
  type AiMessage,
  type AssistantMode,
  type Employee,
  type Evaluation,
  type FormType,
  type Osp,
  type ScreenContext,
} from '@kompas/domain';
import { db, fromSnap, toData } from './admin';
import { clearDemoOffice, seedDemo } from './demoSeed';
import { interviewAssistant, suggestAdditionalCriteria, type InterviewTask } from './interview';
import { DEFAULT_MODEL, GeminiProvider, LlmQuotaError, QUOTA_MESSAGE, type LlmProvider } from './llm';
import { answerFormal } from './rag/formal';

setGlobalOptions({ region: 'europe-central2', maxInstances: 5 });

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const LLM_MODEL = defineString('LLM_MODEL', { default: DEFAULT_MODEL });
const llm = (): LlmProvider => new GeminiProvider(GEMINI_API_KEY.value(), LLM_MODEL.value());

// ------------------------------------------------------------------ helpers

interface Claims {
  uid: string;
  roles: string[];
  officeId: string;
}

function claims(req: CallableRequest): Claims {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Zaloguj się.');
  const t = req.auth.token as { roles?: string[]; officeId?: string };
  if (!t.officeId || !Array.isArray(t.roles)) throw new HttpsError('permission-denied', 'Konto bez przypisanego urzędu lub ról.');
  return { uid: req.auth.uid, roles: t.roles, officeId: t.officeId };
}

/** Loads an evaluation the caller supervises (or, for path A, approves as department head). */
async function loadOwnEvaluation(c: Claims, evaluationId: unknown, allowHead = false) {
  if (typeof evaluationId !== 'string' || !evaluationId) throw new HttpsError('invalid-argument', 'Brak evaluationId.');
  const snap = await db.doc(`evaluations/${evaluationId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Nie znaleziono oceny.');
  const ev = fromSnap<Evaluation>(snap);
  const mine = ev.officeId === c.officeId && (ev.supervisorId === c.uid || (allowHead && ev.departmentHeadId === c.uid && ev.type === 'FIRST_EVALUATION'));
  if (!mine) throw new HttpsError('permission-denied', 'Brak dostępu do tej oceny.');
  const empSnap = await db.doc(`employees/${ev.employeeId}`).get();
  return { ev, employee: fromSnap<Employee>(empSnap), ref: snap.ref };
}

async function withLlm<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof LlmQuotaError) throw new HttpsError('resource-exhausted', QUOTA_MESSAGE);
    if (e instanceof HttpsError) throw e;
    logger.error('LLM error', e);
    throw new HttpsError('unavailable', 'Asystent AI jest chwilowo niedostępny. Spróbuj ponownie za chwilę.');
  }
}

/** Stored chat: session owned by the caller; assistant messages are written only here (after validation). */
async function session(c: Claims, mode: AssistantMode, sessionId: unknown, evaluationId: string | null) {
  if (typeof sessionId === 'string' && sessionId) {
    const ref = db.doc(`ai_sessions/${sessionId}`);
    const s = await ref.get();
    if (!s.exists || s.get('userId')?.id !== c.uid || s.get('mode') !== mode) throw new HttpsError('permission-denied', 'Nieprawidłowa sesja.');
    return ref;
  }
  return db.collection('ai_sessions').add(
    toData({ officeId: c.officeId, userId: c.uid, evaluationId, mode, createdAt: new Date().toISOString() }),
  );
}

async function addMessage(sessionRef: FirebaseFirestore.DocumentReference, m: Omit<AiMessage, 'id' | 'createdAt'>) {
  const ref = await sessionRef.collection('messages').add({ ...toData(m), createdAt: FieldValue.serverTimestamp() });
  return { ...m, id: ref.id, createdAt: new Date().toISOString() };
}

function stepLabel(ev: Evaluation, step: unknown): string | null {
  const steps = ev.type === 'FIRST_EVALUATION' ? STEPS_A : STEPS_B;
  return steps.find((s) => s.id === step)?.label ?? (typeof step === 'string' ? step.slice(0, 60) : null);
}

// ------------------------------------------------------------------ evaluation workflow

/** The only way to COMPLETED: validates and computes `summary` with the shared domain functions. */
export const completeEvaluation = onCall(async (req) => {
  const c = claims(req);
  const { ev, employee, ref } = await loadOwnEvaluation(c, req.data?.evaluationId);
  if (ev.supervisorId !== c.uid) throw new HttpsError('permission-denied', 'Ocenę zatwierdza bezpośredni przełożony.');
  let done: Evaluation;
  try {
    done = completeDomain(ev, employee, today(), new Date().toISOString());
  } catch (e) {
    throw new HttpsError('failed-precondition', (e as Error).message);
  }
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (fresh.get('status') !== ev.status) throw new HttpsError('aborted', 'Ocena została zmieniona — odśwież widok.');
    tx.set(ref, toData(done));
    tx.set(db.doc(`evaluation_tracking/${ev.id}`), toData(toTracking(done)));
  });
  return { summary: done.summary, status: done.status };
});

/** HR projection kept in sync on every write (status / deadlines); result is never copied (GDPR). */
export const syncEvaluationTracking = onDocumentWritten('evaluations/{id}', async (event) => {
  const after = event.data?.after;
  const trackingRef = db.doc(`evaluation_tracking/${event.params.id}`);
  if (!after?.exists) {
    await trackingRef.delete();
    return;
  }
  await trackingRef.set(toData(toTracking(fromSnap<Evaluation>(after))));
});

// ------------------------------------------------------------------ AI assistants

export const askFormalAssistant = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 120 }, async (req) => {
  const c = claims(req);
  const question = String(req.data?.question ?? '').trim().slice(0, 1500);
  if (!question) throw new HttpsError('invalid-argument', 'Wpisz pytanie.');
  let context: ScreenContext | null = null;
  let evaluationId: string | null = null;
  if (req.data?.evaluationId) {
    // path / form / status come from the stored evaluation (no partial scores in the context)
    const { ev } = await loadOwnEvaluation(c, req.data.evaluationId, true);
    evaluationId = ev.id;
    context = { path: pathOf(ev), formType: ev.formType, step: stepLabel(ev, req.data?.step), status: ev.status };
  } else if (req.data?.path === 'A' || req.data?.path === 'B') {
    context = { path: req.data.path, formType: null, step: null, status: null };
  }
  const answer = await withLlm(() => answerFormal(llm(), question, context));
  logger.info('formal', { refused: answer.refused, reason: answer.debug.reason, fragments: answer.debug.fragments.length });
  const sessionRef = await session(c, 'FORMAL_ASSISTANT', req.data?.sessionId, evaluationId);
  await addMessage(sessionRef, { role: 'user', content: question, refused: false, context, citations: [] });
  const message = await addMessage(sessionRef, { role: 'assistant', content: answer.content, refused: answer.refused, context, citations: answer.citations });
  return { sessionId: sessionRef.id, message };
});

const TASKS: InterviewTask[] = ['AGENDA', 'FEEDBACK', 'JUSTIFICATION', 'DEVELOPMENT_PLAN', 'DIFFICULT_TALK', 'CHAT'];

export const askInterviewAssistant = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 120 }, async (req) => {
  const c = claims(req);
  const task = req.data?.task as InterviewTask;
  if (!TASKS.includes(task)) throw new HttpsError('invalid-argument', 'Nieznane zadanie asystenta.');
  const { ev, employee } = await loadOwnEvaluation(c, req.data?.evaluationId);
  const message = typeof req.data?.message === 'string' ? req.data.message.slice(0, 1500) : undefined;
  const text = await withLlm(() => interviewAssistant(llm(), task, ev, employee, message));
  const context: ScreenContext = { path: pathOf(ev), formType: ev.formType, step: stepLabel(ev, req.data?.step), status: ev.status };
  const sessionRef = await session(c, 'INTERVIEW_ASSISTANT', req.data?.sessionId, ev.id);
  await addMessage(sessionRef, { role: 'user', content: message ?? `[${task}]`, refused: false, context, citations: [] });
  const saved = await addMessage(sessionRef, { role: 'assistant', content: text, refused: false, context, citations: [] });
  return { sessionId: sessionRef.id, message: saved, task };
});

export const suggestCriteria = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 60 }, async (req) => {
  const c = claims(req);
  const { ev, employee } = await loadOwnEvaluation(c, req.data?.evaluationId);
  const osp = (req.data?.osp as Osp | undefined) ?? employee.osp;
  const formType = (req.data?.formType as FormType | undefined) ?? ev.formType;
  const criteria = await withLlm(() => suggestAdditionalCriteria(llm(), osp, formType));
  return { criteria };
});

// ------------------------------------------------------------------ demo

/** „Przywróć dane demo” — restores the fictional demo office (prototype only; available before login). */
export const resetDemoData = onCall({ timeoutSeconds: 300 }, async (req) => {
  if (req.auth && (req.auth.token as { officeId?: string }).officeId !== DEMO_OFFICE_ID) {
    throw new HttpsError('permission-denied', 'Reset dotyczy wyłącznie urzędu demonstracyjnego.');
  }
  await clearDemoOffice();
  await seedDemo({ createAccounts: true });
  return { ok: true };
});

