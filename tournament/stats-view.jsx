// =====================================================================
// stats-view.jsx — Player statistics aggregated from match events
// =====================================================================

function computePlayerStats(tournament) {
  const stats = {}; // key: player name -> stats
  const get = (name, teamName) => {
    if (!stats[name]) {
      stats[name] = {
        name, team: teamName,
        matches: 0, goals: 0, assists: 0,
        penalties: 0, ownGoals: 0,
        yellow: 0, red: 0,
        ratingSum: 0, ratingCount: 0,
      };
    }
    return stats[name];
  };

  // Pre-seed roster players (so they show even with 0 stats)
  (tournament.participants || []).forEach(team => {
    (team.roster || []).forEach(pl => {
      const s = get(pl.name, team.name);
      s.team = team.name;
    });
  });

  const allMatches = [];
  (tournament.fixtures || []).forEach(round => round.forEach(m => allMatches.push(m)));
  if (tournament.bracket) {
    tournament.bracket.rounds.forEach(round => round.forEach(m => allMatches.push(m)));
    if (tournament.bracket.thirdPlace) allMatches.push(tournament.bracket.thirdPlace);
  }

  allMatches.forEach(m => {
    if (!m.played) return;
    // matches played: for each player in lineup
    if (m.lineups) {
      const homeTeam = m.home, awayTeam = m.away;
      const homeRoster = (tournament.participants || []).find(p => p.id === homeTeam?.id)?.roster || [];
      const awayRoster = (tournament.participants || []).find(p => p.id === awayTeam?.id)?.roster || [];
      (m.lineups.home || []).forEach(pid => {
        const pl = homeRoster.find(p => p.id === pid);
        if (pl) get(pl.name, homeTeam?.name).matches++;
      });
      (m.lineups.away || []).forEach(pid => {
        const pl = awayRoster.find(p => p.id === pid);
        if (pl) get(pl.name, awayTeam?.name).matches++;
      });
      // ratings
      if (m.ratings) {
        Object.entries(m.ratings).forEach(([pid, v]) => {
          if (!v) return;
          const pl = homeRoster.find(p => p.id === pid) || awayRoster.find(p => p.id === pid);
          const tname = homeRoster.find(p => p.id === pid) ? homeTeam?.name : awayTeam?.name;
          if (pl) {
            const s = get(pl.name, tname);
            s.ratingSum += v; s.ratingCount++;
          }
        });
      }
    }
    // events
    (m.events || []).forEach(ev => {
      const team = ev.team === "home" ? m.home : m.away;
      if (ev.type === "goal" && ev.scorer) {
        const s = get(ev.scorer, team?.name);
        if (ev.subtype === "own") {
          // own goal: count against scorer's team but mark
          s.ownGoals++;
        } else {
          s.goals++;
          if (ev.subtype === "penalty") s.penalties++;
        }
        if (ev.assist) {
          const a = get(ev.assist, team?.name);
          a.assists++;
        }
      } else if (ev.type === "card" && ev.player) {
        const s = get(ev.player, team?.name);
        if (ev.color === "yellow") s.yellow++;
        else if (ev.color === "red") s.red++;
      }
    });
  });

  return Object.values(stats).map(s => ({
    ...s,
    avgRating: s.ratingCount ? (s.ratingSum / s.ratingCount) : 0,
  }));
}

function StatsView({ tournament }) {
  const [sortBy, setSortBy] = React.useState("goals");
  const [openPlayer, setOpenPlayer] = React.useState(null);
  const stats = React.useMemo(() => computePlayerStats(tournament), [tournament]);

  const sorted = [...stats].sort((a, b) => {
    if (sortBy === "rating") return b.avgRating - a.avgRating;
    return (b[sortBy] || 0) - (a[sortBy] || 0);
  });

  const cols = [
    { id: "goals", label: "الأهداف", icon: "⚽" },
    { id: "assists", label: "صناعة", icon: "🎯" },
    { id: "matches", label: "مباريات", icon: "🏟️" },
    { id: "yellow", label: "صفراء", icon: "🟨" },
    { id: "red", label: "حمراء", icon: "🟥" },
    { id: "rating", label: "التقييم", icon: "⭐" },
  ];

  const topScorer = [...stats].sort((a, b) => b.goals - a.goals)[0];
  const topAssist = [...stats].sort((a, b) => b.assists - a.assists)[0];
  const topRated = [...stats].filter(s => s.ratingCount > 0).sort((a, b) => b.avgRating - a.avgRating)[0];

  return (
    <div className="stats-view">
      <div className="stats-leaders">
        <LeaderCard
          title="الهدّاف"
          icon="⚽"
          value={topScorer && topScorer.goals > 0 ? toArabicNum(topScorer.goals) : "—"}
          name={topScorer && topScorer.goals > 0 ? topScorer.name : "—"}
          team={topScorer?.team}
          accent="gold"
        />
        <LeaderCard
          title="صانع الأهداف"
          icon="🎯"
          value={topAssist && topAssist.assists > 0 ? toArabicNum(topAssist.assists) : "—"}
          name={topAssist && topAssist.assists > 0 ? topAssist.name : "—"}
          team={topAssist?.team}
          accent="navy"
        />
        <LeaderCard
          title="أعلى تقييم"
          icon="⭐"
          value={topRated ? topRated.avgRating.toFixed(1).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]) : "—"}
          name={topRated ? topRated.name : "—"}
          team={topRated?.team}
          accent="success"
        />
      </div>

      <div className="stats-table-wrap">
        <div className="panel-title">
          <h3>إحصائيات اللاعبين</h3>
          <div className="sort-pills">
            {cols.map(c => (
              <button
                key={c.id}
                type="button"
                className={`sort-pill ${sortBy === c.id ? "is-active" : ""}`}
                onClick={() => setSortBy(c.id)}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div><strong>لا توجد إحصائيات بعد</strong></div>
            <p style={{ color: "var(--c-text-3)", fontSize: 13 }}>
              ستظهر الإحصائيات بعد إدخال تفاصيل المباريات (أهداف، تشكيلات، تقييمات)
            </p>
          </div>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th className="col-name">اللاعب</th>
                <th>الفريق</th>
                {cols.map(c => (
                  <th key={c.id} className={sortBy === c.id ? "is-sorted" : ""}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.name + i}>
                  <td className="col-rank">
                    <span className={`rank-pill ${i < 3 ? `rank-${i+1}` : ""}`}>{toArabicNum(i + 1)}</span>
                  </td>
                  <td className="col-name">
                    <button
                      type="button"
                      className="player-name-btn"
                      onClick={() => setOpenPlayer(s.name)}
                      title="عرض ملف اللاعب"
                    >
                      <span className="team-avatar">{s.name.charAt(0)}</span>
                      <span>{s.name}</span>
                    </button>
                  </td>
                  <td>
                    {s.team ? (
                      <div className="team-cell" style={{ fontSize: 13 }}>
                        {window.TeamBadge && <window.TeamBadge team={tournament.participants?.find(p => p.name === s.team) || { name: s.team }} size={20} />}
                        <span>{s.team}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className={sortBy === "goals" ? "is-sorted-cell" : ""}>{toArabicNum(s.goals)}</td>
                  <td className={sortBy === "assists" ? "is-sorted-cell" : ""}>{toArabicNum(s.assists)}</td>
                  <td className={sortBy === "matches" ? "is-sorted-cell" : ""}>{toArabicNum(s.matches)}</td>
                  <td className={sortBy === "yellow" ? "is-sorted-cell" : ""}>
                    {s.yellow > 0 ? <span className="stat-card-pill stat-yellow">{toArabicNum(s.yellow)}</span> : toArabicNum(0)}
                  </td>
                  <td className={sortBy === "red" ? "is-sorted-cell" : ""}>
                    {s.red > 0 ? <span className="stat-card-pill stat-red">{toArabicNum(s.red)}</span> : toArabicNum(0)}
                  </td>
                  <td className={sortBy === "rating" ? "is-sorted-cell" : ""}>
                    {s.ratingCount > 0
                      ? <strong>{s.avgRating.toFixed(1).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d])}</strong>
                      : <span style={{ color: "var(--c-text-3)" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {openPlayer && window.PlayerProfileModal && (
        <window.PlayerProfileModal
          playerName={openPlayer}
          tournament={tournament}
          onClose={() => setOpenPlayer(null)}
        />
      )}
    </div>
  );
}

function LeaderCard({ title, icon, value, name, team, accent }) {
  return (
    <div className={`leader-card leader-${accent}`}>
      <div className="leader-icon">{icon}</div>
      <div className="leader-body">
        <div className="leader-title">{title}</div>
        <div className="leader-name">{name}</div>
        {team && <div className="leader-team">{team}</div>}
      </div>
      <div className="leader-value">{value}</div>
    </div>
  );
}

window.StatsView = StatsView;
window.computePlayerStats = computePlayerStats;
