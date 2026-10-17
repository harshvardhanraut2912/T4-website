'use client';

// components/dashboard/MainSidebar.js
//
// Left panel: lists ONLY sidebar_main_sections rows. Clicking one notifies
// the parent (app/dashboard/page.js), which swaps the right-hand panel.
// This panel itself never re-renders its list based on selection -- only
// the active highlight changes.

import Link from 'next/link';
import styles from './dashboard.module.css';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

// trainingMode: null when browsing courses; 'home' | 'speedrun' | 'freeflow' while inside the
// Training space (the left rail is swapped for the training navigation).
export default function MainSidebar({ sections, activeId, onSelect, mobileOpen, trainingMode = null, onNavigate }) {
    if (trainingMode) {
        return (
            <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarLabel}>Training</div>
                <nav className={styles.sidebarNav}>
                    {[
                        { key: 'speedrun', href: '/dashboard/training/speedrun', icon: '⚡', label: 'SpeedRun' },
                        { key: 'freeflow', href: '/dashboard/training/freeflow', icon: '∞', label: 'FreeFlow' },
                        { key: 'ultimate', href: '/dashboard/training/ultimate', icon: '♾', label: 'Ultimate Practice' },
                    ].map((item) => (
                        <Link
                            key={item.key}
                            href={item.href}
                            onClick={onNavigate}
                            className={`${styles.sidebarItem} ${trainingMode === item.key ? styles.sidebarItemActive : ''}`}
                            style={{ textDecoration: 'none' }}
                        >
                            <span className={styles.sidebarIconFallback}>{item.icon}</span>
                            <span className={styles.sidebarItemLabel}>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className={styles.sidebarLabel} style={{ marginTop: 18 }}>Study</div>
                <nav className={styles.sidebarNav}>
                    <Link href="/dashboard" onClick={onNavigate} className={styles.sidebarItem} style={{ textDecoration: 'none' }}>
                        <span className={styles.sidebarIconFallback}>←</span>
                        <span className={styles.sidebarItemLabel}>Back to My Courses</span>
                    </Link>
                </nav>

                <div className={styles.railFoot}>
                    <div className={styles.railFootTitle}>Have a doubt?</div>
                    <p className={styles.railFootText}>Need help? Get guidance from the support team anytime.</p>
                    <a href="/contact" className={styles.railFootLink}>Contact us</a>
                </div>
            </aside>
        );
    }

    return (
        <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
            <div className={styles.sidebarLabel}>My Courses</div>
            <nav className={styles.sidebarNav}>
                {sections.map((section, index) => (
                    <button
                        key={section.id}
                        type="button"
                        id={index === 0 ? 'dashboard-first-section-item' : undefined}
                        className={`${styles.sidebarItem} ${activeId === section.id ? styles.sidebarItemActive : ''}`}
                        onClick={() => onSelect(section)}
                    >
                        {section.icon_url ? (
                            <img
                                src={resolveImageUrl(section.icon_url)}
                                alt=""
                                className={styles.sidebarIcon}
                            />
                        ) : (
                            <span className={styles.sidebarIconFallback}>{section.name.charAt(0)}</span>
                        )}
                        <span className={styles.sidebarItemLabel}>{section.name}</span>
                        {section.badge_label ? (
                            <span className={styles.sidebarBadge}>{section.badge_label}</span>
                        ) : null}
                    </button>
                ))}
                {sections.length === 0 ? (
                    <div className={styles.sidebarEmpty}>No sections yet.</div>
                ) : null}
            </nav>

            <style>{`
                @keyframes trainingGroundGlow {
                    0%, 100% { box-shadow: 0 0 0 1px rgba(96, 165, 250, .35), 0 0 9px rgba(59, 130, 246, .28); }
                    50% { box-shadow: 0 0 0 1px rgba(147, 197, 253, .75), 0 0 18px rgba(59, 130, 246, .72); }
                }
                .training-ground-glow {
                    display: flex; align-items: center; gap: 10px; margin: 10px 8px 0; padding: 11px 12px;
                    border: 1px solid rgba(96, 165, 250, .65); border-radius: 10px; color: #eff6ff;
                    background: linear-gradient(110deg, rgba(37, 99, 235, .35), rgba(14, 165, 233, .16));
                    text-decoration: none; font-weight: 800; font-size: 13px; animation: trainingGroundGlow 2s ease-in-out infinite;
                }
                .training-ground-glow:hover { background: linear-gradient(110deg, rgba(37, 99, 235, .55), rgba(14, 165, 233, .28)); }
                .training-ground-glow-icon { display: inline-flex; width: 25px; height: 25px; align-items: center; justify-content: center; border-radius: 8px; background: rgba(96, 165, 250, .25); }
                @media (prefers-reduced-motion: reduce) { .training-ground-glow { animation: none; } }
            `}</style>
            <Link href="/dashboard/training" onClick={onNavigate} className="training-ground-glow">
                <span className="training-ground-glow-icon" aria-hidden="true">✦</span>
                <span>Training Ground</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, letterSpacing: '.06em', opacity: .9 }}>PRACTICE</span>
            </Link>

            <div className={styles.railFoot}>
                <div className={styles.railFootTitle}>Have a doubt?</div>
                <p className={styles.railFootText}>Need help? Get guidance from the support team anytime.</p>
                <a href="/contact" className={styles.railFootLink}>Contact us</a>
            </div>
        </aside>
    );
}