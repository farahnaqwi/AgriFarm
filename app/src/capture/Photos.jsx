import { useEffect, useRef, useState } from "react";
import { Screen, Say } from "./ui.jsx";
import { getPosition, getHeading, startCompass, demoOn } from "../lib/geo.js";
import { insidePlot } from "../lib/geometry.js";
import { dhash } from "../lib/dhash.js";
import { save } from "../offline/store.js";
import { now } from "./capture.js";

// In-app camera only: there is deliberately no file/gallery picker.

function demoFrame(n) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 480;
  const g = c.getContext("2d");
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

const angleDelta = (a, b) => (a == null || b == null ? null : Math.round(((b - a) % 360 + 360) % 360));

export default function Photos({ farm, ring, photos, onAdd, onDone }) {
  const video = useRef(null);
  const [camera, setCamera] = useState("starting"); // starting | live | demo
  const [say, setSay] = useState(["CAPTURE_PHOTO"]);
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState({});

  useEffect(() => {
    let stream;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        video.current.srcObject = s;
        setCamera("live");
      })
      .catch(() => setCamera("demo"));
    return () => stream?.getTracks().forEach((tr) => tr.stop());
  }, []);

  function grab() {
    const v = video.current;
    if (camera !== "live" || !v?.videoWidth) return demoFrame(photos.length);
    const scale = Math.min(1, 1280 / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = v.videoWidth * scale;
    c.height = v.videoHeight * scale;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c;
  }

  async function shoot({ outside = false } = {}) {
    setBusy(true);
    await startCompass();
    const pos = await getPosition({ farm, outside }).catch(() => null);
    if (!pos) {
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
    const idx = photos.length;
    const photo_id = `ph${idx + 1}`;
    const heading_deg = getHeading(idx);
    let freshness = null;
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
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.8));
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
      demo: pos.demo || camera !== "live",
    });
    setSay(idx % 2 === 0 ? ["CAPTURE_TURN"] : ["PHOTO_INSIDE"]);
    setBusy(false);
  }

  return (
    <Screen step={5} title="Picha" titleEn="Photos"
      footer={<button className="big primary" disabled={photos.length < 2} onClick={onDone}>Endelea →<span>Continue</span></button>}>
      <Say key={say.join()} ids={say} />
      <div className="camera">
        <video ref={video} autoPlay playsInline muted hidden={camera !== "live"} />
        {camera === "demo" && <div className="cam-demo">DEMO CAMERA<span className="en">No camera here, so frames are generated.</span></div>}
        <button className="shutter" disabled={busy || camera === "starting"} onClick={() => shoot()} aria-label="Take photo" />
      </div>
      <div className="thumbs">
        {photos.map((p) => (
          <figure key={p.photo_id}>
            {thumbs[p.photo_id] ? <img src={thumbs[p.photo_id]} alt="" /> : <div className="ph" />}
            <figcaption>
              📍 ✓{p.freshness && (p.freshness.passed ? " ↻ ✓" : " ↻ ✗")}
            </figcaption>
          </figure>
        ))}
      </div>
      {demoOn() && (
        <button className="link" onClick={() => shoot({ outside: true })} disabled={busy}>
          Demo: try a photo 150 m outside the plot
        </button>
      )}
    </Screen>
  );
}
