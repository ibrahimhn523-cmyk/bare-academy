// =====================================================================
// league-view.jsx — League standings + fixtures
// =====================================================================

function LeagueView({ tournament, onUpdate, readOnly = false, mode = "both" }) {
  const [editingMatch, setEditingMatch] = React.useState(null);
  const { computeStandings } = window.TournamentData;

  const fixtures = tournament.fixtures || [];
  const standings = computeStandings(
    tournament.participants,
    fixtures,
    tournament.config?.points || { win: 3, draw: 1, loss: 0 },
    tournament.config?.tiebreak || "gd"
  );

  const updateMatch = (matchId, payload) => {
    const next = JSON.parse(JSON.stringify(tournament));
    next.fixtures.forEach(round => round.forEach(m => {
      if (m.id === matchId) {
        m.homeScore = payload.homeScore;
        m.awayScore = payload.awayScore;
        m.events = payload.events || [];
        m.lineups = payload.lineups;
        m.ratings = payload.ratings;
        m.date = payload.date || "";
        m.time = payload.time || "";
        m.venue = payload.venue || "";
        // Played if any score > 0 OR any goal/card events
        const hasScore = (payload.homeScore || 0) + (payload.awayScore || 0) > 0;
        const hasEvents = (payload.events || []).length > 0;
        m.played = hasScore || hasEvents;
      }
    }));
    onUpdate(next);
    setEditingMatch(null);
  };

  const getRoster = (teamId) => {
    return tournament.participants.find(p => p.id === teamId)?.roster || [];
  };
  const getTeam = (teamId) => tournament.participants.find(p => p.id === teamId) || { name: "" };
  const TeamBadge = window.TeamBadge;

  return (
    <div className="league-view">
      <div className={`league-grid mode-${mode}`}>
        {(mode === "standings" || mode === "both") && (
        <div className="league-table-wrap">
          <div className="panel-title">
            <h3>جدول الترتيب</h3>
            <span className="panel-meta">{toArabicNum(tournament.participants.length)} مشارك</span>
          </div>
          <table className="standings-table">
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th className="col-name">الفريق</th>
                <th>ل</th>
                <th>ف</th>
                <th>ت</th>
                <th>خ</th>
                <th>له</th>
                <th>عليه</th>
                <th>±</th>
                <th className="col-points">نقاط</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.id} className={i < 3 ? "is-top" : ""}>
                  <td className="col-rank">
                    <span className={`rank-pill rank-${i + 1}`}>{toArabicNum(i + 1)}</span>
                  </td>
                  <td className="col-name">
                    <div className="team-cell">
                      <TeamBadge team={getTeam(s.id)} size={24} />
                      <span>{s.name}</span>
                    </div>
                  </td>
                  <td>{toArabicNum(s.played)}</td>
                  <td>{toArabicNum(s.won)}</td>
                  <td>{toArabicNum(s.drawn)}</td>
                  <td>{toArabicNum(s.lost)}</td>
                  <td>{toArabicNum(s.goalsFor)}</td>
                  <td>{toArabicNum(s.goalsAgainst)}</td>
                  <td className={s.gd > 0 ? "is-pos" : s.gd < 0 ? "is-neg" : ""}>
                    {s.gd > 0 ? "+" : ""}{toArabicNum(s.gd)}
                  </td>
                  <td className="col-points"><strong>{toArabicNum(s.points)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {(mode === "matches" || mode === "both") && (
        <div className="fixtures-wrap">
          <div className="panel-title">
            <h3>المباريات</h3>
            <span className="panel-meta">
              {toArabicNum(fixtures.flat().filter(m => m.played).length)} / {toArabicNum(fixtures.flat().length)} لُعبت
            </span>
          </div>
          <div className="fixtures-list">
            {fixtures.map((round, ri) => (
              <div key={ri} className="round-block">
                <div className="round-title">الجولة {toArabicNum(ri + 1)}</div>
                {round.map(m => (
                  <div
                    key={m.id}
                    className={`fixture-row ${m.played ? "is-played" : ""} ${readOnly ? "is-readonly" : ""}`}
                    onClick={() => !readOnly && setEditingMatch(m)}
                  >
                    <div className="fixture-team fixture-home">
                      <TeamBadge team={getTeam(m.home.id)} size={22} />
                      <span>{m.home.name}</span>
                    </div>
                    <div className="fixture-score">
                      {m.played ? (
                        <span>{toArabicNum(m.homeScore)} — {toArabicNum(m.awayScore)}</span>
                      ) : (
                        <span className="fixture-vs">VS</span>
                      )}
                    </div>
                    <div className="fixture-team fixture-away">
                      <span>{m.away.name}</span>
                      <TeamBadge team={getTeam(m.away.id)} size={22} />
                    </div>
                    {(m.date || m.time || m.venue) && (
                      <div className="fixture-meta">
                        {m.date && <span className="fixture-meta-chip">📅 {formatArabicDate(m.date)}</span>}
                        {m.time && <span className="fixture-meta-chip">🕐 {toArabicNum(m.time)}</span>}
                        {m.venue && <span className="fixture-meta-chip">📍 {m.venue}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {editingMatch && (
        <MatchDetailsModal
          match={editingMatch}
          bestOf={1}
          sport={tournament.sport}
          getRoster={getRoster}
          onClose={() => setEditingMatch(null)}
          onSave={(payload) => updateMatch(editingMatch.id, payload)}
        />
      )}
    </div>
  );
}

window.LeagueView = LeagueView;

function toArabicNum(n) {
  return String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
}
function formatArabicDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ar", { day: "numeric", month: "short" });
  } catch { return iso; }
}
window.formatArabicDate = formatArabicDate;
