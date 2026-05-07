// =====================================================================
// calendar-view.jsx — Calendar tab + "Today's matches" printable card
// =====================================================================

function CalendarView({ tournament, academyName, academyLogo, onUpdate, readOnly = false }) {
  const TeamBadge = window.TeamBadge;
  const fmt = window.formatArabicDate || ((s) => s);

  const allMatches = (tournament.fixtures || []).flat();

  // Build a sorted list of unique dates that have matches
  const datedMatches = allMatches.filter(m => m.date);
  const dateSet = [...new Set(datedMatches.map(m => m.date))].sort();

  // Default to today if it has matches, otherwise nearest upcoming, otherwise first available
  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = (() => {
    if (dateSet.includes(today)) return today;
    const upcoming = dateSet.find(d => d >= today);
    return upcoming || dateSet[0] || today;
  })();
  const [selectedDate, setSelectedDate] = React.useState(defaultDate);

  // Generate a 14-day strip centered on selected date
  const stripDays = React.useMemo(() => {
    const base = new Date(selectedDate || today);
    const days = [];
    for (let i = -3; i < 11; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [selectedDate]);

  const matchesByDate = (date) => allMatches.filter(m => m.date === date);
  const todayMatches = matchesByDate(selectedDate);

  // Sort by time
  todayMatches.sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"));

  const undatedMatches = allMatches.filter(m => !m.date);

  const dayLabel = (iso) => {
    const d = new Date(iso);
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    return dayNames[d.getDay()];
  };
  const dayShort = (iso) => {
    const d = new Date(iso);
    return toArabicNum(d.getDate());
  };
  const monthShort = (iso) => {
    const d = new Date(iso);
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return months[d.getMonth()];
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="calendar-view">
      <div className="calendar-toolbar no-print">
        <div className="calendar-strip">
          {stripDays.map(d => {
            const isSelected = d === selectedDate;
            const isToday = d === today;
            const count = matchesByDate(d).length;
            return (
              <button
                key={d}
                type="button"
                className={`calendar-day ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${count > 0 ? "has-matches" : ""}`}
                onClick={() => setSelectedDate(d)}
              >
                <span className="calendar-day-name">{dayLabel(d)}</span>
                <span className="calendar-day-num">{dayShort(d)}</span>
                <span className="calendar-day-month">{monthShort(d)}</span>
                {count > 0 && <span className="calendar-day-dot">{toArabicNum(count)}</span>}
              </button>
            );
          })}
        </div>
        <button className="btn-print" type="button" onClick={handlePrint}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <path d="M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v7H6z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          طباعة
        </button>
      </div>

      {/* Printable card — beautiful, A4-like */}
      <div className="match-day-card">
        <header className="mdc-header">
          <div className="mdc-brand">
            <div className="mdc-logo">
              {academyLogo ? <img src={academyLogo} alt="" /> : <span className="mdc-logo-fallback">★</span>}
            </div>
            <div>
              <div className="mdc-academy">{academyName || "أكاديمية"}</div>
              <div className="mdc-tournament">{tournament.name}</div>
            </div>
          </div>
          <div className="mdc-date-block">
            <div className="mdc-date-day">{dayLabel(selectedDate)}</div>
            <div className="mdc-date-num">{dayShort(selectedDate)} {monthShort(selectedDate)}</div>
            <div className="mdc-date-year">{toArabicNum(new Date(selectedDate).getFullYear())}</div>
          </div>
        </header>

        <div className="mdc-title-row">
          <div className="mdc-title-line"></div>
          <h2 className="mdc-title">جدول مباريات اليوم</h2>
          <div className="mdc-title-line"></div>
        </div>

        {todayMatches.length === 0 ? (
          <div className="mdc-empty">
            <div className="mdc-empty-icon">⚽</div>
            <div><strong>لا توجد مباريات في هذا اليوم</strong></div>
            <p>اختر يوماً آخر من الشريط أعلاه أو حدّد تاريخ لمباراة من شاشة المباريات.</p>
          </div>
        ) : (
          <div className="mdc-matches">
            {todayMatches.map((m, idx) => (
              <div key={m.id} className="mdc-match">
                <div className="mdc-match-num">{toArabicNum(idx + 1)}</div>
                <div className="mdc-match-time">
                  {m.time ? toArabicNum(m.time) : "—"}
                </div>
                <div className="mdc-match-teams">
                  <div className="mdc-team mdc-team-home">
                    {TeamBadge && <TeamBadge team={tournament.participants.find(p => p.id === m.home.id) || m.home} size={36} />}
                    <span className="mdc-team-name">{m.home.name}</span>
                  </div>
                  <div className="mdc-vs">
                    {m.played
                      ? <span className="mdc-score">{toArabicNum(m.homeScore)} — {toArabicNum(m.awayScore)}</span>
                      : <span className="mdc-vs-label">VS</span>}
                  </div>
                  <div className="mdc-team mdc-team-away">
                    <span className="mdc-team-name">{m.away.name}</span>
                    {TeamBadge && <TeamBadge team={tournament.participants.find(p => p.id === m.away.id) || m.away} size={36} />}
                  </div>
                </div>
                <div className="mdc-match-venue">
                  {m.venue ? <span>📍 {m.venue}</span> : <span style={{ opacity: 0.4 }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="mdc-footer">
          <span>{academyName || "أكاديمية"}</span>
          <span>·</span>
          <span>{tournament.name}</span>
          <span>·</span>
          <span>طُبع في {toArabicNum(new Date().toLocaleDateString("ar"))}</span>
        </footer>
      </div>

      {undatedMatches.length > 0 && (
        <div className="calendar-undated no-print">
          <div className="panel-title">
            <h3>مباريات بدون تاريخ</h3>
            <span className="panel-meta">{toArabicNum(undatedMatches.length)} مباراة</span>
          </div>
          <p style={{ color: "var(--c-text-3)", fontSize: 13, padding: "0 var(--s-3)" }}>
            هذه المباريات لم يُحدّد لها تاريخ بعد. اضغط على أي مباراة في تبويب «المباريات» لإضافة تاريخ ووقت وملعب.
          </p>
        </div>
      )}
    </div>
  );
}

window.CalendarView = CalendarView;

function toArabicNum(n) {
  return String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
}
