// Firestore rules tests (schema § 8) — run on the emulator: npm run test:rules (root)
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const OFFICE = 'MC';
const claims: Record<string, { roles: string[]; officeId: string }> = {
  sup: { roles: ['SUPERVISOR'], officeId: OFFICE },
  sup2: { roles: ['SUPERVISOR'], officeId: OFFICE },
  head: { roles: ['DEPARTMENT_HEAD'], officeId: OFFICE },
  hr: { roles: ['HR_ADMIN'], officeId: OFFICE },
  otherOffice: { roles: ['SUPERVISOR', 'HR_ADMIN'], officeId: 'KPRM' },
};
const as = (uid: string) => env.authenticatedContext(uid, claims[uid]).firestore() as unknown as Firestore;
const u = (db: Firestore, uid: string) => doc(db, 'users', uid);
const day = Timestamp.fromDate(new Date('2026-11-20T23:00:00Z'));

function evaluation(db: Firestore, over: Record<string, unknown> = {}) {
  return {
    officeId: OFFICE,
    type: 'FIRST_EVALUATION',
    formType: 'FIRST',
    status: 'DRAFT',
    employeeId: doc(db, 'employees', 'emp1'),
    employeeName: 'Jan Testowy',
    supervisorId: u(db, 'sup'),
    departmentHeadId: u(db, 'head'),
    departmentHeadApprovedAt: null,
    deadlines: { initialTalkDue: day, acknowledgedAt: null, objectionDeadline: null },
    criteriaAssessments: [],
    summary: null,
    completedAt: null,
    updatedAt: day,
    ...over,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kompas',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '../../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const uid of Object.keys(claims)) await setDoc(u(db, uid), { officeId: claims[uid].officeId, roles: claims[uid].roles });
    await setDoc(doc(db, 'employees', 'emp1'), { officeId: OFFICE, supervisorId: u(db, 'sup'), departmentHeadId: u(db, 'head'), hireDate: day, osp: {}, absences: [] });
    await setDoc(doc(db, 'employees', 'emp2'), { officeId: OFFICE, supervisorId: u(db, 'sup2'), departmentHeadId: u(db, 'head'), hireDate: day, osp: {}, absences: [] });
    await setDoc(doc(db, 'evaluations', 'e1'), evaluation(db));
    await setDoc(doc(db, 'evaluations', 'done'), evaluation(db, { status: 'COMPLETED', summary: { finalResult: 'POSITIVE' } }));
    await setDoc(doc(db, 'evaluation_tracking', 'e1'), { officeId: OFFICE, evaluationId: doc(db, 'evaluations', 'e1'), supervisorId: u(db, 'sup'), status: 'DRAFT' });
    await setDoc(doc(db, 'reminders', 'r1'), { officeId: OFFICE, recipientUserId: u(db, 'sup'), sentByUserId: u(db, 'hr'), type: 'MANUAL_HR', status: 'SENT', message: 'x' });
    await setDoc(doc(db, 'ai_sessions', 's1'), { officeId: OFFICE, userId: u(db, 'sup'), mode: 'FORMAL_ASSISTANT' });
    await setDoc(doc(db, 'ai_sessions', 's1', 'messages', 'm1'), { role: 'assistant', content: 'x' });
  });
});
afterAll(async () => env?.cleanup());

describe('evaluations', () => {
  it('HR_ADMIN cannot read evaluations, but reads evaluation_tracking', async () => {
    await assertFails(getDoc(doc(as('hr'), 'evaluations', 'e1')));
    await assertSucceeds(getDoc(doc(as('hr'), 'evaluation_tracking', 'e1')));
    await assertSucceeds(getDocs(query(collection(as('hr'), 'evaluation_tracking'), where('officeId', '==', OFFICE))));
  });

  it('supervisor reads own evaluations only; another office never', async () => {
    await assertSucceeds(getDoc(doc(as('sup'), 'evaluations', 'e1')));
    await assertFails(getDoc(doc(as('sup2'), 'evaluations', 'e1')));
    await assertFails(getDoc(doc(as('otherOffice'), 'evaluation_tracking', 'e1')));
  });

  it('supervisor cannot create an evaluation for someone else’s employee', async () => {
    const db = as('sup');
    await assertSucceeds(setDoc(doc(db, 'evaluations', 'n1'), evaluation(db)));
    await assertFails(setDoc(doc(db, 'evaluations', 'n2'), evaluation(db, { employeeId: doc(db, 'employees', 'emp2') })));
    await assertFails(setDoc(doc(db, 'evaluations', 'n3'), evaluation(db, { supervisorId: u(db, 'sup2') })));
  });

  it('client cannot write summary nor set COMPLETED', async () => {
    const db = as('sup');
    await assertFails(updateDoc(doc(db, 'evaluations', 'e1'), { summary: { finalResult: 'POSITIVE' } }));
    await assertFails(updateDoc(doc(db, 'evaluations', 'e1'), { status: 'COMPLETED' }));
    await assertFails(setDoc(doc(db, 'evaluations', 'n4'), evaluation(db, { summary: { finalResult: 'POSITIVE' } })));
    await assertSucceeds(updateDoc(doc(db, 'evaluations', 'e1'), { status: 'INITIAL_TALK_DONE', currentStep: 'report' }));
  });

  it('edits after COMPLETED are rejected; only → ACKNOWLEDGED with acknowledgedAt', async () => {
    const db = as('sup');
    await assertFails(updateDoc(doc(db, 'evaluations', 'done'), { criteriaAssessments: [{ finalScore: 7 }] }));
    await assertFails(updateDoc(doc(db, 'evaluations', 'done'), { status: 'ACKNOWLEDGED' }));
    await assertSucceeds(updateDoc(doc(db, 'evaluations', 'done'), { status: 'ACKNOWLEDGED', 'deadlines.acknowledgedAt': day, updatedAt: day }));
    await assertFails(updateDoc(doc(db, 'evaluations', 'done'), { status: 'COMPLETED' }));
  });

  it('department head: reads path A, writes only the approval after the final talk', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore() as unknown as Firestore, 'evaluations', 'e1'), { status: 'FINAL_TALK_DONE' }));
    const db = as('head');
    await assertSucceeds(getDoc(doc(db, 'evaluations', 'e1')));
    await assertFails(updateDoc(doc(db, 'evaluations', 'e1'), { departmentHeadApprovedAt: serverTimestamp(), status: 'COMPLETED' }));
    await assertSucceeds(updateDoc(doc(db, 'evaluations', 'e1'), { departmentHeadApprovedAt: serverTimestamp() }));
    // the supervisor may not set the approval
    await assertFails(updateDoc(doc(as('sup'), 'evaluations', 'e1'), { departmentHeadApprovedAt: serverTimestamp() }));
  });
});

describe('other collections', () => {
  it('nobody writes evaluation_tracking from the client', async () => {
    await assertFails(setDoc(doc(as('hr'), 'evaluation_tracking', 'x'), { officeId: OFFICE }));
    await assertFails(updateDoc(doc(as('sup'), 'evaluation_tracking', 'e1'), { status: 'COMPLETED' }));
  });

  it('employees: supervisor edits osp/absences only', async () => {
    const db = as('sup');
    await assertSucceeds(updateDoc(doc(db, 'employees', 'emp1'), { absences: [{ from: day, to: day }] }));
    await assertFails(updateDoc(doc(db, 'employees', 'emp1'), { hireDate: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')) }));
    await assertFails(updateDoc(doc(db, 'employees', 'emp1'), { supervisorId: u(db, 'sup2') }));
    await assertFails(getDoc(doc(as('sup2'), 'employees', 'emp1')));
  });

  it('reminders: HR creates, recipient marks READ', async () => {
    const hr = as('hr');
    await assertSucceeds(setDoc(doc(hr, 'reminders', 'r2'), { officeId: OFFICE, recipientUserId: u(hr, 'sup'), sentByUserId: u(hr, 'hr'), type: 'MANUAL_HR', status: 'SENT', message: 'x', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('sup'), 'reminders', 'r3'), { officeId: OFFICE, recipientUserId: u(hr, 'sup2'), sentByUserId: u(hr, 'sup'), type: 'MANUAL_HR', status: 'SENT' }));
    await assertSucceeds(updateDoc(doc(as('sup'), 'reminders', 'r1'), { status: 'READ' }));
    await assertFails(updateDoc(doc(as('sup'), 'reminders', 'r1'), { message: 'zmiana' }));
    await assertFails(getDoc(doc(as('sup2'), 'reminders', 'r1')));
  });

  it('users: roles cannot be written by the client', async () => {
    await assertFails(updateDoc(doc(as('sup'), 'users', 'sup'), { roles: ['HR_ADMIN'] }));
    await assertSucceeds(getDoc(doc(as('sup'), 'users', 'sup')));
    await assertFails(getDoc(doc(as('sup'), 'users', 'hr')));
  });

  it('ai_sessions: owner only; messages are written by functions only', async () => {
    await assertSucceeds(getDocs(collection(as('sup'), 'ai_sessions', 's1', 'messages')));
    await assertFails(getDoc(doc(as('sup2'), 'ai_sessions', 's1')));
    await assertFails(setDoc(doc(as('sup'), 'ai_sessions', 's1', 'messages', 'm2'), { role: 'assistant', content: 'fake', citations: [] }));
  });
});

describe('users — missing profile', () => {
  it('reading one’s own non-existent profile is allowed (no rule evaluation error)', async () => {
    const ctx = env.authenticatedContext('newcomer', { roles: ['SUPERVISOR'], officeId: OFFICE }).firestore() as unknown as Firestore;
    await assertSucceeds(getDoc(doc(ctx, 'users', 'newcomer')));
    await assertFails(getDoc(doc(as('sup'), 'users', 'nobody-yet')));
  });
});
