import { useEffect, useRef, useState } from "react";
import { Screen, Say, Next, Stamp } from "./ui.tsx";
import { Icon } from "./icons.tsx";
import { getPosition, getHeading, startCompass, demoOn, isLocationDenied } from "../lib/geo.ts";
import { PROBLEM } from "./labels.ts";
import { insidePlot } from "../lib/geometry.ts";
import { dhash } from "../lib/dhash.ts";
import { save } from "../offline/store.ts";
import { now } from "./capture.ts";
import type { CapturePhoto, DemoFarm } from "../types/index.ts";

interface Props {
  farm: DemoFarm;
  ring: number[][];
  photos: CapturePhoto[];
  onAdd: (photo: CapturePhoto) => void;
  onDone: () => void;
}

// In-app camera only: there is deliberately no file/gallery picker.
// Generated frames exist ONLY in demo mode. Outside it, no working camera means no photos.

type Camera = "starting" | "live" | "demo" | "denied" | "missing" | "insecure";

function cameraProblem(e: unknown): Camera {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  return "missing"; // NotFoundError, NotReadableError (in use), OverconstrainedError...
}

function demoFrame(n: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 480;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 640 * Math.random(), 480);
  grad.addColorStop(0, `hsl(${100 + n * 30}, 45%, 35%)`);
  grad.addColorStop(1, `hsl(${60 + Math.random() * 40}, 35%, ${45 + n * 8}%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 640, 480);
  // Random leaf-like blobs so each generated frame has a distinct perceptual hash.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `hsl(${80 + Math.random() * 60}, 40%, ${15 + Math.random() * 60}%)`;
    g.beginPath();
    g.ellipse(Math.random() * 640, Math.random() * 480, 20 + Math.random() * 90, 10 + Math.random() * 50, Math.random() * 3, 0, 7);
    g.fill();
  }
  g.fillStyle = "#fff";
  g.font = "bold 36px system-ui";
  g.fillText("DEMO CAMERA", 30, 60);
  g.font = "20px system-ui";
  g.fillText(new Date().toLocaleString(), 30, 95);
  return c;
}

const angleDelta = (a: number | null | undefined, b: number | null): number | null => (a == null || b == null ? null : Math.round(((b - a) % 360 + 360) % 360));

export default function Photos({ farm, ring, photos, onAdd, onDone }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<Camera>("starting");
  const [problem, setProblem] = useState<{ sw: string; en: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [say, setSay] = useState<string[]>(["CAPTURE_PHOTO"]);
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let stream: MediaStream | undefined;
    setCamera("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera(demoOn() ? "demo" : window.isSecureContext ? "missing" : "insecure");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        setCamera("live");
      })
      .catch((e: unknown) => setCamera(demoOn() ? "demo" : cameraProblem(e)));
    return () => stream?.getTracks().forEach((tr) => tr.stop());
  }, [attempt]);

  const canShoot = camera === "live" || camera === "demo";

  function grab(): HTMLCanvasElement | null {
    if (camera === "demo") return demoFrame(photos.length);
    const v = video.current;
    if (camera !== "live" || !v?.videoWidth) return null;
    const scale = Math.min(1, 1280 / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = v.videoWidth * scale;
    c.height = v.videoHeight * scale;
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    return c;
  }

  async function shoot({ outside = false } = {}) {
    if (!canShoot) return;
    setBusy(true);
    setProblem(null);
    await startCompass();
    let locationDenied = false;
    const pos = await getPosition({ farm, outside }).catch((e: unknown) => {
      locationDenied = isLocationDenied(e);
      return null;
    });
    if (!pos) {
      if (locationDenied) setProblem(PROBLEM.gps_denied);
      setSay(["CAPTURE_NO_GPS"]);
      setBusy(false);
      return;
    }
    if (!insidePlot([pos.lon, pos.lat], ring, pos.accuracy)) {
      setSay(["CAPTURE_OUTSIDE"]); // R-GEO-01: rejected, never stored
      setBusy(false);
      return;
    }
    const canvas = grab();
    if (!canvas) {
      setBusy(false);
      return;
    }
    const idx = photos.length;
    const photo_id = `ph${idx + 1}`;
    const heading_deg = getHeading(idx);
    let freshness: CapturePhoto["freshness"] = null;
    const prev = photos[idx - 1];
    if (idx % 2 === 1 && prev) {
      const delta = angleDelta(prev.heading_deg, heading_deg);
      const secs = Math.round((Date.now() - Date.parse(prev.captured_at)) / 1000);
      freshness = {
        challenge: "turn_around",
        paired_photo_id: prev.photo_id,
        ...(delta != null && { heading_delta_deg: delta }),
        seconds_elapsed: secs,
        passed: delta != null && delta >= 120 && delta <= 240 && secs <= 60,
      };
    }
    const blob = await new Promise<Blob>((r, reject) => canvas.toBlob((b) => (b ? r(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.8));
    await save(`photo:${photo_id}`, blob);
    setThumbs((t) => ({ ...t, [photo_id]: URL.createObjectURL(blob) }));
    onAdd({
      photo_id,
      captured_at: now(),
      lat: +pos.lat.toFixed(6),
      lon: +pos.lon.toFixed(6),
      gps_accuracy_m: Math.round(pos.accuracy),
      heading_deg,
      inside_plot: true,
      phash: dhash(canvas),
      duplicate_of: null,
      freshness,
      demo: pos.demo || camera === "demo",
    });
    setSay(idx % 2 === 0 ? ["CAPTURE_TURN"] : ["PHOTO_INSIDE"]);
    setBusy(false);
  }

  const blocked = camera === "denied" || camera === "missing" || camera === "insecure";
  const blockedText = camera === "insecure" ? PROBLEM.insecure : camera === "missing" ? PROBLEM.camera_missing : PROBLEM.camera_denied;

  return (
    <Screen title="Picha mbili" titleEn="Two photos, from inside your farm"
      footer={<Next onClick={onDone} disabled={photos.length < 2} en={photos.length < 2 ? `${2 - photos.length} more photo${photos.length === 1 ? "" : "s"}` : "Continue"} />}>
      <Say key={say.join()} ids={say} />
      <div className="camera">
        <video ref={video} autoPlay playsInline muted hidden={camera !== "live"} />
        {camera === "demo" && <div className="cam-demo">DEMO CAMERA<span className="en">Demo mode without a camera: frames are generated.</span></div>}
        {blocked && (
          <div className="cam-problem">
            <Icon name="warn" size={32} />
            <span>{blockedText.sw}<span className="en">{blockedText.en}</span></span>
            <button className="chip" onClick={() => setAttempt((a) => a + 1)}>Jaribu tena · Try again</button>
          </div>
        )}
        {(canShoot || camera === "starting") && (
          <button className="shutter" disabled={busy || !canShoot} onClick={() => shoot()} aria-label="Take photo" />
        )}
      </div>
      {problem && <p className="problem"><Icon name="warn" /><span>{problem.sw}<span className="en">{problem.en}</span></span></p>}
      {photos.length > 0 && (
        <div className="thumbs">
          {photos.map((p) => (
            <figure key={p.photo_id}>
              {thumbs[p.photo_id] ? <img src={thumbs[p.photo_id]} alt="" /> : <div className="ph" />}
              {p.freshness
                ? <Stamp tone={p.freshness.passed ? "green" : "red"} tilt={-8}>{p.freshness.passed ? "Imegeuka ✓" : "Haijageuka"}</Stamp>
                : <Stamp tone="green" tilt={-8}>Ndani ✓</Stamp>}
            </figure>
          ))}
        </div>
      )}
      {demoOn() && (
        <button className="link" onClick={() => shoot({ outside: true })} disabled={busy}>
          <Icon name="pin" size={20} />Demo: photo from 150 m outside the plot
        </button>
      )}
    </Screen>
  );
}
