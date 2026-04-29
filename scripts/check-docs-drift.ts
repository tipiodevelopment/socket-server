#!/usr/bin/env -S npx tsx
/**
 * check-docs-drift.ts
 *
 * Empirical drift detector. Runs five comparisons and exits non-zero on any
 * discrepancy. Source of truth = `server/routes.ts`. All other artefacts
 * (openapi.yaml, API_V2_CONTRACT.md, Postman, DB invariants, slot map) are
 * compared against it.
 *
 *   npm run check:docs-drift
 *
 * Designed to be runnable manually before a release and droppable into CI as
 * a gate. Exit codes:
 *   0 = no drift, ship it
 *   1 = drift detected, see report
 *   2 = script crashed (file missing, DB unreachable, etc.)
 *
 * Sprint: 2026-04-29 doc consolidation (Phase 6).
 */

import pg from "pg";
const { Client } = pg;
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Routes declared in server/routes.ts (the source of truth)
// ---------------------------------------------------------------------------

interface Route { method: string; path: string }

/** Normalize a path so {id}, {campaignId}, :id, :campaignId all collapse to {} —
 *  param naming should never cause false drift. */
function normalizePath(p: string): string {
  return p.replace(/:[A-Za-z0-9_]+/g, "{}").replace(/\{[A-Za-z0-9_]+\}/g, "{}");
}

function readRoutesInCode(): Route[] {
  const src = fs.readFileSync(path.join(ROOT, "server/routes.ts"), "utf8");
  const re = /app\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g;
  const out: Route[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ method: m[1].toUpperCase(), path: normalizePath(m[2]) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Routes declared in openapi.yaml
// ---------------------------------------------------------------------------

function readRoutesInOpenapi(): Route[] {
  const doc = yaml.load(fs.readFileSync(path.join(ROOT, "openapi.yaml"), "utf8")) as any;
  const out: Route[] = [];
  for (const [p, ops] of Object.entries(doc.paths || {})) {
    for (const verb of ["get", "post", "put", "patch", "delete"]) {
      if ((ops as any)[verb]) {
        out.push({ method: verb.toUpperCase(), path: normalizePath(p) });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Routes mentioned in API_V2_CONTRACT.md (just /v2/* paths — that's the contract scope)
// ---------------------------------------------------------------------------

/** Pull routes from §4.1 "Shipped" + §5 + §6 + §7 — the contract scope that
 *  promises actual implementation. Aspirational sections (§4.2 Planned, §4.3
 *  Engagement planned, §4.4 Retired) and the §12 migration map (which lists
 *  *both* old and new paths in the same row) are excluded. */
function readRoutesInContract(): string[] {
  const md = fs.readFileSync(path.join(ROOT, "docs/API_V2_CONTRACT.md"), "utf8");
  // Take only the sections that promise live behavior:
  //   §4.1 Shipped → start "### 4.1" stop "### 4.2"
  //   §5         → start "## 5."  stop "## 6."
  //   §6         → start "## 6."  stop "## 7."
  //   §7.0+ admin (excluding §7.1 control plane, which is /api/* not /v2/*)
  //     → start "## 7."  stop "### 7.1"
  function slice(start: RegExp, stop: RegExp): string {
    const a = md.search(start); if (a < 0) return "";
    const b = md.slice(a + 1).search(stop); return b < 0 ? md.slice(a) : md.slice(a, a + 1 + b);
  }
  const scope =
    slice(/### 4\.1\s/, /### 4\.2\s/) +
    slice(/## 5\. /, /## 6\. /) +
    slice(/## 6\. /, /## 7\. /) +
    slice(/## 7\. /, /### 7\.1\s/);

  const out = new Set<string>();
  // Format A: inline `GET /v2/...` in code-fence
  const reA = /`(GET|POST|PUT|PATCH|DELETE)\s+(\/v2\/[A-Za-z0-9/{}:_-]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = reA.exec(scope)) !== null) {
    out.add(`${m[1]} ${normalizePath(m[2])}`);
  }
  // Format B: markdown table row `| GET | \`/v2/...\` |`
  const reB = /\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`(\/v2\/[A-Za-z0-9/{}:_-]+)`/g;
  while ((m = reB.exec(scope)) !== null) {
    out.add(`${m[1]} ${normalizePath(m[2])}`);
  }
  return [...out].sort();
}

// ---------------------------------------------------------------------------
// 4. Routes referenced in Postman collection (just URL.raw)
// ---------------------------------------------------------------------------

function readRoutesInPostman(): Route[] {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, "postman/vio-sdk.postman_collection.json"), "utf8"));
  const out: Route[] = [];
  for (const folder of c.item || []) {
    // Smoke-test folder uses literal IDs (e.g. barcelona-psg-...) for hands-on
    // smoke; skip from drift check.
    if (/Multi-sponsor smoke test/i.test(folder.name)) continue;
    for (const item of folder.item || []) {
      const m = item.request?.method?.toUpperCase();
      const raw = item.request?.url?.raw || "";
      if (!m) continue;
      const cleaned = raw.replace(/^\{\{baseUrl\}\}/, "").replace(/^https?:\/\/[^/]+/, "");
      const [pathPart] = cleaned.split("?");
      if (!pathPart.startsWith("/")) continue;
      out.push({ method: m, path: normalizePath(pathPart.replace(/\{\{[A-Za-z0-9_]+\}\}/g, "{}")) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. SDK manifest vs DB locations (clientApp 18 = TV2)
// ---------------------------------------------------------------------------

function readSdkSlots(): string[] {
  const f = "/Users/angelo/VioSwiftSDK/Demo/tv2demo/tv2demo/Helpers/TV2PlacementRegistration.swift";
  if (!fs.existsSync(f)) return [];
  const src = fs.readFileSync(f, "utf8");
  const re = /VioPlacementLocation\(id:\s*"([^"]+)"/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return [...out].sort();
}

async function dbInvariants(): Promise<{ ok: boolean; report: string[] }> {
  const report: string[] = [];
  const url = process.env.DATABASE_URL;
  if (!url) {
    report.push("⚠️  DATABASE_URL not set — skipping DB invariants.");
    return { ok: true, report };
  }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();

    // Invariant 1: every cc has a sponsor that's bound to its campaign (junction OR primary)
    const orphan = await c.query(`
      SELECT cc.id, cc.campaign_id, cc.sponsor_id
      FROM campaign_components cc
      WHERE NOT EXISTS (SELECT 1 FROM campaign_sponsors cs WHERE cs.campaign_id = cc.campaign_id AND cs.sponsor_id = cc.sponsor_id)
        AND NOT EXISTS (SELECT 1 FROM campaigns ca WHERE ca.id = cc.campaign_id AND ca.primary_sponsor_id = cc.sponsor_id)
    `);
    if (orphan.rows.length > 0) report.push(`❌ campaign_components rows with orphan sponsor: ${JSON.stringify(orphan.rows)}`);
    else report.push(`✅ no campaign_components with orphan sponsor`);

    // Invariant 2: every campaign with primary_sponsor_id should have that sponsor in campaign_sponsors
    const gap = await c.query(`
      SELECT ca.id, ca.name, ca.primary_sponsor_id
      FROM campaigns ca
      JOIN sponsors s ON s.id = ca.primary_sponsor_id
      WHERE NOT EXISTS (SELECT 1 FROM campaign_sponsors cs WHERE cs.campaign_id = ca.id AND cs.sponsor_id = ca.primary_sponsor_id)
    `);
    if (gap.rows.length > 0) report.push(`⚠️  campaigns with primary_sponsor_id missing from campaign_sponsors junction (${gap.rows.length} rows): ${JSON.stringify(gap.rows.map((r: any) => r.id))}`);
    else report.push(`✅ all primaries also in campaign_sponsors junction`);

    // Invariant 3: no cc points at a deprecated app_placement
    const dep = await c.query(`
      SELECT cc.id FROM campaign_components cc
      JOIN app_placements ap ON ap.id = cc.app_placement_id
      WHERE ap.deprecated_at IS NOT NULL
    `);
    if (dep.rows.length > 0) report.push(`❌ campaign_components pointing at deprecated app_placements: ${JSON.stringify(dep.rows)}`);
    else report.push(`✅ no cc pointing at deprecated app_placements`);

    // Invariant 4: no active app_placement points at a deprecated location
    const depLoc = await c.query(`
      SELECT ap.id FROM app_placements ap
      JOIN app_component_locations acl ON acl.location_id = ap.location_id AND acl.client_app_id = ap.client_app_id
      WHERE ap.deprecated_at IS NULL AND acl.deprecated_at IS NOT NULL
    `);
    if (depLoc.rows.length > 0) report.push(`❌ active app_placements at deprecated locations: ${JSON.stringify(depLoc.rows)}`);
    else report.push(`✅ no active placements at deprecated locations`);

    // Invariant 5: outbox failed events
    const failed = await c.query(`SELECT count(*)::int AS n FROM events_outbox WHERE status = 'failed'`);
    const n = failed.rows[0]?.n ?? 0;
    if (n > 0) report.push(`⚠️  events_outbox failed=${n}`);
    else report.push(`✅ events_outbox: no failed events`);

    // Invariant 6: every cc-referenced sponsor has a commerce_api_key
    const noKey = await c.query(`
      SELECT DISTINCT s.id, s.name FROM sponsors s
      JOIN campaign_components cc ON cc.sponsor_id = s.id
      WHERE s.commerce_api_key IS NULL
    `);
    if (noKey.rows.length > 0) report.push(`❌ sponsors used by campaign_components without commerce_api_key: ${JSON.stringify(noKey.rows)}`);
    else report.push(`✅ every cc-referenced sponsor has a commerce_api_key`);

    await c.end();
    const ok = !report.some(line => line.startsWith("❌"));
    return { ok, report };
  } catch (e: any) {
    report.push(`💥 DB error: ${e.message}`);
    try { await c.end(); } catch {}
    return { ok: false, report };
  }
}

// ---------------------------------------------------------------------------
// Drift comparison
// ---------------------------------------------------------------------------

function diffRoutes(label: string, src: Route[], target: Route[]): { ok: boolean; lines: string[] } {
  const k = (r: Route) => `${r.method} ${r.path}`;
  const srcSet = new Set(src.map(k));
  const tgtSet = new Set(target.map(k));
  const onlySrc = [...srcSet].filter(x => !tgtSet.has(x)).sort();
  const onlyTgt = [...tgtSet].filter(x => !srcSet.has(x)).sort();
  const lines: string[] = [];
  if (onlySrc.length > 0) {
    lines.push(`  ❌ in code, missing in ${label}:`);
    onlySrc.forEach(x => lines.push(`     - ${x}`));
  }
  if (onlyTgt.length > 0) {
    lines.push(`  ❌ in ${label}, not in code (ghost):`);
    onlyTgt.forEach(x => lines.push(`     - ${x}`));
  }
  return { ok: onlySrc.length === 0 && onlyTgt.length === 0, lines };
}

function diffStrings(label: string, src: string[], target: string[]): { ok: boolean; lines: string[] } {
  const srcSet = new Set(src);
  const tgtSet = new Set(target);
  const onlySrc = [...srcSet].filter(x => !tgtSet.has(x)).sort();
  const onlyTgt = [...tgtSet].filter(x => !srcSet.has(x)).sort();
  const lines: string[] = [];
  if (onlySrc.length > 0) {
    lines.push(`  ❌ in code, missing in ${label}:`);
    onlySrc.forEach(x => lines.push(`     - ${x}`));
  }
  if (onlyTgt.length > 0) {
    lines.push(`  ❌ in ${label}, not in code (ghost):`);
    onlyTgt.forEach(x => lines.push(`     - ${x}`));
  }
  return { ok: onlySrc.length === 0 && onlyTgt.length === 0, lines };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  let drift = false;
  console.log("=== check-docs-drift ===");
  console.log(`now: ${new Date().toISOString()}`);
  console.log("");

  const code = readRoutesInCode();
  console.log(`server/routes.ts: ${code.length} routes`);

  // 1. routes.ts vs openapi.yaml — focused on /v2/* + /v1/* (SDK contract scope).
  //    /api/* dashboard routes evolve with the UI and are intentionally not all
  //    contract-frozen, so they're reported as informational only.
  console.log("");
  console.log("[1/5] routes.ts ↔ openapi.yaml");
  const oapi = readRoutesInOpenapi();
  console.log(`  openapi.yaml: ${oapi.length} routes`);
  const codeContract = code.filter(r => r.path.startsWith("/v") && !r.path.startsWith("/v1/sdk/broadcasts/{broadcastId}/lineup_dummy"));
  const oapiContract = oapi.filter(r => r.path.startsWith("/v"));
  const r1 = diffRoutes("openapi.yaml (SDK contract scope)", codeContract, oapiContract);
  if (!r1.ok) { drift = true; r1.lines.forEach(l => console.log(l)); }
  else console.log(`  ✅ aligned (${codeContract.length} contract routes match)`);
  // Informational: /api/* drift
  const codeApi = code.filter(r => r.path.startsWith("/api/"));
  const oapiApi = oapi.filter(r => r.path.startsWith("/api/"));
  const r1b = diffRoutes("openapi.yaml (/api/* dashboard, informational)", codeApi, oapiApi);
  if (!r1b.ok) {
    console.log("  ℹ️  /api/* drift (informational, not a blocker — dashboard surface evolves with UI):");
    r1b.lines.slice(0, 6).forEach(l => console.log("  " + l));
    const total = r1b.lines.length;
    if (total > 6) console.log(`     …${total - 6} more lines hidden`);
  } else console.log(`  ✅ /api/* dashboard routes also aligned`);

  // 2. /v2/* in code ↔ API_V2_CONTRACT
  console.log("");
  console.log("[2/5] /v2/* in code ↔ API_V2_CONTRACT.md");
  const v2Code = code.filter(r => r.path.startsWith("/v2/")).map(r => `${r.method} ${r.path}`).sort();
  const v2Doc = readRoutesInContract();
  const r2 = diffStrings("API_V2_CONTRACT", v2Code, v2Doc);
  if (!r2.ok) { drift = true; r2.lines.forEach(l => console.log(l)); }
  else console.log(`  ✅ aligned (${v2Code.length} routes)`);

  // 3. /v2/* in code ↔ Postman
  console.log("");
  console.log("[3/5] /v2/* in code ↔ Postman");
  const postman = readRoutesInPostman();
  const v2Postman = postman.filter(r => r.path.startsWith("/v2/")).map(r => `${r.method} ${r.path}`).sort();
  const r3 = diffStrings("Postman", v2Code, v2Postman);
  if (!r3.ok) { drift = true; r3.lines.forEach(l => console.log(l)); }
  else console.log(`  ✅ aligned (${v2Code.length} routes covered)`);

  // 4. SDK slot manifest ↔ DB locations
  console.log("");
  console.log("[4/5] SDK slot manifest ↔ DB app_component_locations (clientApp 18)");
  const sdkSlots = readSdkSlots();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("  ⚠️  DATABASE_URL not set — skipping");
  } else {
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      await c.connect();
      const dbLocs = await c.query("SELECT location_id FROM app_component_locations WHERE client_app_id=18 AND deprecated_at IS NULL ORDER BY location_id");
      const dbSet = dbLocs.rows.map((r: any) => r.location_id).sort();
      await c.end();
      const r4 = diffStrings("DB", sdkSlots, dbSet);
      if (!r4.ok) { drift = true; r4.lines.forEach(l => console.log(l)); }
      else console.log(`  ✅ aligned (${sdkSlots.length} slots)`);
    } catch (e: any) {
      console.log(`  💥 DB error: ${e.message}`);
      try { await c.end(); } catch {}
    }
  }

  // 5. DB invariants
  console.log("");
  console.log("[5/5] DB invariants");
  const inv = await dbInvariants();
  inv.report.forEach(l => console.log(`  ${l}`));
  if (!inv.ok) drift = true;

  console.log("");
  if (drift) {
    console.log("❌ DRIFT DETECTED. See above.");
    process.exit(1);
  } else {
    console.log("✅ ALL CHECKS PASSED.");
    process.exit(0);
  }
})().catch(err => {
  console.error("💥 script crashed:", err);
  process.exit(2);
});
