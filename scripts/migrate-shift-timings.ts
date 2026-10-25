#!/usr/bin/env tsx
/**
 * ShiftSync AI - Official Firestore Shift Timings Migration Script
 * 
 * Standard Timings:
 * - 1ST · Day:   07:30 – 16:30 (Electric Cyan)
 * - 2ND · Swing: 12:30 – 20:30 (Emerald Mint)
 * - 3RD · Night: 20:30 – 07:30 (Quantum Indigo, overnight wrap)
 * - GEN · Day:   09:00 – 18:00 (Warm Amber)
 * - WO · Rest:   00:00 – 00:00 (Muted Slate)
 * - CO · Rest:   09:00 – 17:00 (Slate with Cyan Outline)
 * 
 * Usage:
 *   npx tsx scripts/migrate-shift-timings.ts [options]
 * 
 * Options:
 *   --dry-run       Preview the migration without making any changes to Firestore
 *   --seed-presets  Ensure all canonical preset shift templates exist in shiftTemplates
 *   --verbose       Print every individual document change detail
 *   --force         Skip interactive confirmation
 */

import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import {
  planShiftTimingsMigration,
  executeShiftTimingsMigration,
  OFFICIAL_SHIFT_STANDARDS,
} from '../src/utils/shiftMigration.js';

// Load Firebase configuration
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error(`\x1b[31m[ERROR]\x1b[0m Config file not found at: ${configPath}`);
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase App, Auth & Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');
const seedPresets = args.includes('--seed-presets') || args.includes('-s');
const isVerbose = args.includes('--verbose') || args.includes('-v');

// Optional auth parameters
const emailArg = args.find((a) => a.startsWith('--email='))?.split('=')[1] || process.env.ADMIN_EMAIL || process.env.FIREBASE_ADMIN_EMAIL;
const passwordArg = args.find((a) => a.startsWith('--password='))?.split('=')[1] || process.env.ADMIN_PASSWORD || process.env.FIREBASE_ADMIN_PASSWORD;
const tokenArg = args.find((a) => a.startsWith('--token='))?.split('=')[1] || process.env.FIREBASE_AUTH_TOKEN;

async function main() {
  console.log('\n============================================================');
  console.log('\x1b[1m\x1b[36m⚡ SHIFTSYNC AI — FIRESTORE TIMING MIGRATION PROTOCOL\x1b[0m');
  console.log('============================================================');
  console.log(`Database Target : \x1b[33m${firebaseConfig.firestoreDatabaseId}\x1b[0m`);
  console.log(`Project ID      : \x1b[33m${firebaseConfig.projectId}\x1b[0m`);
  console.log(`Execution Mode  : ${isDryRun ? '\x1b[33mDRY RUN (Read-Only Preview)\x1b[0m' : '\x1b[32mLIVE COMMITTED MIGRATION\x1b[0m'}`);
  console.log(`Seed Presets    : ${seedPresets ? '\x1b[32mENABLED\x1b[0m' : '\x1b[90mDISABLED\x1b[0m'}`);
  console.log('------------------------------------------------------------\n');

  if (tokenArg) {
    try {
      console.log(`Authenticating with custom token...`);
      await signInWithCustomToken(auth, tokenArg);
      console.log(`\x1b[32m✔ Authenticated as:\x1b[0m ${auth.currentUser?.email || auth.currentUser?.uid}`);
    } catch (authErr) {
      console.error(`\x1b[31m[AUTH ERROR]\x1b[0m Failed to sign in with token:`, authErr);
    }
  } else if (emailArg && passwordArg) {
    try {
      console.log(`Authenticating with email: ${emailArg}...`);
      await signInWithEmailAndPassword(auth, emailArg, passwordArg);
      console.log(`\x1b[32m✔ Authenticated as:\x1b[0m ${auth.currentUser?.email}`);
    } catch (authErr) {
      console.error(`\x1b[31m[AUTH ERROR]\x1b[0m Failed to sign in with email/password:`, authErr);
    }
  }

  console.log('\x1b[1mStandard Timings Enforced:\x1b[0m');
  Object.values(OFFICIAL_SHIFT_STANDARDS).forEach((spec) => {
    console.log(
      `  • \x1b[36m${spec.type.padEnd(12)}\x1b[0m : \x1b[1m${spec.startTime} – ${spec.endTime}\x1b[0m (${spec.canonicalName})`
    );
  });
  console.log('\nAnalyzing Firestore collections (\x1b[36mshifts\x1b[0m, \x1b[36mshiftTemplates\x1b[0m)...');

  const startTime = Date.now();
  const summary = await planShiftTimingsMigration(db, { seedPresets });

  console.log('\n------------------------------------------------------------');
  console.log('\x1b[1mSCAN RESULTS & PLANNED MUTATIONS:\x1b[0m');
  console.log('------------------------------------------------------------');
  console.log(`• Shifts scanned           : ${summary.totalScannedShifts}`);
  console.log(`  - Requiring timing sync  : \x1b[33m${summary.shiftsToUpdate}\x1b[0m`);
  console.log(`  - Already up-to-date     : \x1b[32m${summary.shiftsUnchanged}\x1b[0m`);
  console.log(`• Shift Templates scanned  : ${summary.totalScannedTemplates}`);
  console.log(`  - Requiring updates      : \x1b[33m${summary.templatesToUpdate}\x1b[0m`);
  console.log(`  - Missing presets to seed: \x1b[36m${summary.templatesCreated}\x1b[0m`);
  console.log(`  - Unchanged              : \x1b[32m${summary.templatesUnchanged}\x1b[0m`);
  console.log(`------------------------------------------------------------`);
  console.log(`Total Planned Mutations    : \x1b[1m\x1b[33m${summary.items.length}\x1b[0m`);

  if (summary.errors.length > 0) {
    console.error('\n\x1b[31m[SCAN ERRORS DETECTED]:\x1b[0m');
    summary.errors.forEach((err) => console.error(`  ✕ ${err}`));

    if (summary.errors.some((e) => e.toLowerCase().includes('permission'))) {
      console.log('\n\x1b[33m💡 FIRESTORE AUTHENTICATION NOTICE:\x1b[0m');
      console.log('   Firestore Security Rules enforce strict role-based access control (Admin role required).');
      console.log('   You have two ways to execute this migration:');
      console.log('   1. \x1b[1mIn the Web UI\x1b[0m: Open the ShiftSync app in your browser, log in as an admin');
      console.log('      (muthuaravindan3@gmail.com), navigate to Preset Protocols or Dashboard Tools,');
      console.log('      and click "Run Firestore Timings Migration".');
      console.log('   2. \x1b[1mFrom CLI\x1b[0m: Provide admin credentials:');
      console.log('      npx tsx scripts/migrate-shift-timings.ts --email=<admin_email> --password=<admin_password>');
    }
  }

  // Print itemized changes
  if (summary.items.length > 0) {
    console.log('\n\x1b[1mDetailed Mutation Plan:\x1b[0m');
    const displayItems = isVerbose ? summary.items : summary.items.slice(0, 15);

    displayItems.forEach((item, index) => {
      const prev = item.current.startTime
        ? `${item.current.type} (${item.current.startTime}–${item.current.endTime})`
        : 'None (missing)';
      const next = `${item.proposed.type} (${item.proposed.startTime}–${item.proposed.endTime})`;
      console.log(
        `  ${String(index + 1).padStart(3, ' ')}. [\x1b[36m${item.collectionName}\x1b[0m] ${item.label}`
      );
      console.log(`       \x1b[90mCurrent  :\x1b[0m \x1b[31m${prev}\x1b[0m`);
      console.log(`       \x1b[90mProposed :\x1b[0m \x1b[32m${next}\x1b[0m (${item.reason})`);
    });

    if (!isVerbose && summary.items.length > 15) {
      console.log(`  ... and ${summary.items.length - 15} more items (pass --verbose to see all).`);
    }
  }

  if (isDryRun) {
    console.log('\n\x1b[33m[DRY RUN COMPLETE]\x1b[0m No mutations were committed to Firestore.');
    console.log('To execute this migration live against Firestore, run:');
    console.log('  \x1b[1m\x1b[32mnpm run migrate:shifts\x1b[0m\n');
    process.exit(0);
  }

  if (summary.items.length === 0) {
    console.log('\n\x1b[32m[ALL UP TO DATE]\x1b[0m All shifts and presets already match official standards. No migration needed.\n');
    process.exit(0);
  }

  console.log('\n\x1b[1mExecuting Firestore Batch Migration...\x1b[0m');
  const result = await executeShiftTimingsMigration(db, summary, ({ completed, total, currentItem }) => {
    const pct = Math.round((completed / total) * 100);
    process.stdout.write(`\r  Progress: [${completed}/${total}] ${pct}% · ${currentItem || ''}          `);
  });

  const durationMs = Date.now() - startTime;
  console.log('\n\n============================================================');
  if (result.success) {
    console.log('\x1b[1m\x1b[32m✔ FIRESTORE MIGRATION COMPLETED SUCCESSFULLY!\x1b[0m');
    console.log(`Committed Updates : \x1b[32m${result.updatedCount}\x1b[0m documents`);
    console.log(`Elapsed Time      : ${(durationMs / 1000).toFixed(2)}s`);
  } else {
    console.log('\x1b[1m\x1b[31m✖ MIGRATION COMPLETED WITH ERRORS\x1b[0m');
    console.log(`Updated Documents : ${result.updatedCount}`);
    console.log(`Errors Encountered: ${result.errors.length}`);
    result.errors.forEach((e) => console.error(`  - ${e}`));
  }
  console.log('============================================================\n');

  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error('\n\x1b[31m[FATAL ERROR]:\x1b[0m', err);
  process.exit(1);
});
