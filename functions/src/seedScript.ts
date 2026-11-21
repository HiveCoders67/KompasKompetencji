/*
 * Seeds Firestore + Firebase Auth with demo data.
 *   Emulator: npm run seed:emulator   (root)
 *   Project:  GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> npm run seed:prod
 * Demo accounts get the password DEMO_PASSWORD from @kompas/domain.
 */
import { DEMO_PASSWORD, DEMO_USERS } from '@kompas/domain';
import { clearDemoOffice, seedDemo } from './demoSeed';

clearDemoOffice()
  .then(() => seedDemo({ createAccounts: true }))
  .then(() => {
    console.log(`Seed OK (${process.env.GCLOUD_PROJECT}). Hasło: ${DEMO_PASSWORD}. Konta: ${DEMO_USERS.map((u) => u.email).join(', ')}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
