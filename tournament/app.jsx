// =====================================================================
// app.jsx — Main shell: sidebar, dashboard, wizard router
// =====================================================================

const { useState: appUseState, useEffect: appUseEffect } = React;

// Shared TeamBadge component — shows logo or first-letter fallback
function TeamBadge({ team, size = 24, className = "" }) {
  const logo = team?.logo;
  const name = team?.name || "";
  const style = { width: size, height: size };
  if (logo) {
    return (
      <span className={`team-badge has-logo ${className}`} style={style}>
        <img src={logo} alt="" />
      </span>
    );
  }
  return (
    <span className={`team-badge ${className}`} style={style}>
      {name.charAt(0)}
    </span>
  );
}
window.TeamBadge = TeamBadge;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfortable",
  "bracketStyle": "horizontal",
  "accent": "#D4AF37",
  "academyName": "أكاديمية بارع",
  "academyLogo": ""
}/*EDITMODE-END*/;

function App() {
  const { buildFootballLeague, buildTableTennisKO } = window.TournamentData;

  const [tournaments, setTournaments] = appUseState(() => [
    buildFootballLeague(),
    buildTableTennisKO(),
  ]);
  // Detect view-only mode from URL hash #/view/<id>
  const initialView = (() => {
    const m = (window.location.hash || "").match(/^#\/view\/([\w-]+)/);
    if (m) return { kind: "tournament", id: m[1], readOnly: true };
    return { kind: "dashboard" };
  })();
  const [view, setView] = appUseState(initialView);
  const [shareForId, setShareForId] = appUseState(null);
  // view kinds: dashboard | wizard:N | tournament:id (with optional readOnly)

  const [draft, setDraft] = appUseState(emptyDraft());
  // ADR-011: TweaksPanel removed in production — apply defaults directly without state.
  const t = TWEAK_DEFAULTS;
  const setTweak = () => {};

  appUseEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme);
    document.documentElement.setAttribute("data-density", t.density);
    document.documentElement.style.setProperty("--c-accent", t.accent);
    // soft variant — translucent version of accent
    const softMap = {
      "#D4AF37": "#F4E4A8",
      "#1F8A5B": "#B7E0CB",
      "#C0392B": "#F2C5C0",
      "#3B7CC4": "#C4DBF1",
    };
    document.documentElement.style.setProperty("--c-accent-soft", softMap[t.accent] || "#F4E4A8");
  }, [t.theme, t.density, t.accent]);

  const goWizard = (step) => setView({ kind: "wizard", step });
  const startNew = () => { setDraft(emptyDraft()); goWizard(1); };
  const openTournament = (id) => setView({ kind: "tournament", id });

  const updateTournament = (updated) => {
    setTournaments(tournaments.map(t => t.id === updated.id ? updated : t));
  };

  const launchDraft = () => {
    const launched = { ...draft, id: `t_${Date.now()}`, status: "active", progress: 0 };
    setTournaments([launched, ...tournaments]);
    setView({ kind: "tournament", id: launched.id });
  };

  return (
    <div className={`app-shell ${view.readOnly ? "is-public-view" : ""}`}>
      {!view.readOnly && (
        <Sidebar
          tournaments={tournaments}
          view={view}
          onNew={startNew}
          onHome={() => setView({ kind: "dashboard" })}
          onOpen={openTournament}
          academyName={t.academyName}
          academyLogo={t.academyLogo}
          onLogoChange={(url) => setTweak("academyLogo", url)}
          onNameChange={(n) => setTweak("academyName", n)}
        />
      )}

      <main className="main-area">
        {!view.readOnly && (
          <TopBar view={view} draft={draft} tournaments={tournaments} onHome={() => setView({ kind: "dashboard" })} />
        )}

        <div className="content-area">
          {view.kind === "dashboard" && (
            <Dashboard tournaments={tournaments} onNew={startNew} onOpen={openTournament} />
          )}
          {view.kind === "wizard" && (
            <WizardRouter
              step={view.step}
              draft={draft}
              setDraft={setDraft}
              onStepChange={goWizard}
              onLaunch={launchDraft}
              onCancel={() => setView({ kind: "dashboard" })}
            />
          )}
          {view.kind === "tournament" && (
            <TournamentDetail
              tournament={tournaments.find(x => x.id === view.id)}
              onUpdate={updateTournament}
              onBack={() => setView({ kind: "dashboard" })}
              bracketStyle={t.bracketStyle}
              readOnly={!!view.readOnly}
              onShare={() => setShareForId(view.id)}
              onDelete={() => {
                setTournaments(tournaments.filter(x => x.id !== view.id));
                setView({ kind: "dashboard" });
              }}
              onExitPreview={() => {
                window.location.hash = "";
                setView({ kind: "tournament", id: view.id });
              }}
            />
          )}
        </div>
      </main>

      {shareForId && (
        <ShareModal
          tournament={tournaments.find(x => x.id === shareForId)}
          onClose={() => setShareForId(null)}
          onPreview={() => {
            const id = shareForId;
            setShareForId(null);
            window.location.hash = `#/view/${id}`;
            setView({ kind: "tournament", id, readOnly: true });
          }}
        />
      )}

    </div>
  );
}

function emptyDraft() {
  return {
    name: "", sport: null, competitionType: null, type: null,
    config: { points: { win: 3, draw: 1, loss: 0 }, tiebreak: "gd", bestOf: 1, thirdPlace: true, seeding: "auto" },
    participants: [],
    pointsSystem: { mode: "perMatch", win: 10, draw: 5, loss: 2, first: 100, second: 60, third: 40 },
    fixtures: null, bracket: null, groups: null,
  };
}

// ====================== SIDEBAR ======================
function Sidebar({ tournaments, view, onNew, onHome, onOpen, academyName, academyLogo, onLogoChange, onNameChange }) {
  const fileRef = React.useRef(null);
  const [editingName, setEditingName] = React.useState(false);
  const [tempName, setTempName] = React.useState(academyName || "");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLogoChange(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <aside className="sidebar" data-screen-label="Sidebar">
      <div className="brand">
        <button
          type="button"
          className={`brand-mark ${academyLogo ? "has-logo" : ""}`}
          onClick={() => fileRef.current?.click()}
          title="تغيير شعار الأكاديمية"
        >
          {academyLogo ? (
            <img src={academyLogo} alt="" />
          ) : (
            <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
              <path d="M16 2l3.5 7.5L28 11l-6 6 1.5 9-7.5-4-7.5 4L10 17 4 11l8.5-1.5z" fill="currentColor"/>
            </svg>
          )}
          <span className="brand-mark-edit">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <div className="brand-text">
          <div className="brand-name">بطولة</div>
          {editingName ? (
            <input
              className="brand-sub-input"
              value={tempName}
              autoFocus
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => { onNameChange(tempName.trim() || "أكاديمية"); setEditingName(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setTempName(academyName); setEditingName(false); } }}
            />
          ) : (
            <button className="brand-sub" type="button" onClick={() => { setTempName(academyName); setEditingName(true); }}>
              {academyName}
            </button>
          )}
        </div>
        {academyLogo && (
          <button
            type="button"
            className="brand-logo-clear"
            title="إزالة الشعار"
            onClick={() => onLogoChange("")}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        )}
      </div>

      <button className="new-tournament-btn" onClick={onNew}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        بطولة جديدة
      </button>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${view.kind === "dashboard" ? "is-active" : ""}`}
          onClick={onHome}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
            <rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
            <rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
            <rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
          </svg>
          الرئيسية
        </button>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-label">البطولات الحالية</div>
        <div className="tournament-list">
          {tournaments.map(t => (
            <button
              key={t.id}
              className={`tournament-item ${view.kind === "tournament" && view.id === t.id ? "is-active" : ""}`}
              onClick={() => onOpen(t.id)}
            >
              <span className="ti-icon">{t.sport.emoji}</span>
              <div className="ti-body">
                <div className="ti-name">{t.name}</div>
                <div className="ti-meta">
                  <span className={`ti-status ti-${t.status}`}>
                    {t.status === "active" ? "جارية" : t.status === "completed" ? "منتهية" : "مسودة"}
                  </span>
                  <span>·</span>
                  <span>{toArabicNum(t.participants.length)} مشارك</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="footer-user">
          <div className="user-avatar">م</div>
          <div>
            <div className="user-name">المدرب أحمد</div>
            <div className="user-role">مدرب أول</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ====================== TOP BAR ======================
function TopBar({ view, draft, tournaments, onHome }) {
  let crumbs = [{ label: "الرئيسية", onClick: onHome }];
  if (view.kind === "wizard") {
    crumbs.push({ label: draft.name || "بطولة جديدة" });
    crumbs.push({ label: ["الإنشاء","الإعدادات","المشاركون","النقاط","المعاينة"][view.step - 1] });
  } else if (view.kind === "tournament") {
    const t = tournaments.find(x => x.id === view.id);
    if (t) crumbs.push({ label: t.name });
  }
  return (
    <div className="topbar">
      <div className="breadcrumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="crumb-sep">/</span>}
            {c.onClick ? (
              <button className="crumb-btn" onClick={c.onClick}>{c.label}</button>
            ) : (
              <span className="crumb-current">{c.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" title="بحث">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="icon-btn" title="الإشعارات">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M6 8a6 6 0 0112 0v4l1.5 3h-15L6 12V8zM10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="dot-badge"></span>
        </button>
      </div>
    </div>
  );
}

// ====================== DASHBOARD ======================
function Dashboard({ tournaments, onNew, onOpen }) {
  return (
    <div className="dashboard" data-screen-label="00 Dashboard">
      <header className="dashboard-hero">
        <div>
          <div className="eyebrow">لوحة التحكم</div>
          <h1>أهلاً، المدرب أحمد 👋</h1>
          <p className="lede">عندك {toArabicNum(tournaments.filter(t => t.status === "active").length)} بطولات جارية. أنشئ بطولة جديدة أو افتح وحدة من اللي تحت.</p>
        </div>
        <button className="btn-primary btn-lg" onClick={onNew}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ marginLeft: 8 }}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          بطولة جديدة
        </button>
      </header>

      <section className="kpi-row">
        <KPI label="بطولات جارية" value={tournaments.filter(t => t.status === "active").length} icon="🏆" />
        <KPI label="بطولات منتهية" value={tournaments.filter(t => t.status === "completed").length} icon="✓" />
        <KPI label="إجمالي المشاركين" value={tournaments.reduce((s, t) => s + t.participants.length, 0)} icon="👥" />
        <KPI label="مباريات هذا الأسبوع" value={12} icon="📅" />
      </section>

      <section>
        <h2 className="section-title">البطولات</h2>
        <div className="tournament-cards">
          {tournaments.map(t => (
            <TournamentCard key={t.id} tournament={t} onOpen={() => onOpen(t.id)} />
          ))}
          <button className="add-tournament-card" onClick={onNew}>
            <div className="add-icon">+</div>
            <div className="add-label">إنشاء بطولة جديدة</div>
            <div className="add-sub">٥ خطوات بسيطة</div>
          </button>
        </div>
      </section>
    </div>
  );
}

function KPI({ label, value, icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-num">{toArabicNum(value)}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function TournamentCard({ tournament, onOpen }) {
  const matchesPlayed = tournament.fixtures
    ? tournament.fixtures.flat().filter(m => m.played).length
    : tournament.bracket
      ? tournament.bracket.rounds.flat().filter(m => m.played).length
      : 0;
  const totalMatches = tournament.fixtures
    ? tournament.fixtures.flat().length
    : tournament.bracket
      ? tournament.bracket.rounds.flat().length
      : 0;
  const progress = totalMatches ? Math.round((matchesPlayed / totalMatches) * 100) : 0;

  return (
    <button className={`tournament-card status-${tournament.status}`} onClick={onOpen}>
      <div className="tc-top">
        <div className="tc-icon">{tournament.sport.emoji}</div>
        <span className={`tc-status status-${tournament.status}`}>
          {tournament.status === "active" ? "جارية" : tournament.status === "completed" ? "منتهية" : "مسودة"}
        </span>
      </div>
      <div className="tc-name">{tournament.name}</div>
      <div className="tc-meta">
        <span>{tournamentTypeLabel(tournament.type)}</span>
        <span>·</span>
        <span>{toArabicNum(tournament.participants.length)} مشارك</span>
      </div>
      <div className="tc-progress">
        <div className="tc-progress-bar">
          <div className="tc-progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="tc-progress-meta">
          <span>{toArabicNum(matchesPlayed)} / {toArabicNum(totalMatches)} مباراة</span>
          <span>{toArabicNum(progress)}%</span>
        </div>
      </div>
    </button>
  );
}

// ====================== WIZARD ROUTER ======================
function WizardRouter({ step, draft, setDraft, onStepChange, onLaunch, onCancel }) {
  return (
    <div className="wizard" data-screen-label={`Wizard step ${step}`}>
      <WizardSteps step={step} onJump={(s) => onStepChange(s)} />
      {step === 1 && <ScreenCreate draft={draft} setDraft={setDraft} onNext={() => onStepChange(2)} />}
      {step === 2 && <ScreenSettings draft={draft} setDraft={setDraft} onNext={() => onStepChange(3)} onBack={() => onStepChange(1)} />}
      {step === 3 && <ScreenParticipants draft={draft} setDraft={setDraft} onNext={() => onStepChange(4)} onBack={() => onStepChange(2)} />}
      {step === 4 && <ScreenPoints draft={draft} setDraft={setDraft} onNext={() => onStepChange(5)} onBack={() => onStepChange(3)} />}
      {step === 5 && <ScreenPreview draft={draft} setDraft={setDraft} onBack={() => onStepChange(4)} onLaunch={onLaunch} />}
    </div>
  );
}

function WizardSteps({ step, onJump }) {
  const steps = [
    { n: 1, label: "إنشاء" },
    { n: 2, label: "إعدادات" },
    { n: 3, label: "مشاركون" },
    { n: 4, label: "نقاط" },
    { n: 5, label: "معاينة" },
  ];
  return (
    <div className="wizard-steps">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <button
            className={`wstep ${step === s.n ? "is-current" : step > s.n ? "is-done" : ""}`}
            onClick={() => step > s.n && onJump(s.n)}
            disabled={step < s.n}
          >
            <span className="wstep-num">
              {step > s.n ? (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : toArabicNum(s.n)}
            </span>
            <span className="wstep-label">{s.label}</span>
          </button>
          {i < steps.length - 1 && <div className={`wstep-line ${step > s.n ? "is-done" : ""}`}></div>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ====================== TOURNAMENT DETAIL ======================
function TournamentDetail({ tournament, onUpdate, onBack, bracketStyle, readOnly = false, onShare, onDelete, onExitPreview }) {
  const isLeague = tournament.type === "league";
  const [tab, setTab] = React.useState(isLeague ? "standings" : "matches");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  if (!tournament) return null;
  const isTeam = !!tournament.sport?.team;
  const getRoster = (teamId) => tournament.participants.find(p => p.id === teamId)?.roster || [];
  // In readOnly mode, swallow updates
  const guardedUpdate = readOnly ? () => {} : onUpdate;

  return (
    <div className={`screen tournament-detail ${readOnly ? "is-readonly" : ""}`} data-screen-label={`Tournament: ${tournament.name}`}>
      {readOnly && (
        <div className="readonly-banner">
          <span className="readonly-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </span>
          <span>وضع المشاهدة — العرض فقط، لا يمكن إدخال أي تعديل</span>
          {onExitPreview && (
            <button className="readonly-exit" onClick={onExitPreview} type="button">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              خروج من المعاينة
            </button>
          )}
        </div>
      )}
      <header className="screen-header">
        <div>
          <div className="eyebrow">
            <span className={`status-chip status-${tournament.status}`}>
              {tournament.status === "active" ? "جارية" : tournament.status === "completed" ? "منتهية" : "مسودة"}
            </span>
            <span style={{ marginInlineStart: 8 }}>{tournamentTypeLabel(tournament.type)}</span>
          </div>
          <h1>{tournament.sport.emoji} {tournament.name}</h1>
          <p className="lede">
            {toArabicNum(tournament.participants.length)} مشارك ·
            {tournament.config?.doubleRound ? " ذهاب وإياب " : " ذهاب فقط "}
          </p>
        </div>
        {!readOnly && onShare && (
          <div className="header-actions">
            <button className="btn-secondary share-btn" onClick={onShare} type="button">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="17" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="17" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M8 11l7-4M8 13l7 4" stroke="currentColor" strokeWidth="1.6"/>
              </svg>
              مشاركة رابط للمشاهدة
            </button>
            <div className="more-menu-wrap" ref={menuRef}>
              <button
                className="btn-icon-square"
                onClick={() => setMenuOpen(v => !v)}
                aria-label="المزيد"
                type="button"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <circle cx="6" cy="12" r="1.6" fill="currentColor"/>
                  <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
                  <circle cx="18" cy="12" r="1.6" fill="currentColor"/>
                </svg>
              </button>
              {menuOpen && (
                <div className="more-menu">
                  <button
                    className="more-item"
                    type="button"
                    onClick={() => { setEditing(true); setMenuOpen(false); }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                      <path d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    تعديل البطولة
                  </button>
                  <button
                    className="more-item"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onUpdate({ ...tournament, status: tournament.status === "completed" ? "active" : "completed" });
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {tournament.status === "completed" ? "إعادة تنشيط" : "إنهاء البطولة"}
                  </button>
                  <div className="more-sep"></div>
                  <button
                    className="more-item danger"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (confirm(`حذف "${tournament.name}" نهائياً؟ لا يمكن التراجع.`)) {
                        onDelete && onDelete();
                      }
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                      <path d="M5 7h14M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-7 0v12a2 2 0 002 2h6a2 2 0 002-2V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    حذف البطولة
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {isTeam && tournament.sport?.id === "football" && isLeague && (
        <div className="detail-tabs">
          <button
            type="button"
            className={`detail-tab ${tab === "standings" ? "is-active" : ""}`}
            onClick={() => setTab("standings")}
          >
            <span>🏆</span><span>جدول الترتيب</span>
          </button>
          <button
            type="button"
            className={`detail-tab ${tab === "matches" ? "is-active" : ""}`}
            onClick={() => setTab("matches")}
          >
            <span>🏟️</span><span>المباريات</span>
          </button>
          <button
            type="button"
            className={`detail-tab ${tab === "calendar" ? "is-active" : ""}`}
            onClick={() => setTab("calendar")}
          >
            <span>📅</span><span>التقويم</span>
          </button>
          <button
            type="button"
            className={`detail-tab ${tab === "stats" ? "is-active" : ""}`}
            onClick={() => setTab("stats")}
          >
            <span>📊</span><span>إحصائيات اللاعبين</span>
          </button>
        </div>
      )}

      {isTeam && tournament.sport?.id === "football" && !isLeague && (
        <div className="detail-tabs">
          <button
            type="button"
            className={`detail-tab ${tab === "matches" ? "is-active" : ""}`}
            onClick={() => setTab("matches")}
          >
            <span>🏟️</span><span>المباريات</span>
          </button>
          <button
            type="button"
            className={`detail-tab ${tab === "calendar" ? "is-active" : ""}`}
            onClick={() => setTab("calendar")}
          >
            <span>📅</span><span>التقويم</span>
          </button>
          <button
            type="button"
            className={`detail-tab ${tab === "stats" ? "is-active" : ""}`}
            onClick={() => setTab("stats")}
          >
            <span>📊</span><span>إحصائيات اللاعبين</span>
          </button>
        </div>
      )}

      <div className="preview-body">
        {tab === "standings" && isLeague && (
          <LeagueView tournament={tournament} onUpdate={guardedUpdate} readOnly={readOnly} mode="standings" />
        )}
        {tab === "matches" && isLeague && (
          <LeagueView tournament={tournament} onUpdate={guardedUpdate} readOnly={readOnly} mode="matches" />
        )}
        {tab === "calendar" && window.CalendarView && (
          <window.CalendarView
            tournament={tournament}
            academyName={t.academyName}
            academyLogo={t.academyLogo}
            onUpdate={guardedUpdate}
            readOnly={readOnly}
          />
        )}
        {tab === "matches" && tournament.type === "knockout" && (
          <BracketView
            bracket={tournament.bracket}
            onUpdate={(b) => guardedUpdate({ ...tournament, bracket: b })}
            bestOf={tournament.config?.bestOf || 1}
            style={bracketStyle}
            sport={tournament.sport}
            getRoster={getRoster}
            readOnly={readOnly}
          />
        )}
        {tab === "stats" && <StatsView tournament={tournament} />}
      </div>

      {editing && window.EditTournamentModal && (
        <window.EditTournamentModal
          tournament={tournament}
          onClose={() => setEditing(false)}
          onSave={(next) => { onUpdate(next); setEditing(false); }}
          onArchive={() => { onUpdate({ ...tournament, status: "completed" }); setEditing(false); }}
        />
      )}
    </div>
  );
}

// ====================== SHARE MODAL ======================
function ShareModal({ tournament, onClose, onPreview }) {
  if (!tournament) return null;
  const [copied, setCopied] = React.useState(false);
  const url = `${window.location.origin}${window.location.pathname}#/view/${tournament.id}`;

  const copy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {}
      document.body.removeChild(ta);
    }
  };

  const openPreview = () => {
    if (onPreview) onPreview();
    else window.open(url, "_blank", "noopener");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-share" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>مشاركة البطولة</h2>
            <p className="lede" style={{ fontSize: 13, marginTop: 4 }}>
              رابط للعرض والمشاهدة فقط — لا يمكن للمستلم إدخال نتائج أو تعديل
            </p>
          </div>
          <button className="row-remove" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        <div className="modal-body share-body">
          <div className="share-card">
            <div className="share-card-icon">{tournament.sport.emoji}</div>
            <div className="share-card-info">
              <div className="share-card-name">{tournament.name}</div>
              <div className="share-card-meta">
                {toArabicNum(tournament.participants.length)} مشارك · {tournamentTypeLabel(tournament.type)}
              </div>
            </div>
            <span className={`share-status status-${tournament.status}`}>
              {tournament.status === "active" ? "جارية" : tournament.status === "completed" ? "منتهية" : "مسودة"}
            </span>
          </div>

          <div className="share-perms">
            <div className="share-perm">
              <span className="share-perm-icon ok">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <span>عرض جدول الترتيب والمباريات والأهداف</span>
            </div>
            <div className="share-perm">
              <span className="share-perm-icon ok">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <span>عرض إحصائيات اللاعبين</span>
            </div>
            <div className="share-perm">
              <span className="share-perm-icon no">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </span>
              <span className="muted">إدخال أو تعديل النتائج</span>
            </div>
          </div>

          <div className="share-link-wrap">
            <label className="field-label">رابط المشاركة</label>
            <div className="share-link-row">
              <input
                type="text"
                className="text-input share-link-input"
                value={url}
                readOnly
                onFocus={e => e.target.select()}
              />
              <button
                className={`btn-primary share-copy ${copied ? "is-copied" : ""}`}
                onClick={copy}
                type="button"
              >
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    تم النسخ
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    نسخ الرابط
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="share-channels">
            <a
              className="share-channel"
              href={`https://wa.me/?text=${encodeURIComponent(`متابعة بطولة ${tournament.name}: ${url}`)}`}
              target="_blank" rel="noopener"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 4A11 11 0 005 20l-1 4 4-1A11 11 0 1020 4zm-8 18a9 9 0 01-4.5-1.2l-.3-.2-2.7.7.7-2.6-.2-.3A9 9 0 1112 22zm5-6.6c-.3-.1-1.6-.8-1.9-.9s-.4 0-.6.2-.7.9-.8 1-.3.2-.6 0-1.2-.4-2.3-1.4c-.8-.7-1.4-1.6-1.5-1.9s0-.4.1-.6l.4-.5c.1-.2.2-.3.2-.5s0-.4 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4s-.9.9-.9 2.2.9 2.6 1 2.8 1.9 2.8 4.5 3.9c2.6 1 2.6.7 3.1.7s1.6-.7 1.8-1.3c.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3z"/></svg>
              واتساب
            </a>
            <a
              className="share-channel"
              href={`mailto:?subject=${encodeURIComponent(tournament.name)}&body=${encodeURIComponent(`متابعة بطولة ${tournament.name}:\n\n${url}`)}`}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              بريد إلكتروني
            </a>
            <button className="share-channel" type="button" onClick={openPreview}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M14 4h6v6M20 4l-9 9M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              معاينة
            </button>
          </div>
        </div>

        <footer className="modal-footer">
          <span className="modal-meta">يمكن لأي شخص يملك هذا الرابط مشاهدة البطولة</span>
          <button className="btn-ghost" onClick={onClose} type="button">إغلاق</button>
        </footer>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
