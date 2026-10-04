/// <reference types="node" />
// For the demo video: change one number in a STORED report, so the lender page shows "Does not match".
//
//   node scripts/tamper-demo.ts <hash or lender link>             farm size in the stored copy -> 40% of it
//   node scripts/tamper-demo.ts <hash or lender link> --restore   put the original back ("Unaltered" again)
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the repo-root .env. That key is backend-only: the app and
// the lender page never have it, which is why a real lender can't do this. The original report is kept in the
// OS temp folder, so --restore puts back exactly what the farmer approved.

import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reportHash } from "../../backend/engine/canonical.ts";
import type { Report } from "../src/types/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
try { process.loadEnvFile(join(root, ".env")); } catch { /* checked below */ }

const arg = process.argv[2] ?? "";
const restore = process.argv.includes("--restore");
const hash = (arg.match(/(?:^|[#&?]h=)([0-9a-f]{64})/i)?.[1] ?? arg).toLowerCase();
if (!/^[0-9a-f]{64}$/.test(hash)) {
  console.error("Usage: node scripts/tamper-demo.ts <report hash or lender link> [--restore]");
  process.exit(1);
}

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!url || !key || key.startsWith("#")) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY in the repo-root .env (Supabase → Project Settings → API keys → secret key).");
  console.error("Never commit it and never give it a VITE_ name: it can edit every report.");
  process.exit(1);
}
// New-style secret keys (sb_secret_…) go in the apikey header only; legacy service_role JWTs also as a bearer token.
const headers: Record<string, string> = { apikey: key, "content-type": "application/json", ...(key.startsWith("sb_") ? {} : { authorization: `Bearer ${key}` }) };
const backup = join(tmpdir(), `agrifarm-tamper-${hash}.json`);
const row = `${url}/rest/v1/reports?hash=eq.${hash}`;

async function write(report: Report) {
  const res = await fetch(row, { method: "PATCH", headers: { ...headers, prefer: "return=minimal" }, body: JSON.stringify({ report }) });
  if (!res.ok) throw new Error(`Update failed: HTTP ${res.status} ${await res.text()}`);
}

const verifyLink = (r: Report) => `https://agrifarm-evidence.vercel.app/verify#r=${r.report_id}&h=${hash}`;

if (restore) {
  if (!existsSync(backup)) {
    console.error(`Nothing to restore: no saved original for ${hash.slice(0, 16)}… on this computer.`);
    process.exit(1);
  }
  const original = JSON.parse(readFileSync(backup, "utf8")) as Report;
  await write(original);
  rmSync(backup);
  console.log(`Restored. Fingerprint matches again: ${(await reportHash(original)) === hash ? "yes" : "NO"}`);
  console.log(`Lender page (reload): ${verifyLink(original)}`);
} else {
  const res = await fetch(`${row}&select=report`, { headers });
  if (!res.ok) throw new Error(`Read failed: HTTP ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as { report: Report }[];
  if (!rows[0]) {
    console.error("No stored report has that hash. Has the farmer's phone uploaded it yet?");
    process.exit(1);
  }
  const original = rows[0].report;
  if (!existsSync(backup)) writeFileSync(backup, JSON.stringify(original)); // never overwrite the true original

  const tampered = structuredClone(original);
  const claim = tampered.claims.find((c) => c.field === "plot_area") ?? tampered.claims.find((c) => typeof c.value === "number");
  if (!claim) throw new Error("This report has no number to change.");
  const before = claim.value;
  claim.value = Math.max(1, Math.round(Number(before) * 0.4));
  await write(tampered);

  console.log(`Changed ${claim.field} in the stored copy: ${before} → ${claim.value} ${claim.unit ?? ""}`.trim());
  console.log(`Fingerprint still matches: ${(await reportHash(tampered)) === hash ? "yes (unexpected!)" : "no, so the lender page will say \"Does not match\""}`);
  console.log(`Lender page (reload): ${verifyLink(original)}`);
  console.log(`Undo: node scripts/tamper-demo.ts ${hash} --restore`);
}
