#!/usr/bin/env node
/**
 * scripts/migrations/2026-05-multi-twin.js
 *
 * One-time migration: drop the unique index on `digitaltwins.user`.
 *
 * BACKGROUND
 * ──────────
 * The DigitalTwin Mongoose schema used to declare
 *   `user: { ..., unique: true }`
 * which created a unique index `user_1` in MongoDB. Plan-gated multi-twin
 * support (free=1, pro=10) requires us to allow multiple twin docs per
 * user, so that schema attribute was removed.
 *
 * Mongoose, by design, NEVER drops an existing index just because the
 * schema attribute changed. Without this migration, in every environment
 * where the old index exists, attempting to insert a second twin will
 * fail with `E11000 duplicate key error collection: ... index: user_1`
 * and a paid user can never have more than one twin.
 *
 * WHAT THIS DOES
 * ──────────────
 * 1. Connects to MongoDB using the same MONGO_URI as the app.
 * 2. Inspects `digitaltwins.indexes`.
 * 3. If `user_1` exists AND is unique → drops it. Idempotent: safe to
 *    run multiple times; if the index is already gone, this is a no-op.
 * 4. (Optional) Recreates a NON-unique index on `user` so queries by
 *    user still hit an index. Most envs already have this via the
 *    `digitalTwinSchema.index({ user: 1 })` declaration, which Mongoose
 *    will create on next app boot — but we explicitly create here so
 *    the migration leaves the collection fully indexed even if you
 *    haven't restarted the app yet.
 *
 * SAFETY
 * ──────
 * - This is a metadata-only change (no document writes).
 * - Reversible: re-add unique by `db.digitaltwins.createIndex({ user: 1 }, { unique: true })`
 *   but ONLY if every user owns ≤ 1 twin; otherwise the create will fail.
 * - Recommended: take a logical backup of the digitaltwins collection
 *   before running on prod, even though no data is mutated.
 *
 * USAGE
 * ─────
 *   # From digital_twin_backend/
 *   node scripts/migrations/2026-05-multi-twin.js
 *
 *   # Dry-run mode (prints what would happen, makes no changes):
 *   DRY_RUN=1 node scripts/migrations/2026-05-multi-twin.js
 *
 * REQUIRED ENV
 *   MONGO_URI — same connection string the app uses
 */

import "dotenv/config";
import mongoose from "mongoose";

const COLLECTION = "digitaltwins";
const INDEX_NAME = "user_1";

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const log = (...args) => console.log("[migration]", ...args);

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("FATAL: MONGO_URI not set");
    process.exit(1);
  }

  log(`connecting to ${uri.replace(/:[^:@/]+@/, ":***@")}`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const coll = db.collection(COLLECTION);

  log(`inspecting collection "${COLLECTION}"`);
  const indexes = await coll.indexes();
  const target = indexes.find((idx) => idx.name === INDEX_NAME);

  if (!target) {
    log(`✓ index "${INDEX_NAME}" not found — nothing to drop. Migration is a no-op.`);
  } else if (!target.unique) {
    log(`✓ index "${INDEX_NAME}" exists but is not unique — nothing to drop.`);
  } else {
    log(`✗ found unique index "${INDEX_NAME}":`, target);
    if (DRY_RUN) {
      log(`[dry-run] would drop "${INDEX_NAME}"`);
    } else {
      // Pre-flight: refuse to drop if the collection has data that depends
      // on it. There's no real "depends on it" in a non-unique sense, but
      // we DO want to refuse if a user already owns > 1 twin AND we're
      // somehow about to add the unique constraint back (paranoid check
      // for the reverse direction). We're dropping here, so this is fine
      // and the check is a documentation comment only.
      await coll.dropIndex(INDEX_NAME);
      log(`✓ dropped unique index "${INDEX_NAME}"`);
    }
  }

  // Ensure a non-unique compound-free index on user still exists so query
  // performance doesn't regress. This is identical to the one declared in
  // digitalTwinSchema.index({ user: 1 }) — Mongoose's createIndex is a
  // no-op when an equivalent index already exists.
  const hasNonUniqueUser = (await coll.indexes()).some(
    (idx) =>
      idx.name !== INDEX_NAME &&
      idx.key &&
      idx.key.user === 1 &&
      !idx.unique
  );
  if (!hasNonUniqueUser) {
    if (DRY_RUN) {
      log(`[dry-run] would create non-unique index { user: 1 }`);
    } else {
      await coll.createIndex({ user: 1 }, { name: "user_1_nonunique" });
      log(`✓ created non-unique index { user: 1 }`);
    }
  } else {
    log(`✓ non-unique index on { user: 1 } already present`);
  }

  // Sanity check: re-list indexes for the operator's eyeballs.
  const finalIndexes = await coll.indexes();
  log("final indexes on", COLLECTION, ":");
  for (const idx of finalIndexes) {
    log("  -", idx.name, "key:", JSON.stringify(idx.key), idx.unique ? "(unique)" : "");
  }

  await mongoose.disconnect();
  log("done.");
}

main().catch((err) => {
  console.error("[migration] FAILED:", err);
  process.exit(1);
});
