/*
 * Seeds Firestore + Firebase Auth with demo data.
 *   Emulator: npm run seed:emulator   (root)
 *   Project:  GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> npm run seed:prod
 * Demo accounts get the password DEMO_PASSWORD from @kompas/domain.
 *
 * The target is passed as an argument (not via `VAR=x` in package.json) so the script also works
 * on Windows, where npm runs scripts through cmd.exe. Env vars must be set before firebase-admin
 * is initialised, hence the dynamic imports below.
 */
const target = process.argv[2];
if (target === 'emulator') {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  process.env.GCLOUD_PROJECT ??= 'demo-kompas';
} else if (target === 'prod') {
  process.env.GCLOUD_PROJECT ??= 'kompaskompetencji';
} else {
  console.error('Usage: tsx src/seedScript.ts <emulator|prod>');
  process.exit(2);
}

const { DEMO_PASSWORD, DEMO_USERS } = await import('@kompas/domain');
const { clearDemoOffice, seedDemo } = await import('./demoSeed');

try {
  await clearDemoOffice();
  await seedDemo({ createAccounts: true });
  console.log(`Seed OK (${process.env.GCLOUD_PROJECT}). Hasło: ${DEMO_PASSWORD}. Konta: ${DEMO_USERS.map((u) => u.email).join(', ')}`);
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}

export {};
