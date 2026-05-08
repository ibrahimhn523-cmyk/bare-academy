// =====================================================================
// player-profile.jsx — Player profile modal
// =====================================================================

function PlayerProfileModal({ playerName, tournament, onClose }) {
  const TeamBadge = window.TeamBadge;

  // Find the player's team and id by scanning rosters
  const teamInfo = (() => {
    for (const team of tournament.participants || []) {
      const found = (team.roster || []).find(r => r.name === playerName);
      if (found) return { team, playerId: found.id };
    }
    return { team: null, playerId: null };
  })();

  // Collect all matches the player appeared in
  const allMatches = (tournament.fixtures || []).flat();
  const playerMatches = [];

  allMatches.forEach(m => {
    if (!m.played) return;
    const homeStarter = m.lineups?.home?.includes(teamInfo.playerId);
    const awayStarter = m.lineups?.away?.includes(teamInfo.playerId);
    const inGoals = (m.events || []).some(e => e.type === "goal" && (e.scorer === playerName || e.assist === playerName));
    const inCards = (m.events || []).some(e => e.type === "card" && e.player === playerName);
    if (homeStarter || awayStarter || inGoals || inCards) {
      const side = homeStarter ? "home" : awayStarter ? "away" :
        (m.events || []).find(e => (e.scorer === playerName || e.assist === playerName || e.player === playerName))?.team;
      const goalsInMatch = (m.events || []).filter(e => e.type === "goal" && e.scorer === playerName).length;
      const assistsInMatch = (m.events || []).filter(e => e.type === "goal" && e.assist === playerName).length;
      const yellowsInMatch = (m.events || []).filter(e => e.type === "card" && e.color === "yellow" && e.player === playerName).length;
      const redsInMatch = (m.events || []).filter(e => e.type === "card" && e.color === "red" && e.player === playerName).length;
      const rating = m.ratings?.[teamInfo.playerId];
      playerMatches.push({
        match: m,
        side,
        goalsInMatch,
        assistsInMatch,
        yellowsInMatch,
        redsInMatch,
        rating,
      });
    }
  });

  // Aggregate
  const total = playerMatches.reduce((acc, pm) => ({
    goals: acc.goals + pm.goalsInMatch,
    assists: acc.assists + pm.assistsInMatch,
    yellow: acc.yellow + pm.yellowsInMatch,
    red: acc.red + pm.redsInMatch,
    matches: acc.matches + 1,
    ratingSum: acc.ratingSum + (pm.rating || 0),
    ratingCount: acc.ratingCount + (pm.rating ? 1 : 0),
  }), { goals: 0, assists: 0, yellow: 0, red: 0, matches: 0, ratingSum: 0, ratingCount: 0 });
  const avgRating = total.ratingCount > 0 ? (total.ratingSum / total.ratingCount) : 0;

  // Form (last 5 matches with rating) — emoji line
  const recentRated = playerMatches.filter(pm => pm.rating).slice(-5);

  // Performance bar chart data — last 8 matches (rating)
  const chartMatches = playerMatches.slice(-8);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-player" onClick={e => e.stopPropagation()}>
        <header className="player-header">
          <div className="player-avatar-big">
            {playerName.charAt(0)}
          </div>
          <div className="player-meta">
            <h2 className="player-name">{playerName}</h2>
            <div className="player-team">
              {teamInfo.team && TeamBadge && <TeamBadge team={teamInfo.team} size={20} />}
              <span>{teamInfo.team?.name || "—"}</span>
              <span className="player-team-sep">·</span>
              <span className="player-tournament">{tournament.name}</span>
            </div>
          </div>
          <button className="row-remove" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        <div className="player-body">
          {/* Headline KPIs */}
          <div className="player-kpi-row">
            <div className="player-kpi player-kpi-primary">
              <div className="player-kpi-icon">⚽</div>
              <div className="player-kpi-num">{toArabicNum(total.goals)}</div>
              <div className="player-kpi-label">أهداف</div>
            </div>
            <div className="player-kpi">
              <div className="player-kpi-icon">🎯</div>
              <div className="player-kpi-num">{toArabicNum(total.assists)}</div>
              <div className="player-kpi-label">صناعات</div>
            </div>
            <div className="player-kpi">
              <div className="player-kpi-icon">🏟️</div>
              <div className="player-kpi-num">{toArabicNum(total.matches)}</div>
              <div className="player-kpi-label">مباريات</div>
            </div>
            <div className="player-kpi player-kpi-rating">
              <div className="player-kpi-icon">⭐</div>
              <div className="player-kpi-num">
                {total.ratingCount > 0 ? avgRating.toFixed(1).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]) : "—"}
              </div>
              <div className="player-kpi-label">متوسط التقييم</div>
            </div>
          </div>

          <div className="player-secondary-row">
            <div className="player-stat-pill">
              <span className="card-rect card-yellow"></span>
              <span>{toArabicNum(total.yellow)} بطاقة صفراء</span>
            </div>
            <div className="player-stat-pill">
              <span className="card-rect card-red"></span>
              <span>{toArabicNum(total.red)} بطاقة حمراء</span>
            </div>
            {total.matches > 0 && (
              <div className="player-stat-pill">
                <span>📈</span>
                <span>{(total.goals + total.assists).toString().replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d])} مساهمات تهديفية</span>
              </div>
            )}
          </div>

          {/* Form (last 5 ratings) */}
          {recentRated.length > 0 && (
            <div className="player-section">
              <h3 className="player-section-title">آخر ٥ تقييمات</h3>
              <div className="player-form">
                {recentRated.map((pm, i) => {
                  const r = pm.rating;
                  const cls = r >= 5 ? "form-great" : r >= 4 ? "form-good" : r >= 3 ? "form-ok" : "form-poor";
                  return (
                    <div key={i} className={`form-pill ${cls}`} title={`${pm.match.home.name} × ${pm.match.away.name}`}>
                      <div className="form-pill-stars">
                        {"★".repeat(r)}{"☆".repeat(5 - r)}
                      </div>
                      <div className="form-pill-vs">
                        {pm.side === "home"
                          ? `${pm.match.away.name}`
                          : `${pm.match.home.name}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Performance chart (rating per match) */}
          {chartMatches.some(pm => pm.rating) && (
            <div className="player-section">
              <h3 className="player-section-title">منحنى الأداء (التقييم لكل مباراة)</h3>
              <div className="player-chart">
                {chartMatches.map((pm, i) => {
                  const r = pm.rating || 0;
                  const h = r > 0 ? (r / 5) * 100 : 0;
                  return (
                    <div key={i} className="chart-bar-wrap">
                      <div className="chart-bar" style={{ height: `${h}%` }}>
                        <span className="chart-bar-val">{r > 0 ? toArabicNum(r) : ""}</span>
                      </div>
                      <div className="chart-bar-label">
                        {pm.side === "home"
                          ? pm.match.away.name.slice(0, 6)
                          : pm.match.home.name.slice(0, 6)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Match log */}
          <div className="player-section">
            <h3 className="player-section-title">سجل المباريات</h3>
            {playerMatches.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-icon">⚽</div>
                <div>لم يشارك في أي مباراة بعد</div>
              </div>
            ) : (
              <div className="player-match-log">
                {[...playerMatches].reverse().map((pm, i) => {
                  const m = pm.match;
                  const isHome = pm.side === "home";
                  const opp = isHome ? m.away : m.home;
                  const our = isHome ? m.homeScore : m.awayScore;
                  const their = isHome ? m.awayScore : m.homeScore;
                  const result = our > their ? "win" : our === their ? "draw" : "loss";
                  return (
                    <div key={i} className="player-match-row">
                      <span className={`pml-result pml-${result}`}>
                        {result === "win" ? "ف" : result === "draw" ? "ت" : "خ"}
                      </span>
                      <span className="pml-date">{m.date ? window.formatArabicDate(m.date) : "—"}</span>
                      <span className="pml-vs">
                        {TeamBadge && <TeamBadge team={tournament.participants.find(p => p.id === opp.id) || opp} size={20} />}
                        <span>{isHome ? "أمام" : "ضيافة"} {opp.name}</span>
                      </span>
                      <span className="pml-score">{toArabicNum(our)}-{toArabicNum(their)}</span>
                      <span className="pml-events">
                        {pm.goalsInMatch > 0 && <span title="أهداف">⚽ {toArabicNum(pm.goalsInMatch)}</span>}
                        {pm.assistsInMatch > 0 && <span title="صناعات">🎯 {toArabicNum(pm.assistsInMatch)}</span>}
                        {pm.yellowsInMatch > 0 && <span className="card-rect card-yellow" title="صفراء"></span>}
                        {pm.redsInMatch > 0 && <span className="card-rect card-red" title="حمراء"></span>}
                      </span>
                      <span className="pml-rating">
                        {pm.rating ? <span className="rating-stars-mini">{"★".repeat(pm.rating)}</span> : <span style={{ opacity: 0.3 }}>—</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.PlayerProfileModal = PlayerProfileModal;

function toArabicNum(n) {
  return String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
}
