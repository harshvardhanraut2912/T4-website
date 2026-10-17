// app/admin/exams/OmrCheckerLinkModal.js  (new file)
//
// TESTING ONLY. The "OMR checker link" popup on Admin -> Exams.
// Asks the server for a signed link (POST /api/admin/qrchecker-link) that uses this computer's
// Wi-Fi address instead of "localhost", e.g.
//   http://10.101.185.56:3000/qrchecker/android/<random string>
// Open it on a phone on the same Wi-Fi to scan filled OMR sheets for this exam.
"use client";

import { useEffect, useState } from "react";
import s from "./omrChecker.module.css";

export default function OmrCheckerLinkModal({ exam, onClose }) {
  const [state, setState] = useState({ status: "loading", error: "", data: null });
  const [which, setWhich] = useState(0);
  const [copied, setCopied] = useState(false);
  const name = exam.mock_test_name || exam.mock_slug || exam.id;

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/qrchecker-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: exam.id }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not create the link.");
        if (alive) setState({ status: "ready", error: "", data });
      })
      .catch((e) => { if (alive) setState({ status: "error", error: e.message || "Could not create the link.", data: null }); });
    return () => { alive = false; };
  }, [exam.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = state.data;
  const url = data ? (data.origins[which] || data.origins[0]).origin + data.path : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.getElementById("omrCheckerUrl");
      if (el) { el.focus(); el.select(); document.execCommand("copy"); }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label="OMR checker link">
        <div className={s.mHead}>
          <div>
            <h2 className={s.mTitle}>OMR checker link</h2>
            <p className={s.mSub}>{name}</p>
          </div>
          <button type="button" className={s.mX} onClick={onClose} aria-label="Close">{"\u2715"}</button>
        </div>

        <div className={s.mBody}>
          {state.status === "loading" && <p className={s.help}>Creating link&hellip;</p>}
          {state.status === "error" && <p className={s.err}>{state.error}</p>}

          {state.status === "ready" && (
            <>
              <label className={s.label} htmlFor="omrCheckerUrl">Open this on your phone (same Wi-Fi)</label>
              <input id="omrCheckerUrl" className={s.input} value={url} readOnly onFocus={(e) => e.target.select()} />

              {data.origins.length > 1 && (
                <div className={s.netRow}>
                  <label className={s.label} htmlFor="omrCheckerNet">Computer network address</label>
                  <select id="omrCheckerNet" className={s.input} value={which} onChange={(e) => setWhich(Number(e.target.value))}>
                    {data.origins.map((o, i) => <option key={o.origin} value={i}>{o.label}</option>)}
                  </select>
                  <p className={s.help}>Pick the address that starts like your phone&rsquo;s Wi-Fi (for example both start with 10.101.).</p>
                </div>
              )}

              <ul className={s.notes}>
                <li>Testing only. The link works for {data.expiresHours} hours and gives access to this exam&rsquo;s answer key, so don&rsquo;t share it.</li>
                <li>The phone must be on the same Wi-Fi as this computer, and the dev server must be running.</li>
                <li>If the page does not open, allow Node.js through the Windows firewall (private networks).</li>
              </ul>
            </>
          )}
        </div>

        <div className={s.mFoot}>
          <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={onClose}>Close</button>
          {state.status === "ready" && (
            <div className={s.footRight}>
              <a className={`${s.btn} ${s.btnGhost}`} href={url} target="_blank" rel="noreferrer">Open here</a>
              <button type="button" className={s.btn} onClick={copy}>{copied ? "Copied \u2713" : "Copy link"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
