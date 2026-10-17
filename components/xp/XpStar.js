'use client';

// components/xp/XpStar.js
//
// Floating silver star (right edge of the screen). Tap -> iOS-style bottom
// sheet with the XP leaderboard. Top 3 get gold / silver / bronze medals.
// UI only: it just reads profiles.xp_count through /api/xp/leaderboard.

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './xp.module.css';

const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' };

function Medal({ tone, size = 28 }) {
    const id = `m-${tone}`;
    const palette = {
        gold: ['#fff3b0', '#f7c948', '#b8860b'],
        silver: ['#ffffff', '#cfd5de', '#8a93a3'],
        bronze: ['#ffd9b0', '#d98c4f', '#8a4a1c'],
    }[tone];
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={palette[0]} />
                    <stop offset="0.55" stopColor={palette[1]} />
                    <stop offset="1" stopColor={palette[2]} />
                </linearGradient>
            </defs>
            <path d="M9 1h5l2 9h-5z" fill="#ff453a" />
            <path d="M23 1h-5l-2 9h5z" fill="#0a84ff" />
            <circle cx="16" cy="20" r="10" fill={`url(#${id})`} stroke={palette[2]} strokeWidth="1" />
            <circle cx="16" cy="20" r="6.5" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1" />
            <path d="M16 15l1.4 2.9 3.2.4-2.3 2.2.6 3.1L16 22l-2.9 1.6.6-3.1-2.3-2.2 3.2-.4z" fill="rgba(255,255,255,.9)" />
        </svg>
    );
}

function XpHex({ className, uid = 'a' }) {
    return (
        <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
            <defs>
                <linearGradient id={`xpHexFill-${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f1eefe" />
                    <stop offset="0.55" stopColor="#d3d9f7" />
                    <stop offset="1" stopColor="#aab6e8" />
                </linearGradient>
                <linearGradient id={`xpHexGloss-${uid}`} x1="0" y1="0" x2="0.8" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            {/* offset dark hexagon behind = the 3D edge */}
            <polygon points="19,10 47,10 61,34 47,58 19,58 5,34" transform="translate(3 3)" fill="#4b5380" />
            <polygon points="19,6 47,6 61,30 47,54 19,54 5,30" fill={`url(#xpHexFill-${uid})`} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.2" strokeLinejoin="round" />
            {/* glossy highlight */}
            <path d="M10 28 L20 10 H40 C30 14 22 22 18 36 C14 34 11 31 10 28Z" fill={`url(#xpHexGloss-${uid})`} />
            <text x="33" y="39" textAnchor="middle" fontSize="23" fontWeight="900" fontFamily="'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif" fill="#2d3358" letterSpacing="-1">XP</text>
        </svg>
    );
}

function Avatar({ person, className }) {
    const [broken, setBroken] = useState(false);
    const initial = (person.name || 'S').trim().charAt(0).toUpperCase();
    if (person.avatar_url && !broken) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={person.avatar_url} alt="" className={className} referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} />;
    }
    return <span className={`${className} ${styles.avatarFallback}`}>{initial}</span>;
}

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

export default function XpStar() {
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [rows, setRows] = useState([]);
    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch('/api/xp/leaderboard', { cache: 'no-store' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || 'Could not load leaderboard');
            setRows(json.leaderboard || []);
            setMe(json.me || null);
        } catch (e) {
            setError(e.message || 'Could not load leaderboard');
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch my own XP once so the star can show a small badge.
    useEffect(() => { load(); }, [load]);

    const openSheet = () => { setClosing(false); setOpen(true); load(); };
    const closeSheet = useCallback(() => {
        setClosing(true);
        setTimeout(() => { setOpen(false); setClosing(false); }, 220);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [open, closeSheet]);

    const top3 = rows.slice(0, 3);
    const rest = rows.slice(3);
    // podium display order: 2nd, 1st, 3rd
    const podium = [top3[1], top3[0], top3[2]].filter(Boolean);

    return (
        <>
            <button type="button" className={styles.fab} onClick={openSheet} aria-label="Open XP leaderboard" title="XP Leaderboard">
                <XpHex className={styles.fabHex} uid="fab" />
                <span className={styles.fabXp}>{fmt(me ? me.xp : 0)}</span>
            </button>

            {open && typeof document !== 'undefined' ? createPortal(
                <div className={`${styles.backdrop} ${closing ? styles.backdropOut : ''}`} onClick={closeSheet}>
                    <section
                        className={`${styles.sheet} ${closing ? styles.sheetOut : ''}`}
                        role="dialog"
                        aria-modal="true"
                        aria-label="XP leaderboard"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.grabber} />
                        <header className={styles.head}>
                            <div>
                                <h2 className={styles.title}>XP Leaderboard</h2>
                                <p className={styles.sub}>Earn XP from every exam you take</p>
                            </div>
                            <button type="button" className={styles.close} onClick={closeSheet} aria-label="Close">
                                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                            </button>
                        </header>

                        {me ? (
                            <div className={styles.meCard}>
                                <XpHex className={styles.meStar} uid="me" />
                                <div className={styles.meText}>
                                    <span className={styles.meLabel}>Your XP</span>
                                    <span className={styles.meXp}>{fmt(me.xp)}</span>
                                </div>
                                <span className={styles.mePill}>Rank #{me.rank}</span>
                            </div>
                        ) : null}

                        <div className={styles.body}>
                            {loading && rows.length === 0 ? (
                                <div className={styles.state}><span className={styles.spinner} />Loading…</div>
                            ) : error ? (
                                <div className={styles.state}>
                                    {error}
                                    <button type="button" className={styles.retry} onClick={load}>Retry</button>
                                </div>
                            ) : rows.length === 0 ? (
                                <div className={styles.state}>No students yet.</div>
                            ) : (
                                <>
                                    <div className={styles.podium}>
                                        {podium.map((p) => (
                                            <div key={p.id} className={`${styles.pCol} ${styles[`pCol_${MEDAL[p.rank] || 'none'}`] || ''}`}>
                                                <div className={styles.pAvatarWrap}>
                                                    <Avatar person={p} className={styles.pAvatar} />
                                                    {MEDAL[p.rank] ? <span className={styles.pMedal}><Medal tone={MEDAL[p.rank]} size={p.rank === 1 ? 34 : 28} /></span> : null}
                                                </div>
                                                <span className={styles.pName} title={p.name}>{p.isMe ? 'You' : p.name}</span>
                                                <span className={styles.pXp}>{fmt(p.xp)} XP</span>
                                                <div className={styles.pBlock}><b>{p.rank}</b></div>
                                            </div>
                                        ))}
                                    </div>

                                    {rest.length > 0 ? (
                                        <ol className={styles.list}>
                                            {rest.map((p) => (
                                                <li key={p.id} className={`${styles.item} ${p.isMe ? styles.itemMe : ''}`}>
                                                    <span className={styles.rank}>{p.rank}</span>
                                                    <Avatar person={p} className={styles.avatar} />
                                                    <span className={styles.name} title={p.name}>{p.name}{p.isMe ? <i className={styles.youTag}>You</i> : null}</span>
                                                    <span className={styles.xp}>{fmt(p.xp)}<small>XP</small></span>
                                                </li>
                                            ))}
                                        </ol>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </section>
                </div>,
                document.body
            ) : null}
        </>
    );
}
