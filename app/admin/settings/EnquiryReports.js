// app/admin/settings/EnquiryReports.js  (new file)
// Settings -> Developers -> Purchase enquiries. Lists what institutes submitted on /purchase
// (table p_enquiry). Developer cookie is re-checked by /api/admin/dev/enquiries on every call.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import s from "./enquiries.module.css";

const fmt = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
};
const STATUS = { new: "New", contacted: "Contacted", closed: "Closed" };

export default function EnquiryReports({ onExpired }) {
  const [state, setState] = useState({ status: "loading", rows: [], setupNeeded: false, error: "" });
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dev/enquiries", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.status === 403) return onExpired();
      if (!res.ok) throw new Error(j.error || "Failed to load.");
      setState({ status: "ready", rows: j.enquiries || [], setupNeeded: !!j.setupNeeded, error: "" });
    } catch (e) {
      setState({ status: "error", rows: [], setupNeeded: false, error: e.message });
    }
  }, [onExpired]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { all: state.rows.length, new: 0, contacted: 0, closed: 0 };
    state.rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [state.rows]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return state.rows.filter((r) => (tab === "all" || r.status === tab) &&
      (!t || [r.institute_name, r.owner_name, r.email, r.phone, r.city].some((x) => String(x || "").toLowerCase().includes(t))));
  }, [state.rows, tab, q]);

  async function patch(id, body) {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/dev/enquiries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 403) return onExpired();
      if (!res.ok) throw new Error(j.error || "Could not save.");
      setState((st) => ({ ...st, rows: st.rows.map((r) => (r.id === id ? j.enquiry : r)) }));
      setOpen((o) => (o && o.id === id ? j.enquiry : o));
      setMsg("Saved.");
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  const openRow = (r) => { setOpen(r); setNotes(r.notes || ""); setMsg(""); };

  if (state.status === "loading") return <div className={s.note}>Loading enquiries&hellip;</div>;
  if (state.status === "error") return <p className={s.err}>{state.error} <button type="button" className={s.ghost} onClick={() => { setState({ status: "loading", rows: [], setupNeeded: false, error: "" }); load(); }}>Retry</button></p>;
  if (state.setupNeeded) return <p className={s.warn}>The enquiry table doesn&apos;t exist yet. Run <strong>sql/004_p_enquiry.sql</strong> in the Supabase SQL editor, then reload.</p>;

  return (
    <>
      <div className={s.stats}>
        {["all", "new", "contacted", "closed"].map((k) => (
          <button key={k} type="button" className={`${s.stat} ${tab === k ? s.statOn : ""}`} onClick={() => setTab(k)}>
            <b>{counts[k] || 0}</b><span>{k === "all" ? "All" : STATUS[k]}</span>
          </button>
        ))}
        <input className={s.search} placeholder="Search institute, name, phone, email, city" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className={s.ghost} onClick={load}>Refresh</button>
      </div>

      {rows.length === 0 ? (
        <div className={s.note}>{state.rows.length ? "No enquiries match." : "No enquiries yet. They appear here when an institute fills the /purchase form."}</div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Institute</th><th>Contact</th><th>Where</th><th>Students</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => openRow(r)} className={r.status === "new" ? s.unread : ""}>
                  <td><strong>{r.institute_name}</strong><span>{r.institute_type || "-"}</span></td>
                  <td><strong>{r.owner_name}</strong><span>{r.phone}</span></td>
                  <td>{[r.city, r.state].filter(Boolean).join(", ") || "-"}</td>
                  <td>{r.student_count ? `~${r.student_count}` : "-"}</td>
                  <td className={s.nowrap}>{fmt(r.created_at)}</td>
                  <td><span className={`${s.pill} ${s[`st_${r.status}`]}`}>{STATUS[r.status] || r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className={s.overlay} onClick={() => setOpen(null)}>
          <div className={s.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className={s.mHead}>
              <div><h3>{open.institute_name}</h3><span>{fmt(open.created_at)}</span></div>
              <button type="button" className={s.x} onClick={() => setOpen(null)} aria-label="Close">&times;</button>
            </div>
            <dl className={s.dl}>
              <dt>Contact person</dt><dd>{open.owner_name}</dd>
              <dt>Phone</dt><dd><a href={`tel:${open.phone}`}>{open.phone}</a></dd>
              <dt>Email</dt><dd><a href={`mailto:${open.email}`}>{open.email}</a></dd>
              <dt>Location</dt><dd>{[open.city, open.state].filter(Boolean).join(", ") || "-"}</dd>
              <dt>Type</dt><dd>{open.institute_type || "-"}</dd>
              <dt>Students (approx.)</dt><dd>{open.student_count || "-"}</dd>
              <dt>Message</dt><dd className={s.pre}>{open.message || "-"}</dd>
              {open.handled_by && (<><dt>Last updated by</dt><dd>{open.handled_by} &middot; {fmt(open.handled_at)}</dd></>)}
            </dl>
            <label className={s.lbl} htmlFor="enqNotes">Internal notes</label>
            <textarea id="enqNotes" className={s.ta} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call summary, follow-up date, price quoted..." />
            <div className={s.mActions}>
              {["new", "contacted", "closed"].map((k) => (
                <button key={k} type="button" disabled={busy || open.status === k} className={`${s.ghost} ${open.status === k ? s.cur : ""}`} onClick={() => patch(open.id, { status: k })}>
                  {open.status === k ? `\u2713 ${STATUS[k]}` : `Mark ${STATUS[k].toLowerCase()}`}
                </button>
              ))}
              <button type="button" className={s.primary} disabled={busy || notes === (open.notes || "")} onClick={() => patch(open.id, { notes })}>Save notes</button>
              {msg && <span className={s.msg}>{msg}</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
