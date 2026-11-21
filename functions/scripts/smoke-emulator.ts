/*
 * End-to-end smoke test against the Firebase emulators (auth, firestore, functions):
 *   npm run emulators   (root, other terminal)  →  npx tsx scripts/smoke-emulator.ts
 * Uses the web SDK exactly like the UI: queries constrained as the rules require, domain codec, callables.
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  connectFirestoreEmulator, collection, doc, DocumentReference, getDoc, getDocs, getFirestore, query, serverTimestamp, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { DEMO_PASSWORD, decode, encode, recalc, type Evaluation, type FirestoreAdapter, type Score } from '@kompas/domain';

const app = initializeApp({ apiKey: 'demo', projectId: 'demo-kompas' });
const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, 'europe-central2');
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const fs: FirestoreAdapter = {
  ref: (c, id) => doc(db, c, id),
  isRef: (v): v is DocumentReference => v instanceof DocumentReference,
  timestamp: (d) => Timestamp.fromDate(d),
  isTimestamp: (v): v is Timestamp => v instanceof Timestamp,
};
let failures = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`);
};
const as = async (email: string) => {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, email, DEMO_PASSWORD);
};
const denied = async (p: Promise<unknown>) => p.then(() => false, (e) => String(e.code ?? e).includes('permission'));
const call = <T>(name: string, data: unknown) => httpsCallable<unknown, T>(fns, name)(data).then((r) => r.data);

await call('resetDemoData', {});
check('resetDemoData (before login)', true);

await as('marta.zielinska@demo.kompas.local');
const token = await auth.currentUser!.getIdTokenResult();
check('custom claims', JSON.stringify(token.claims.roles) === '["SUPERVISOR"]' && token.claims.officeId === 'MC');
const me = doc(db, 'users', 'sup_dc');
const mine = await getDocs(query(collection(db, 'evaluations'), where('officeId', '==', 'MC'), where('supervisorId', '==', me)));
check('supervisor lists own evaluations', mine.docs.map((d) => d.id).sort().join() === 'ev_mazur_first,ev_wojcik_2026', mine.docs.map((d) => d.id).join());
check('cannot read another supervisor’s evaluation', await denied(getDoc(doc(db, 'evaluations', 'ev_kaczmarek_2027'))));

// path A: Mazur — scores, exam, final talk
const snap = await getDoc(doc(db, 'evaluations', 'ev_mazur_first'));
const ev = decode<Evaluation>(fs, snap.data(), snap.id);
check('codec: calendar dates and refs', ev.deadlines.reportDueFrom === '2026-10-03' && ev.employeeId === 'emp_mazur');
const filled = recalc({
  ...ev,
  criteriaAssessments: ev.criteriaAssessments.map((c, i) => ({ ...c, finalScore: ([3, 5, 5, 5, 7] as Score[])[i] })),
  firstEvalRequirements: { examPassed: 'YES', reportSubmittedOnTime: 'YES' },
  deadlines: { ...ev.deadlines, finalTalkDate: '2026-11-20' },
  status: 'FINAL_TALK_DONE',
  texts: { ...ev.texts, developmentPlan: 'Szkolenie z analizy ryzyka.' },
});
const changed = encode(fs, { criteriaAssessments: filled.criteriaAssessments, firstEvalRequirements: filled.firstEvalRequirements, deadlines: filled.deadlines, status: filled.status, texts: filled.texts }) as Record<string, unknown>;
await updateDoc(doc(db, 'evaluations', ev.id), { ...changed, updatedAt: serverTimestamp() });
check('supervisor saves changed fields', true);
check('client cannot set COMPLETED', await denied(updateDoc(doc(db, 'evaluations', ev.id), { status: 'COMPLETED' })));
check('client cannot write summary', await denied(updateDoc(doc(db, 'evaluations', ev.id), { summary: { finalResult: 'POSITIVE' } })));
const early = await call('completeEvaluation', { evaluationId: ev.id }).then(() => null, (e) => e.message as string);
check('completeEvaluation requires department head approval', !!early && /kierujący komórką/.test(early), early ?? '');

await as('pawel.kaminski@demo.kompas.local');
await updateDoc(doc(db, 'evaluations', ev.id), { departmentHeadApprovedAt: serverTimestamp(), updatedAt: serverTimestamp() });
check('department head approves', true);

await as('marta.zielinska@demo.kompas.local');
const res = await call<{ summary: { averageScore: number; finalResult: string } }>('completeEvaluation', { evaluationId: ev.id });
check('completeEvaluation: 3,5,5,5,7 → POSITIVE, 5.00', res.summary.finalResult === 'POSITIVE' && res.summary.averageScore === 5, JSON.stringify(res.summary));
check('edit after COMPLETED rejected', await denied(updateDoc(doc(db, 'evaluations', ev.id), { 'texts.justification': 'zmiana' })));
await updateDoc(doc(db, 'evaluations', ev.id), { status: 'ACKNOWLEDGED', 'deadlines.acknowledgedAt': Timestamp.fromDate(new Date('2026-11-20T23:00:00Z')), updatedAt: serverTimestamp() });
check('COMPLETED → ACKNOWLEDGED allowed', true);

await as('joanna.dabrowska@demo.kompas.local');
check('HR cannot read evaluations', await denied(getDoc(doc(db, 'evaluations', ev.id))));
await new Promise((r) => setTimeout(r, 2500)); // trigger
const t = await getDoc(doc(db, 'evaluation_tracking', ev.id));
check('tracking synced by trigger, without result', t.get('status') === 'ACKNOWLEDGED' && !JSON.stringify(t.data()).match(/POSITIVE|summary|finalScore/), t.get('status'));
const all = await getDocs(query(collection(db, 'evaluation_tracking'), where('officeId', '==', 'MC')));
check('HR lists tracking', all.size === 5, String(all.size));

await as('marta.zielinska@demo.kompas.local');
const ai = await call('askFormalAssistant', { question: 'Ile dni na sprzeciw?' }).then(() => 'ok', (e) => `${e.code}: ${e.message}`);
// with a key the assistant answers; without one it must fail with a readable error, never "internal"
check('assistant answers or fails gracefully', ai === 'ok' || !ai.includes('internal'), ai);

console.log(failures ? `\n${failures} FAILED` : '\nALL OK');
process.exit(failures ? 1 : 0);
