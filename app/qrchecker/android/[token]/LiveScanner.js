// app/qrchecker/android/[token]/LiveScanner.js  (new file)
//
// TESTING ONLY. Full-screen LIVE OMR scanner: opens the rear camera (no shutter button), reads the
// sheet several times a second, draws what it sees on top of the video (corner squares, tracking
// points, roll number + answer bubbles) and closes itself once the SAME result has been read in
// CONFIRM scans in a row.
//
// getUserMedia only works on https:// (or localhost). On plain http://192.168.x.x Chrome blocks it,
// so this screen then explains the two fixes and offers the photo scanner instead.
"use client";

import { useEffect, useRef, useState } from "react";
import s from "./qrchecker.module.css";
import { scanSheet, ScanError } from "@/lib/omr/scan";

const CONFIRM = 2; // identical consecutive scans needed
const MAX_SIDE = 1920; // longest side of the frame that is analysed
const MIN_SCALE = 3.2; // px per mm on the sheet; lower = too far away to read bubbles
const MIN_TRACKERS = 8; // tracker squares that must line up (good alignment)
const GAP_MS = 120; // pause between scans

const sigOf = (r) => `${r.pageNo}|${r.roll ? r.roll.text : ""}|${r.answers.map((a) => a.letter || (a.state === "multi" ? "*" : "-")).join("")}`;

export default function LiveScanner({ layout, reject, onConfirmed, onClose, onFallback }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const [fatal, setFatal] = useState("");
  const [status, setStatus] = useState({ text: "Starting camera\u2026", tone: "info" });
  const [streak, setStreak] = useState(0);
  const rejectRef = useRef(reject);
  const doneRef = useRef(onConfirmed);
  useEffect(() => { rejectRef.current = reject; doneRef.current = onConfirmed; });

  useEffect(() => {
    let alive = true;
    let stream = null;
    let timer = 0;
    let lastSig = "";
    let count = 0;
    const frame = document.createElement("canvas");
    const fctx = frame.getContext("2d", { willReadFrequently: true });

    const stop = () => {
      alive = false;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    const draw = (r, fw, fh, good) => {
      const c = overlayRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const bw = c.clientWidth, bh = c.clientHeight;
      if (c.width !== Math.round(bw * dpr) || c.height !== Math.round(bh * dpr)) { c.width = Math.round(bw * dpr); c.height = Math.round(bh * dpr); }
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      if (!r) return;
      const sc = Math.min(bw / fw, bh / fh), ox = (bw - fw * sc) / 2, oy = (bh - fh * sc) / 2;
      const X = (u) => (ox + u * sc) * dpr, Y = (v) => (oy + v * sc) * dpr, R = (p) => Math.max(2 * dpr, p * sc * dpr);
      const corners = r.marks.filter((m) => m.kind === "corner");
      if (corners.length === 4) {
        ctx.beginPath();
        corners.forEach((m, i) => (i ? ctx.lineTo(X(m.u), Y(m.v)) : ctx.moveTo(X(m.u), Y(m.v))));
        ctx.closePath();
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = good ? "#22c55e" : "#facc15";
        ctx.stroke();
      }
      r.marks.forEach((m) => {
        ctx.beginPath();
        ctx.arc(X(m.u), Y(m.v), R(m.r), 0, Math.PI * 2);
        ctx.lineWidth = 2 * dpr;
        if (m.kind === "corner") { ctx.strokeStyle = "#3b82f6"; ctx.stroke(); }
        else if (m.kind === "track") { ctx.fillStyle = "rgba(6,182,212,.85)"; ctx.fill(); }
        else if (m.kind === "pick") { ctx.fillStyle = "rgba(34,197,94,.45)"; ctx.strokeStyle = "#22c55e"; ctx.fill(); ctx.stroke(); }
        else if (m.kind === "multi") { ctx.strokeStyle = "#ef4444"; ctx.stroke(); }
      });
    };

    const setHint = (text, tone) => { setStatus({ text, tone }); count = 0; lastSig = ""; setStreak(0); };

    const tick = () => {
      const v = videoRef.current;
      if (!alive) return;
      if (!v || v.readyState < 2 || !v.videoWidth || document.hidden) { timer = setTimeout(tick, GAP_MS); return; }
      const k = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
      frame.width = Math.round(v.videoWidth * k);
      frame.height = Math.round(v.videoHeight * k);
      fctx.drawImage(v, 0, 0, frame.width, frame.height);

      let r = null;
      try {
        const id = fctx.getImageData(0, 0, frame.width, frame.height);
        r = scanSheet({ data: id.data, width: id.width, height: id.height }, layout);
      } catch (e) {
        draw(null);
        setHint(e instanceof ScanError && e.message.startsWith("Page code") ? e.message : "Show the whole sheet with all 4 black corner squares", "info");
        timer = setTimeout(tick, GAP_MS);
        return;
      }

      const why = rejectRef.current ? rejectRef.current(r) : "";
      if (why) { draw(r, frame.width, frame.height, false); setHint(why, "warn"); }
      else if (r.scale < MIN_SCALE) { draw(r, frame.width, frame.height, false); setHint("Move closer to the sheet", "warn"); }
      else if (r.trackers < MIN_TRACKERS) { draw(r, frame.width, frame.height, false); setHint("Hold steady, keep the sheet flat and well lit", "warn"); }
      else if (r.roll && !r.roll.valid) { draw(r, frame.width, frame.height, false); setHint("Roll number is not clearly shaded", "warn"); }
      else {
        const sig = sigOf(r);
        count = sig === lastSig ? count + 1 : 1;
        lastSig = sig;
        draw(r, frame.width, frame.height, true);
        setStreak(count);
        setStatus({ text: `Hold steady\u2026 confirming ${Math.min(count, CONFIRM)}/${CONFIRM}`, tone: "good" });
        if (count >= CONFIRM) {
          const snap = document.createElement("canvas");
          snap.width = frame.width; snap.height = frame.height;
          snap.getContext("2d").drawImage(frame, 0, 0);
          stop();
          doneRef.current(r, { canvas: snap, width: snap.width, height: snap.height });
          return;
        }
      }
      timer = setTimeout(tick, GAP_MS);
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setFatal("insecure"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      } catch (e) {
        setFatal(e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "error");
        return;
      }
      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch { /* not supported */ }
      setStatus({ text: "Point the camera at the OMR sheet", tone: "info" });
      tick();
    })();

    return stop;
  }, [layout]);

  return (
    <div className={s.live}>
      <video ref={videoRef} className={s.liveVideo} playsInline muted autoPlay />
      <canvas ref={overlayRef} className={s.liveOverlay} />

      <div className={s.liveTop}>
        <span className={s.liveTitle}>Scanning OMR</span>
        <button type="button" className={s.liveClose} onClick={onClose}>Close</button>
      </div>

      {!fatal && (
        <div className={s.liveBottom}>
          <div className={`${s.liveStatus} ${status.tone === "good" ? s.liveGood : status.tone === "warn" ? s.liveWarn : ""}`}>{status.text}</div>
          <div className={s.liveBar}><span style={{ width: `${(Math.min(streak, CONFIRM) / CONFIRM) * 100}%` }} /></div>
        </div>
      )}

      {fatal && (
        <div className={s.liveFatal}>
          <div className={s.liveFatalBox}>
            {fatal === "insecure" && (
              <>
                <h2>Live camera needs https</h2>
                <p>Chrome blocks the live camera on plain <b>http://</b> addresses like <b>{typeof window !== "undefined" ? window.location.origin : ""}</b>. Fix it with either:</p>
                <ol>
                  <li>On this phone open <b>chrome://flags/#unsafely-treat-insecure-origin-as-secure</b>, add <b>{typeof window !== "undefined" ? window.location.origin : ""}</b>, set it to Enabled, tap Relaunch, then open this page again.</li>
                  <li>Or start the computer with <b>npx next dev --experimental-https</b>, create a new link and open its https address (accept the certificate warning).</li>
                </ol>
              </>
            )}
            {fatal === "denied" && (<><h2>Camera is blocked</h2><p>Allow the camera for this site (tap the lock icon in the address bar, then Permissions), then try again.</p></>)}
            {fatal === "error" && (<><h2>Camera could not start</h2><p>Close other apps that use the camera and try again.</p></>)}
            <div className={s.liveFatalBtns}>
              <button type="button" className={s.smallBtn} onClick={onFallback}>Take a photo instead</button>
              <button type="button" className={s.smallBtn} onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
