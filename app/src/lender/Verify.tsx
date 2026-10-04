// Lender page, opened by scanning the farmer's QR: /verify#r={report_id}&h={sha256}.
// Fetch the report -> re-hash it here -> unaltered / does not match -> contradictions first -> evidence -> limits.
// The verdict only trusts the hash in the QR (taken from the farmer's phone), never the copy in the database.

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { reportHash } from "@engine";
import { fetchReport, requestSiteVisit, supabaseConfigured } from "../data/reports.ts";
import { Stamp } from "../capture/ui.tsx";
import { Icon } from "../capture/icons.tsx";
import { t } from "../lib/phrases.ts";
import { NdviChart, PlotShape, RainChart } from "./charts.tsx";
import { STATUS_EN, STATUS_ORDER, TIER_EN, NOT_SURE_EN, claimValue, dateTime, explainCheck, fieldName, groupCode, sourceEn } from "./format.ts";
import type { Claim, Report } from "../types/index.ts";
import "./lender.css";

type State =
  | { kind: "loading" }
  | { kind: "bad_link" }
  | { kind: "not_found" }
  | { kind: "unreachable" }
  | { kind: "ready"; report: Report; intact: boolean };

const hashFromUrl = () => (new URLSearchParams(window.location.hash.slice(1)).get("h") ?? "").toLowerCase();
const TONE = { consistent: "green", contradicted: "red", unverifiable: "grey" } as const;
const MARK = { consistent: "check", contradicted: "cross", inconclusive: null } as const;

export default function Verify() {
  const [hash, setHash] = useState(hashFromUrl);
  const [state, setState] = useState<State>({ kind: "loading" });

  // A second QR opened in the same tab only changes the #fragment, which doesn't reload the page.
  useEffect(() => {
    const onChange = () => { setHash(hashFromUrl()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const load = useCallback(async () => {
    if (!/^[0-9a-f]{64}$/.test(hash)) return setState({ kind: "bad_link" });
    setState({ kind: "loading" });
    try {
      const report = await fetchReport(hash);
      if (!report) return setState({ kind: "not_found" });
      setState({ kind: "ready", report, intact: (await reportHash(report)) === hash });
    } catch {
      setState({ kind: "unreachable" });
    }
  }, [hash]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    document.documentElement.lang = "en";
    if (state.kind === "ready") document.title = `${state.report.report_id} · AgriFarm`;
  }, [state]);

  return (
    <main className="lender">
      <Hero state={state} hash={hash} onRetry={load} />
      {state.kind === "ready" && <Body report={state.report} hash={hash} intact={state.intact} />}
    </main>
  );
}

function Hero({ state, hash, onRetry }: { state: State; hash: string; onRetry: () => void }) {
  const top = (
    <div className="l-top">
      <span className="wordmark">AgriFarm</span>
      <span className="tag">Farm evidence report</span>
    </div>
  );
  const message = (tone: string, title: string, text: ReactNode, retry = false) => (
    <header className={`l-hero ${tone}`}>
      <div className="l-in">
        {top}
        <h1>{title}</h1>
        <p className="l-lead">{text}</p>
        {retry && <button className="l-btn light" onClick={onRetry}><Icon name="retry" size={20} />Check again</button>}
      </div>
    </header>
  );

  switch (state.kind) {
    case "loading":
      return message("ink", "Checking…", "Fetching the report and re-computing its fingerprint.");
    case "bad_link":
      return message("ink", "Incomplete link", "This link is missing the report code. Scan the QR code on the farmer's phone again.");
    case "not_found":
      return message("ink", "Not received yet",
        "The farmer's phone sends the report the next time it has signal. Ask them to open the app once with internet, then check again.", true);
    case "unreachable":
      return message("ink", "Can't reach the server", "Check this device's internet connection, then try again.", true);
    case "ready": {
      const { report, intact } = state;
      return (
        <header className={`l-hero ${intact ? "green" : "red"}`}>
          <div className="l-in">
            {top}
            <h1>{intact ? "Unaltered" : "Does not match"}</h1>
            <p className="l-lead">
              {intact
                ? <>This is exactly the report the farmer heard and approved on {dateTime(report.consent.approved_at)}.</>
                : <>{t("LENDER_ALTERED", "en")}</>}
            </p>
            {report.evidence_summary.tally.contradicted > 0 && (
              <a className="l-flag" href="#claims">
                <Icon name="warn" size={20} />
                {report.evidence_summary.tally.contradicted} of {report.claims.length} claims contradicted by independent records
              </a>
            )}
            <div className="l-code">
              <span>Code on the farmer's phone</span>
              <b>{groupCode(hash)}</b>
            </div>
          </div>
        </header>
      );
    }
  }
}

function Body({ report, hash, intact }: { report: Report; hash: string; intact: boolean }) {
  const claims = useMemo(() => [...report.claims].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]), [report]);
  const tally = report.evidence_summary.tally;
  const ev = report.evidence_summary;
  const ring = (report.plot.geometry.coordinates[0] ?? []) as number[][];
  const saidBad = report.claims.filter((c) => c.field === "bad_season").map((c) => String(c.value));
  const cls = ev.ndvi.classifier;

  return (
    <div className="l-body">
      {!intact && (
        <p className="l-alert red"><Icon name="warn" />Everything below differs from what the farmer approved. Do not rely on it.</p>
      )}
      {report.provenance.mode !== "live" && (
        <p className="l-alert dashed">
          {report.provenance.mode === "mock"
            ? "Mock data: satellite and weather values are invented for the demo. Not a real farmer."
            : "Demo: real satellite and weather data, fictional farmer."}
        </p>
      )}
      {report.not_sure.flag && (
        <div className="l-alert red">
          <Icon name="warn" />
          <div>
            <b>The system is not sure about parts of this report.</b>
            <ul>{report.not_sure.reasons.map((r) => <li key={r}>{NOT_SURE_EN[r] ?? r}</li>)}</ul>
          </div>
        </div>
      )}

      <section className="l-farm">
        <PlotShape ring={ring} />
        <dl>
          <div><dt>Plot</dt><dd>{report.plot.plot_id ?? "Not registered"}</dd></div>
          <div><dt>Where</dt><dd>{report.plot.admin_area}{report.plot.country !== "ZZ" ? `, ${report.plot.country}` : ""}</dd></div>
          <div><dt>Mapped area</dt><dd>{report.plot.area_ha} ha <span>({report.plot.geometry_source === "gps_walk" ? "walked with GPS" : "drawn on satellite map"})</span></dd></div>
          {report.farmer.cooperative_name && <div><dt>Cooperative</dt><dd>{report.farmer.cooperative_name}</dd></div>}
        </dl>
      </section>

      <section className="l-tally" aria-label="Claim results">
        <div className="bad"><b>{tally.contradicted}</b>Contradicted</div>
        <div className="ok"><b>{tally.consistent}</b>Consistent</div>
        <div><b>{tally.unverifiable}</b>Not checked</div>
      </section>

      <section id="claims">
        <h2>What the farmer claimed</h2>
        {tally.contradicted > 0 && (
          <p className="l-prompt">
            {tally.contradicted} {tally.contradicted === 1 ? "claim does" : "claims do"} not match independent records.
            Consider a <a href="#visit">site visit</a> before deciding.
          </p>
        )}
        <ol className="l-claims">{claims.map((c) => <ClaimRow key={c.claim_id} claim={c} report={report} />)}</ol>
      </section>

      <section>
        <h2>Satellite greenness</h2>
        <p className="l-sub">
          {cls.model_id.includes("rule") ? "Crop pattern (rule: does it stay green in the dry season?)" : "Classifier"}: <b>{cls.predicted_class.replace("_", " ")}</b>
          {cls.predicted_class !== "uncertain" && <> (score {Number((cls.probabilities as Record<string, unknown>)[cls.predicted_class] ?? 0).toFixed(2)})</>}
          {" · "}{ev.ndvi.months_cloud_free} of {ev.ndvi.months_total} months cloud-free
          {cls.heldout_accuracy != null ? ` · held-out accuracy ${Math.round(cls.heldout_accuracy * 100)}%` : cls.model_id.includes("rule") ? " · a fixed rule, not a trained model" : " · accuracy not yet measured"}
        </p>
        <NdviChart ndvi={ev.ndvi} />
      </section>

      <section>
        <h2>Rainfall</h2>
        <RainChart rain={ev.rainfall} saidBad={saidBad} />
      </section>

      <section>
        <h2>Photos and soil</h2>
        <ul className="l-facts">
          <li>
            {ev.photos.length} in-app {ev.photos.length === 1 ? "photo" : "photos"}, {ev.photos.filter((p) => p.inside_plot).length} taken inside the plot
            {ev.photos.some((p) => p.freshness) && (ev.photos.some((p) => p.freshness?.passed) ? "; turn-around freshness check passed" : "; turn-around freshness check failed")}.
            {" "}The pictures stay on the farmer's phone; only their location and time are in the report.
          </li>
          {ev.soil.ph != null && (
            <li>Soil (model estimate, {ev.soil.depth_cm} cm): pH {ev.soil.ph}{ev.soil.organic_carbon_g_kg != null && `, organic carbon ${ev.soil.organic_carbon_g_kg} g/kg`}{ev.soil.nitrogen_total_g_kg != null && `, nitrogen ${ev.soil.nitrogen_total_g_kg} g/kg`}.</li>
          )}
        </ul>
      </section>

      {report.attestations.length > 0 && (
        <section>
          <h2>Co-signed by</h2>
          <ul className="l-facts">
            {report.attestations.map((a) => (
              <li key={a.attestation_id}>
                <b>{a.org_name}</b> ({a.role.replace("_", " ")}) on {dateTime(a.signed_at)}, covering{" "}
                {a.covers_claims.map((id) => fieldName(report.claims.find((c) => c.claim_id === id)?.field ?? id).toLowerCase()).join(", ")}.
                {a.note && <> {a.note}</>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SiteVisit hash={hash} />

      <section>
        <h2>What this report cannot show</h2>
        <ul className="l-limits">{report.limitations.map((l) => <li key={l}>{t(`LIMIT_${l}`, "en")}</li>)}</ul>
      </section>

      <details className="l-heard">
        <summary>What the farmer heard before approving ({report.narrative.length} sentences, Swahili)</summary>
        <ol>{report.narrative.map((s) => <li key={s.sentence_id}><span lang="sw">{s.text.sw}</span><span className="en">{s.text.en}</span></li>)}</ol>
      </details>

      <footer className="l-foot">
        <p className="l-disclaimer">{report.disclaimer}</p>
        <dl>
          <div><dt>Report</dt><dd>{report.report_id}</dd></div>
          <div><dt>Created</dt><dd>{dateTime(report.created_at)} · {report.provenance.app_version}</dd></div>
          <div><dt>Fingerprint</dt><dd className="hash">{hash}</dd></div>
          <div><dt>How it's checked</dt><dd>SHA-256 of the report as canonical JSON (RFC 8785), without its integrity block. Computed on the farmer's phone at the moment of approval, and again here.</dd></div>
        </dl>
      </footer>
    </div>
  );
}

function ClaimRow({ claim: c, report }: { claim: Claim; report: Report }) {
  const attested = report.attestations.filter((a) => c.attestation_refs.includes(a.attestation_id));
  return (
    <li className={`l-claim ${c.status}`}>
      <div className="l-claim-head">
        <span className="l-field">{fieldName(c.field)}</span>
        <Stamp tone={TONE[c.status]} en={TIER_EN[c.tier]} tilt={c.status === "contradicted" ? 2 : -3}>{STATUS_EN[c.status]}</Stamp>
      </div>
      <p className="l-value">{claimValue(c)}</p>
      {c.source.quote && <p className="l-quote"><span lang="sw">“{c.source.quote}”</span> <span>{sourceEn(c)}</span></p>}
      {!c.source.quote && <p className="l-quote"><span>{sourceEn(c)}</span></p>}
      {(c.checks.length > 0 || attested.length > 0) && (
        <ul className="l-checks">
          {c.checks.map((k) => {
            const { against, finding } = explainCheck(k);
            const mark = MARK[k.result];
            return (
              <li key={k.rule_id} className={k.result}>
                {mark ? <Icon name={mark} size={18} /> : <i className="l-dash" />}
                <span><b>{against}.</b> {finding}</span>
              </li>
            );
          })}
          {attested.map((a) => (
            <li key={a.attestation_id} className="consistent">
              <Icon name="check" size={18} /><span><b>Co-signed.</b> {a.org_name}.</span>
            </li>
          ))}
        </ul>
      )}
      {c.checks.length === 0 && attested.length === 0 && (
        <p className="l-none">{c.field === "land_tenure" ? "Satellites can't see land rights; only a co-sign or a document can." : "No independent record to check this against."}</p>
      )}
    </li>
  );
}

function SiteVisit({ hash }: { hash: string }) {
  const [lender, setLender] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!lender.trim()) return;
    setPhase("sending");
    try {
      setPhase((await requestSiteVisit(hash, lender.trim())) ? "sent" : "failed");
    } catch {
      setPhase("failed");
    }
  }

  return (
    <section id="visit" className="l-visit">
      <h2>Request a site visit</h2>
      {phase === "sent" ? (
        <p className="l-sent"><Icon name="check" />Requested. It is saved against this report's fingerprint.</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="lender">Your name and institution</label>
          <input id="lender" value={lender} onChange={(e) => setLender(e.target.value)} placeholder="e.g. A. Mwakyusa, Mbozi SACCO" autoComplete="organization" disabled={!supabaseConfigured} />
          <button className="l-btn" disabled={!supabaseConfigured || !lender.trim() || phase === "sending"}>
            {phase === "sending" ? "Sending…" : "Request site visit"}<Icon name="arrow" size={20} />
          </button>
          {phase === "failed" && <p className="l-error">Couldn't send. Check the connection and try again.</p>}
          {!supabaseConfigured && <p className="l-error">Not connected to the report database on this build.</p>}
        </form>
      )}
    </section>
  );
}
