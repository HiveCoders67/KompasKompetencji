import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import {
  COMPETENCIES,
  DEMO_EMPLOYEES,
  DEMO_OFFICE_ID,
  DEMO_PASSWORD,
  DEMO_USERS,
  buildDemoEvaluations,
  buildDemoReminders,
  toTracking,
} from '@kompas/domain';
import { db, toData } from './admin';

/*
 * Demo data (all people fictional). Used by `npm run seed:*` and by the callable `resetDemoData`
 * („Przywróć dane demo” on the login screen). Roles and officeId go to custom claims — rules trust only claims.
 */

const DOMAIN_COLLECTIONS = ['evaluations', 'evaluation_tracking', 'employees', 'reminders', 'ai_sessions'];

export async function clearDemoOffice() {
  for (const name of DOMAIN_COLLECTIONS) {
    const snap = await db.collection(name).where('officeId', '==', DEMO_OFFICE_ID).get();
    for (const doc of snap.docs) await db.recursiveDelete(doc.ref);
  }
}

export async function seedDemo({ createAccounts }: { createAccounts: boolean }) {
  const auth = getAuth();
  for (const u of DEMO_USERS) {
    if (createAccounts) {
      try {
        await auth.createUser({ uid: u.uid, email: u.email, password: DEMO_PASSWORD, displayName: u.displayName });
      } catch (e) {
        if ((e as { code?: string }).code !== 'auth/uid-already-exists') throw e;
        await auth.updateUser(u.uid, { email: u.email, password: DEMO_PASSWORD, displayName: u.displayName });
      }
    }
    await auth.setCustomUserClaims(u.uid, { roles: u.roles, officeId: u.officeId });
    await db.doc(`users/${u.uid}`).set({ ...toData(u), createdAt: FieldValue.serverTimestamp() });
  }
  const batch = db.batch();
  for (const c of COMPETENCIES) batch.set(db.doc(`competencies/${c.code}`), toData(c));
  for (const e of DEMO_EMPLOYEES) batch.set(db.doc(`employees/${e.id}`), toData(e));
  for (const ev of buildDemoEvaluations()) {
    batch.set(db.doc(`evaluations/${ev.id}`), toData(ev));
    batch.set(db.doc(`evaluation_tracking/${ev.id}`), toData(toTracking(ev)));
  }
  for (const r of buildDemoReminders()) batch.set(db.doc(`reminders/${r.id}`), toData(r));
  await batch.commit();
}
