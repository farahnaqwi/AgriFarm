// Canonical JSON + SHA-256, shared by the phone (sealing) and the lender page (verifying).
// Canonical form: object keys sorted, no whitespace, JSON number/string rules (RFC 8785 JCS for our data).

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The report's fingerprint: SHA-256 of the canonical report with `integrity` removed. */
export async function reportHash(report: { integrity?: unknown }): Promise<string> {
  const { integrity: _ignored, ...body } = report;
  return sha256Hex(canonicalJson(body));
}
