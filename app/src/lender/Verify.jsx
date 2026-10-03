// OWNER: Farah. PLACEHOLDER lender page, opened by scanning the farmer's QR.
// To build: fetchReport(h) (app/src/data/reports.js) -> recompute JCS SHA-256 -> ✅ unaltered / ❌ altered
// -> contradictions first -> tier table -> NDVI + rainfall charts -> limitations -> "Request site visit".

export default function Verify() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return (
    <main className="lender">
      <h1>Lender view</h1>
      <p>Report: <code>{params.get("r") ?? "—"}</code></p>
      <p>Hash from QR: <code>{params.get("h") ?? "—"}</code></p>
      <p className="en">Placeholder. Farah builds this page.</p>
    </main>
  );
}
