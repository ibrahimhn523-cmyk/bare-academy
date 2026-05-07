// =====================================================================
// bracket-view.jsx — Interactive bracket renderer
// =====================================================================

function BracketView({ bracket, onUpdate, bestOf = 1, style = "horizontal", sport, getRoster, readOnly = false }) {
  const [editingMatch, setEditingMatch] = React.useState(null);

  if (!bracket) return null;
  const winsNeeded = Math.ceil(bestOf / 2);

  const updateMatch = (matchId, payload) => {
    const next = JSON.parse(JSON.stringify(bracket));
    let changed = null;
    next.rounds.forEach(round => round.forEach(m => {
      if (m.id === matchId) {
        m.homeScore = payload.homeScore;
        m.awayScore = payload.awayScore;
        m.events = payload.events;
        m.lineups = payload.lineups;
        m.ratings = payload.ratings;
        m.played = true;
        m.winner = payload.homeScore > payload.awayScore ? m.home : m.away;
        changed = m;
      }
    }));
    if (changed) {
      for (let r = 0; r < next.rounds.length - 1; r++) {
        const round = next.rounds[r];
        const idx = round.findIndex(m => m.id === changed.id);
        if (idx >= 0) {
          const nextSlot = next.rounds[r + 1][Math.floor(idx / 2)];
          if (idx % 2 === 0) nextSlot.home = changed.winner;
          else nextSlot.away = changed.winner;
          break;
        }
      }
    }
    if (next.thirdPlace?.id === matchId) {
      next.thirdPlace.homeScore = payload.homeScore;
      next.thirdPlace.awayScore = payload.awayScore;
      next.thirdPlace.events = payload.events;
      next.thirdPlace.lineups = payload.lineups;
      next.thirdPlace.ratings = payload.ratings;
      next.thirdPlace.played = true;
      next.thirdPlace.winner = payload.homeScore > payload.awayScore ? next.thirdPlace.home : next.thirdPlace.away;
    }
    onUpdate(next);
    setEditingMatch(null);
  };

  const roundLabel = (idx, total) => {
    const remaining = total - idx;
    if (remaining === 1) return "النهائي";
    if (remaining === 2) return "نصف النهائي";
    if (remaining === 3) return "ربع النهائي";
    if (remaining === 4) return "دور الـ١٦";
    if (remaining === 5) return "دور الـ٣٢";
    return `الجولة ${toArabicNum(idx + 1)}`;
  };

  return (
    <div className={`bracket bracket-${style}`}>
      <div className="bracket-scroller">
        {bracket.rounds.map((round, ri) => (
          <div key={ri} className="bracket-round">
            <div className="bracket-round-label">{roundLabel(ri, bracket.rounds.length)}</div>
            <div className="bracket-matches">
              {round.map((m, mi) => (
                <BracketMatch
                  key={m.id}
                  match={m}
                  bestOf={bestOf}
                  winsNeeded={winsNeeded}
                  onClick={() => !readOnly && m.home && m.away && !m.home.bye && !m.away.bye && setEditingMatch(m)}
                  isFinal={ri === bracket.rounds.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
        {bracket.thirdPlace && (
          <div className="bracket-round bracket-third">
            <div className="bracket-round-label">المركز الثالث</div>
            <div className="bracket-matches">
              <BracketMatch
                match={bracket.thirdPlace}
                bestOf={bestOf}
                winsNeeded={winsNeeded}
                onClick={() => !readOnly && bracket.thirdPlace.home && bracket.thirdPlace.away && setEditingMatch(bracket.thirdPlace)}
                isThirdPlace
              />
            </div>
          </div>
        )}
      </div>

      {editingMatch && (
        <MatchDetailsModal
          match={editingMatch}
          bestOf={bestOf}
          sport={sport}
          getRoster={getRoster}
          onClose={() => setEditingMatch(null)}
          onSave={(payload) => updateMatch(editingMatch.id, payload)}
        />
      )}
    </div>
  );
}

function BracketMatch({ match, bestOf, winsNeeded, onClick, isFinal, isThirdPlace }) {
  const playable = match.home && match.away && !match.home.bye && !match.away.bye;
  const homeWon = match.played && match.winner?.id === match.home?.id;
  const awayWon = match.played && match.winner?.id === match.away?.id;

  return (
    <div
      className={`match-card ${playable ? "is-playable" : ""} ${match.played ? "is-played" : ""} ${isFinal ? "is-final" : ""} ${isThirdPlace ? "is-third" : ""}`}
      onClick={playable ? onClick : undefined}
      role={playable ? "button" : undefined}
    >
      <div className={`match-side ${homeWon ? "is-winner" : ""} ${match.played && !homeWon ? "is-loser" : ""}`}>
        <span className="match-name">{match.home?.name || "—"}</span>
        {match.played && <span className="match-score">{toArabicNum(match.homeScore)}</span>}
        {homeWon && (
          <span className="match-trophy">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M12 2l2.4 5 5.6.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.6-.8z"/>
            </svg>
          </span>
        )}
      </div>
      <div className={`match-side ${awayWon ? "is-winner" : ""} ${match.played && !awayWon ? "is-loser" : ""}`}>
        <span className="match-name">{match.away?.name || "—"}</span>
        {match.played && <span className="match-score">{toArabicNum(match.awayScore)}</span>}
        {awayWon && (
          <span className="match-trophy">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M12 2l2.4 5 5.6.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.6-.8z"/>
            </svg>
          </span>
        )}
      </div>
      {playable && !match.played && (
        <div className="match-cta">إدخال نتيجة</div>
      )}
      {bestOf > 1 && <div className="match-bestof">أفضل من {toArabicNum(bestOf)}</div>}
    </div>
  );
}

function ScoreEntryModal({ match, bestOf, onClose, onSave }) {
  const [hs, setHs] = React.useState(match.homeScore ?? 0);
  const [as, setAs] = React.useState(match.awayScore ?? 0);
  const winsNeeded = Math.ceil(bestOf / 2);
  const max = bestOf > 1 ? winsNeeded : 99;

  const valid = hs !== as && (bestOf === 1 || hs === winsNeeded || as === winsNeeded);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-score" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>إدخال نتيجة المباراة</h2>
          <button className="row-remove" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>
        <div className="score-entry">
          <div className="score-side">
            <div className="score-name">{match.home.name}</div>
            <div className="score-stepper">
              <button onClick={() => setHs(Math.min(max, hs + 1))}>+</button>
              <div className="score-num">{toArabicNum(hs)}</div>
              <button onClick={() => setHs(Math.max(0, hs - 1))}>−</button>
            </div>
          </div>
          <div className="score-vs">VS</div>
          <div className="score-side">
            <div className="score-name">{match.away.name}</div>
            <div className="score-stepper">
              <button onClick={() => setAs(Math.min(max, as + 1))}>+</button>
              <div className="score-num">{toArabicNum(as)}</div>
              <button onClick={() => setAs(Math.max(0, as - 1))}>−</button>
            </div>
          </div>
        </div>
        {!valid && hs === as && <div className="modal-warn">لا يمكن أن تنتهي بتعادل في خروج المغلوب</div>}
        <footer className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={!valid} onClick={() => onSave(hs, as)}>تأكيد النتيجة</button>
        </footer>
      </div>
    </div>
  );
}

window.BracketView = BracketView;
