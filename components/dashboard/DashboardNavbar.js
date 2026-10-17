'use client';

// components/dashboard/DashboardNavbar.js
//
// Student dashboard top bar. Behaviour is unchanged; only the UI/branding is presented in an iOS-inspired style.

import { useState, useEffect, useRef } from 'react';
import styles from './dashboard.module.css';
import XpStar from '@/components/xp/XpStar';

export default function DashboardNavbar({ session, onLogout, onHamburgerClick }) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [avatarBroken, setAvatarBroken] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        const saved = localStorage.getItem('theme') || 'light';
        setIsDark(saved === 'dark');
    }, []);

    useEffect(() => {
        function handleOutsideClick(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    function toggleTheme(e) {
        const next = e.target.checked ? 'dark' : 'light';
        setIsDark(e.target.checked);
        localStorage.setItem('theme', next);
        document.documentElement.setAttribute('data-theme', next);
    }

    const email = session?.user?.email || '';
    const initial = email.charAt(0).toUpperCase();
    const avatarUrl = session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || '';

    return (
        <nav className={styles.topbar}>
            <div className={styles.topLeft}>
                <button
                    type="button"
                    id="dashboard-hamburger-btn"
                    className={styles.hamburgerBtn}
                    onClick={onHamburgerClick}
                    aria-label="Open menu"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                    </svg>
                </button>
                <a href="/dashboard" className={styles.brand} aria-label="T4 Academy dashboard">
                    <img
                        src="/images/other_images/class-logo.png"
                        alt="T4 Academy"
                        className={styles.brandImage}
                    />
                    <span className={styles.brandWords}>
                        <span className={styles.brandTag}>Student Dashboard</span>
                    </span>
                </a>
            </div>

            <div className={styles.topRight} ref={wrapRef}>
                {session ? <XpStar /> : null}
                <span className={styles.deskPill}>
                    <span className={styles.deskPillDot} />
                    Student
                </span>
                {session ? (
                    <>
                        <button
                            type="button"
                            className={styles.avatar}
                            aria-label="Account menu"
                            aria-expanded={dropdownOpen}
                            onClick={(e) => { e.stopPropagation(); setDropdownOpen((v) => !v); }}
                        >
                            {avatarUrl && !avatarBroken ? (
                                <img src={avatarUrl} alt="Profile" referrerPolicy="no-referrer" onError={() => setAvatarBroken(true)} />
                            ) : initial}
                        </button>
                        <div className={`${styles.menu} ${dropdownOpen ? styles.menuOpen : ''}`}>
                            <div className={styles.menuHead}>{email}</div>
                            <a href="/profile" className={styles.menuItem}>My Profile</a>
                            <div className={styles.themeRow}>
                                <span className={styles.themeLabel}>Dark Mode</span>
                                <label className={styles.switch}>
                                    <input type="checkbox" checked={isDark} onChange={toggleTheme} />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>

                            <a href="/shop" className={styles.menuItem}>Purchase History</a>
                            <button type="button" className={`${styles.menuItem} ${styles.menuOut}`} onClick={onLogout}>
                                Logout
                            </button>
                        </div>
                    </>
                ) : (
                    <a href="/login" className={styles.signIn}>Sign In</a>
                )}
            </div>
        </nav>
    );
}
