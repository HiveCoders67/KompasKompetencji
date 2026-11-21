import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  addDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  acknowledge,
  decode,
  encode,
  today,
  type AiMessage,
  type AppUser,
  type CompetencyCode,
  type Employee,
  type Evaluation,
  type EvaluationSummary,
  type EvaluationTracking,
  type FirestoreAdapter,
  type FormType,
  type Osp,
  type Reminder,
} from '@kompas/domain';
import { db, functions } from '../firebase';

/*
 * Firestore access for the UI. Domain objects (string ids, DateOnly, ISO instants) ↔ Firestore
 * (DocumentReference, Timestamp at 00:00 Europe/Warsaw) via the shared codec from @kompas/domain.
 * Queries always constrain officeId and the caller's reference — exactly what the rules allow.
 */

const adapter: FirestoreAdapter = {
  ref: (c, id) => doc(db, c, id),
  isRef: (v): v is DocumentReference => v instanceof DocumentReference,
  timestamp: (d) => Timestamp.fromDate(d),
  isTimestamp: (v): v is Timestamp => v instanceof Timestamp,
};
const enc = (v: unknown) => encode(adapter, v) as Record<string, unknown>;
const userRef = (uid: string) => doc(db, 'users', uid);

type Unsub = () => void;

function watchList<T>(path: string, constraints: QueryConstraint[], cb: (items: T[]) => void, onError?: (e: Error) => void): Unsub {
  return onSnapshot(
    query(collection(db, path), ...constraints),
    (snap) => cb(snap.docs.map((d) => decode<T>(adapter, d.data(), d.id))),
    (e) => (onError ? onError(e) : console.error(path, e)),
  );
}

export async function getUser(uid: string): Promise<AppUser | null> {
  const s = await getDoc(userRef(uid));
  return s.exists() ? decode<AppUser>(adapter, s.data(), s.id) : null;
}

export const watchSupervisorEvaluations = (u: AppUser, cb: (e: Evaluation[]) => void) =>
  watchList<Evaluation>('evaluations', [where('officeId', '==', u.officeId), where('supervisorId', '==', userRef(u.uid))], cb);

export const watchHeadEvaluations = (u: AppUser, cb: (e: Evaluation[]) => void) =>
  watchList<Evaluation>(
    'evaluations',
    [where('officeId', '==', u.officeId), where('departmentHeadId', '==', userRef(u.uid)), where('type', '==', 'FIRST_EVALUATION')],
    cb,
  );

export const watchEmployees = (u: AppUser, by: 'supervisorId' | 'departmentHeadId', cb: (e: Employee[]) => void) =>
  watchList<Employee>('employees', [where('officeId', '==', u.officeId), where(by, '==', userRef(u.uid))], cb);

export const watchTracking = (u: AppUser, cb: (t: EvaluationTracking[]) => void) =>
  watchList<EvaluationTracking>('evaluation_tracking', [where('officeId', '==', u.officeId)], cb);

export const watchMyReminders = (u: AppUser, cb: (r: Reminder[]) => void) =>
  watchList<Reminder>('reminders', [where('officeId', '==', u.officeId), where('recipientUserId', '==', userRef(u.uid))], cb);

export const watchOfficeReminders = (u: AppUser, cb: (r: Reminder[]) => void) =>
  watchList<Reminder>('reminders', [where('officeId', '==', u.officeId), orderBy('createdAt', 'desc')], cb);

export function watchEvaluation(id: string, cb: (e: Evaluation | null) => void, onError: (e: Error) => void): Unsub {
  return onSnapshot(
    doc(db, 'evaluations', id),
    (s) => cb(s.exists() ? decode<Evaluation>(adapter, s.data(), s.id) : null),
    onError,
  );
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const s = await getDoc(doc(db, 'employees', id));
  return s.exists() ? decode<Employee>(adapter, s.data(), s.id) : null;
}

export const newEvaluationId = () => doc(collection(db, 'evaluations')).id;

export async function createEvaluation(ev: Evaluation) {
  await setDoc(doc(db, 'evaluations', ev.id), { ...enc(ev), updatedAt: serverTimestamp() });
}

/** Fields only the server (or the department head) writes — never sent by the supervisor's autosave. */
const SERVER_FIELDS = new Set(['summary', 'completedAt', 'departmentHeadApprovedAt', 'updatedAt', 'id']);

/** Writes only top-level fields that changed (rules compare affected keys). */
export async function saveEvaluation(prev: Evaluation, next: Evaluation) {
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof Evaluation)[]) {
    if (SERVER_FIELDS.has(key)) continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) changed[key] = next[key];
  }
  if (!Object.keys(changed).length) return false;
  await updateDoc(doc(db, 'evaluations', next.id), { ...enc(changed), updatedAt: serverTimestamp() });
  return true;
}

export async function saveEmployeeOsp(employeeId: string, osp: Osp) {
  await updateDoc(doc(db, 'employees', employeeId), { osp: enc({ osp }).osp });
}

export async function approveFirstEvaluation(id: string) {
  await updateDoc(doc(db, 'evaluations', id), { departmentHeadApprovedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

/** § 12 rozp. 2016 / § 11 rozp. 2015 — COMPLETED → ACKNOWLEDGED (the only change allowed after completion). */
export async function acknowledgeEvaluation(ev: Evaluation, onDate = today()) {
  const next = acknowledge(ev, onDate, new Date().toISOString());
  const d = enc({ deadlines: next.deadlines }).deadlines as Record<string, unknown>;
  await updateDoc(doc(db, 'evaluations', ev.id), {
    status: 'ACKNOWLEDGED',
    'deadlines.acknowledgedAt': d.acknowledgedAt,
    'deadlines.objectionDeadline': d.objectionDeadline,
    updatedAt: serverTimestamp(),
  });
}

export async function markReminderRead(id: string) {
  await updateDoc(doc(db, 'reminders', id), { status: 'READ' });
}

export async function sendReminder(hr: AppUser, t: EvaluationTracking, message: string) {
  await addDoc(collection(db, 'reminders'), {
    officeId: hr.officeId,
    evaluationId: doc(db, 'evaluations', t.evaluationId),
    recipientUserId: userRef(t.supervisorId),
    sentByUserId: userRef(hr.uid),
    type: 'MANUAL_HR',
    message,
    status: 'SENT',
    createdAt: serverTimestamp(),
  });
}

// ------------------------------------------------------------------ Cloud Functions

const call = <Req, Res>(name: string) => {
  const fn = httpsCallable<Req, Res>(functions, name, { timeout: 130_000 });
  return async (data: Req) => (await fn(data)).data;
};

export const completeEvaluationFn = call<{ evaluationId: string }, { summary: EvaluationSummary }>('completeEvaluation');
export const askFormalFn = call<
  { question: string; evaluationId?: string; step?: string; path?: 'A' | 'B'; sessionId?: string },
  { sessionId: string; message: AiMessage }
>('askFormalAssistant');
export type InterviewTask = 'AGENDA' | 'FEEDBACK' | 'JUSTIFICATION' | 'DEVELOPMENT_PLAN' | 'DIFFICULT_TALK' | 'CHAT';
export const askInterviewFn = call<
  { task: InterviewTask; evaluationId: string; message?: string; step?: string; sessionId?: string },
  { sessionId: string; message: AiMessage; task: InterviewTask }
>('askInterviewAssistant');
export const suggestCriteriaFn = call<
  { evaluationId: string; osp?: Osp; formType?: FormType },
  { criteria: { code: CompetencyCode; name: string; reason: string }[] }
>('suggestCriteria');
export const resetDemoFn = call<Record<string, never>, { ok: boolean }>('resetDemoData');

/** User-facing message for callable errors (quota → the exact message from docs/03 § 1). */
export function callableError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err.code === 'functions/resource-exhausted') return 'Wyczerpano dostępne zasoby asystenta AI. Spróbuj ponownie później.';
  if (err.code === 'functions/internal' || !err.message) return 'Wystąpił błąd serwera. Spróbuj ponownie.';
  return err.message;
}
