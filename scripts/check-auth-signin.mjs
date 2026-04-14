/**
 * One-off: verify email/password against Supabase Auth (prints only error or success, never password).
 * Usage: node scripts/check-auth-signin.mjs
 * Reads .env.local for NEXT_PUBLIC_* and E2E_*.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.E2E_EMAIL?.trim();
const password = process.env.E2E_PASSWORD;

if (!url || !anon || !email || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, E2E_EMAIL, or E2E_PASSWORD in .env.local");
  process.exit(1);
}

const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: anon,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password }),
});

const body = await res.json();
if (!res.ok) {
  console.error("Auth failed:", body.error_description || body.msg || body.error || res.status);
  process.exit(1);
}
console.log("Auth OK for", email, "(access token received)");
