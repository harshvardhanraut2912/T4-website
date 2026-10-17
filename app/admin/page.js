"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminHref } from "@/components/admin/useAdminHref";
import s from "./dashboard.module.css";
import XpToppers from "./XpToppers";


const DEMO_NOTIFICATIONS = [
  { type: "exam", title: "New exam workflow ready", text: "OMR sheets can now be generated from the Exams section.", time: "Just now", icon: "▣" },
  { type: "student", title: "Student activity", text: "New student registrations will appear here automatically.", time: "2h ago", icon: "●" },
  { type: "system", title: "System update", text: "Notification centre is currently using demo data.", time: "Yesterday", icon: "✦" },
];

const DEMO_TOPPERS = [
  { fullName: "Aarav Sharma", percentage: 96, email: "demo-1" },
  { fullName: "Ananya Patil", percentage: 93, email: "demo-2" },
  { fullName: "Vedant Kulkarni", percentage: 91, email: "demo-3" },
];

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name) {
  return String(name || "Student").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "S";
}

function StatIcon({ children }) {
  return <span className={s.statIcon} aria-hidden="true">{children}</span>;
}

export default function AdminOverviewPage() {
  const href = useAdminHref();
  const [stats, setStats] = useState(null);
  const [exams, setExams] = useState([]);
  const [linked, setLinked] = useState({});
  const [appInstalls, setAppInstalls] = useState(null);
  const [topToppers, setTopToppers] = useState(DEMO_TOPPERS);
  const [topperMode, setTopperMode] = useState("demo");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [statsRes, examsRes, linkedRes, installsRes] = await Promise.all([
          fetch("/api/admin/dashboard-stats", { cache: "no-store" }),
          fetch("/api/admin/exam-papers", { cache: "no-store" }),
          fetch("/api/admin/exam-deploy", { cache: "no-store" }),
          fetch("/api/admin/app-installs", { cache: "no-store" }),
        ]);
        const [statsData, examsData, linkedData, installsData] = await Promise.all([
          statsRes.json().catch(() => ({})),
          examsRes.json().catch(() => ({})),
          linkedRes.json().catch(() => ({})),
          installsRes.json().catch(() => ({})),
        ]);
        if (!alive) return;
        setStats(statsData || null);
        setExams(Array.isArray(examsData.exams) ? examsData.exams : []);
        setLinked(linkedData.linked || {});
        if (!installsData.error) setAppInstalls(installsData);
      } catch (err) {
        console.error("Overview load failed:", err);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const recentExam = exams[0] || null;
  const recentExamName = recentExam?.mock_test_name || recentExam?.mock_slug || recentExam?.id || "No exams yet";
  const recentProduct = recentExam ? (linked[recentExam.id] || [])[0] : null;

  useEffect(() => {
    let alive = true;
    async function loadToppers() {
      if (!recentProduct?.id) {
        setTopToppers(DEMO_TOPPERS);
        setTopperMode("demo");
        return;
      }
      try {
        const res = await fetch(`/api/admin/leaderboard?productId=${encodeURIComponent(recentProduct.id)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.leaderboard) || !data.leaderboard.length) throw new Error("No leaderboard yet");
        if (!alive) return;
        setTopToppers(data.leaderboard.slice(0, 3).map(x => ({ ...x, percentage: Number(x.bestPercentage) || 0 })));
        setTopperMode("live");
      } catch {
        if (alive) {
          setTopToppers(DEMO_TOPPERS);
          setTopperMode("demo");
        }
      }
    }
    loadToppers();
    return () => { alive = false; };
  }, [recentProduct?.id]);

  const questionCount = useMemo(
    () => exams.reduce((sum, exam) => sum + (Number(exam.question_count) || 0), 0),
    [exams]
  );

  const metrics = [
    { label: "Total students", value: stats?.students, sub: "Registered profiles", icon: "♙", tone: "blue", href: href("/students") },
    { label: "Total exams", value: exams.length, sub: `${questionCount.toLocaleString("en-IN")} questions generated`, icon: "▤", tone: "purple", href: href("/exams") },
    { label: "Enrollments", value: stats?.enrollments, sub: "Course & exam enrollments", icon: "◎", tone: "green", href: href("/users1") },
    { label: "App installs", value: appInstalls?.total_installs, sub: appInstalls ? `${appInstalls.active_last_7_days || 0} active in 7 days` : "Loading install data", icon: "⌁", tone: "orange", href: href("/users1") },
  ];

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <div className={s.eyebrow}>ADMIN CONTROL CENTRE</div>
          <h1 className={s.title}>Overview</h1>
          <p className={s.subtitle}>Everything important about your institute, exams and students at a glance.</p>
        </div>
        <Link href={href("/exams/create")} className={s.primaryBtn}>+ Create Exam</Link>
      </div>

      <section className={s.statsGrid} aria-label="Key statistics">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href} className={`${s.statCard} ${s[m.tone]}`}>
            <div className={s.statTop}>
              <StatIcon>{m.icon}</StatIcon>
              <span className={s.statArrow}>↗</span>
            </div>
            <div className={s.statValue}>{loading && m.value == null ? <span className={s.skeletonNumber} /> : (m.value ?? "—")}</div>
            <div className={s.statLabel}>{m.label}</div>
            <div className={s.statSub}>{m.sub}</div>
          </Link>
        ))}
      </section>

      <section className={s.mainGrid}>
        <div className={s.leftColumn}>
          <div className={s.sectionHeader}>
            <div>
              <h2>Recent exam</h2>
              <p>Your latest generated examination paper.</p>
            </div>
            <Link href={href("/exams")} className={s.textLink}>View all exams →</Link>
          </div>

          {recentExam ? (
            <Link href={href("/exams")} className={s.recentExam}>
              <div className={s.examGlow} />
              <div className={s.examIcon}>▤</div>
              <div className={s.examInfo}>
                <div className={s.examMeta}><span>RECENT</span><span>{recentExam.exam || "Exam"}</span></div>
                <h3>{recentExamName}</h3>
                <div className={s.examDetails}>
                  <span>{Number(recentExam.question_count) || 0} questions</span>
                  <span>Created {fmtDate(recentExam.created_at)}</span>
                </div>
              </div>
              <div className={s.examOpen}>Open exam <span>→</span></div>
            </Link>
          ) : (
            <div className={s.emptyCard}>No exams have been generated yet. Create your first exam to see it here.</div>
          )}

          <div className={s.sectionHeader}>
            <div>
              <h2>Last exam toppers</h2>
              <p>{recentExam ? recentExamName : "Your highest-performing students"}</p>
            </div>
            <span className={s.livePill}>{topperMode === "live" ? "LIVE RESULTS" : "DEMO PREVIEW"}</span>
          </div>

          <div className={s.toppersCard}>
            {topToppers.map((student, index) => (
              <div key={`${student.email}-${index}`} className={`${s.topper} ${index === 0 ? s.topperWinner : ""}`}>
                <div className={`${s.rank} ${index === 0 ? s.gold : index === 1 ? s.silver : s.bronze}`}>{index + 1}</div>
                <div className={s.avatar}>{student.avatarUrl ? <img src={student.avatarUrl} alt="" /> : initials(student.fullName)}</div>
                <div className={s.studentInfo}>
                  <strong>{student.fullName || "Student"}</strong>
                  <span>{index === 0 ? "Top performer" : index === 1 ? "Excellent result" : "Outstanding result"}</span>
                </div>
                <div className={s.score}><strong>{Number(student.percentage).toFixed(1)}%</strong><span>score</span></div>
              </div>
            ))}
          </div>

          <XpToppers />
        </div>

        <aside className={s.rightColumn}>
          <div className={s.sectionHeader}>
            <div><h2>Notifications</h2><p>Latest admin activity</p></div>
            <span className={s.bell}>●</span>
          </div>
          <div className={s.notificationCard}>
            {DEMO_NOTIFICATIONS.map((n, i) => (
              <div className={s.notification} key={i}>
                <div className={`${s.notificationIcon} ${s[`notif_${n.type}`]}`}>{n.icon}</div>
                <div className={s.notificationBody}><strong>{n.title}</strong><p>{n.text}</p><time className={s.notificationTime}>{n.time}</time></div>
              </div>
            ))}
          </div>
          <div className={s.demoNotice}>Notifications are demo data for now. They can later be connected to the notification centre / push system.</div>

          <div className={s.quickCard}>
            <div className={s.sectionHeader}><div><h2>Needs attention</h2><p>Quick admin signals</p></div></div>
            <Link href={href("/inquiry-reports")} className={s.attentionRow}><span>Unread inquiries</span><b>{stats?.unreadInquiries ?? "—"}</b><span>→</span></Link>
            <Link href={href("/exams")} className={s.attentionRow}><span>Pending error reports</span><b>{stats?.pendingReports ?? "—"}</b><span>→</span></Link>
            <Link href={href("/exams")} className={s.attentionRow}><span>Generated exams</span><b>{exams.length}</b><span>→</span></Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
