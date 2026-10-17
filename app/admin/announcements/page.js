// SAVE THIS FILE AS: app/admin/announcements/page.js
"use client";

import { useEffect, useState } from 'react';
import ImageUploader from '@/components/admin/ImageUploader';
import s from './announcements.module.css';

const emptyForm = { title: '', image_url: '', body_text: '', is_active: true };

export default function AnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/announcements', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load announcements.');
      setItems(data.announcements || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(item) {
    setEditing(item.id);
    setForm({ title: item.title || '', image_url: item.image_url || '', body_text: item.body_text || '', is_active: !!item.is_active });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!form.title.trim()) return setError('Enter a title.');
    if (!form.image_url) return setError('Upload an image first.');

    setSaving(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed.');
      setMessage(editing ? 'Announcement updated.' : 'Announcement published.');
      reset();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item) {
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      setItems((old) => old.map((x) => x.id === item.id ? data.announcement : x));
    } catch (e) { setError(e.message); }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed.');
      setItems((old) => old.filter((x) => x.id !== item.id));
    } catch (e) { setError(e.message); }
  }

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <div className={s.eyebrow}>ADMINISTRATION</div>
          <h1>Announcements</h1>
          <p>Create notices that appear as a dashboard popup for students.</p>
        </div>
        <div className={s.count}>{items.length} total</div>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {message && <div className={s.success}>{message}</div>}

      <div className={s.grid}>
        <form className={s.editor} onSubmit={save}>
          <div className={s.cardTitle}>{editing ? 'Edit announcement' : 'Make announcement'}</div>
          <p className={s.help}>Upload the banner/image, add the notice text, then turn it on. Active announcements appear one after another in the student dashboard.</p>

          <label className={s.label}>Title</label>
          <input className={s.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. New CET mock test is live" />

          <div className={s.fieldGap}>
            <ImageUploader bucket="thumbnails" label="Announcement image / banner" value={form.image_url} onUploaded={(url) => setForm({ ...form, image_url: url })} />
          </div>

          <label className={s.label}>Notice text</label>
          <textarea className={s.textarea} value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} placeholder="Write the message students should see below the image…" rows={6} />

          <label className={s.checkRow}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <span><strong>Announcement ON</strong><small>Show this announcement to students.</small></span>
          </label>

          <div className={s.actions}>
            <button className={s.primary} type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Publish announcement'}</button>
            {editing && <button className={s.secondary} type="button" onClick={reset}>Cancel</button>}
          </div>
        </form>

        <section className={s.listCard}>
          <div className={s.cardTitle}>Older announcements</div>
          <p className={s.help}>Turn announcements on/off individually. If multiple are ON, students can move through them with the next arrow.</p>

          {loading ? <div className={s.empty}>Loading announcements…</div> : items.length === 0 ? <div className={s.empty}>No announcements yet. Create your first one.</div> : (
            <div className={s.list}>
              {items.map((item) => (
                <article key={item.id} className={`${s.item} ${item.is_active ? s.itemOn : s.itemOff}`}>
                  <img src={item.image_url} alt="" className={s.thumb} />
                  <div className={s.itemMain}>
                    <div className={s.itemTop}><h3>{item.title}</h3><span className={item.is_active ? s.on : s.off}>{item.is_active ? 'ON' : 'OFF'}</span></div>
                    {item.body_text && <p>{item.body_text}</p>}
                    <div className={s.itemActions}>
                      <button type="button" onClick={() => toggle(item)}>{item.is_active ? 'Turn off' : 'Turn on'}</button>
                      <button type="button" onClick={() => startEdit(item)}>Edit</button>
                      <button type="button" className={s.deleteBtn} onClick={() => remove(item)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
