// =====================================================================
// match-modal.jsx — Rich match details (score, goals, cards, lineups, ratings)
// =====================================================================

function MatchDetailsModal({ match, bestOf = 1, sport, onClose, onSave, getRoster }) {
  // sport.team => team match. getRoster(teamId) -> [{id,name}]
  const isTeam = !!sport?.team;

  const [tab, setTab] = React.useState("score"); // score | events | lineup | rating
  const [hs, setHs] = React.useState(match.homeScore ?? 0);
  const [as, setAs] = React.useState(match.awayScore ?? 0);
  const [events, setEvents] = React.useState(() => match.events ? JSON.parse(JSON.stringify(match.events)) : []);
  const [lineups, setLineups] = React.useState(() => ({
    home: match.lineups?.home ? [...match.lineups.home] : (getRoster?.(match.home?.id) || []).map(p => p.id),
    away: match.lineups?.away ? [...match.lineups.away] : (getRoster?.(match.away?.id) || []).map(p => p.id),
  }));
  const [ratings, setRatings] = React.useState(() => ({ ...(match.ratings || {}) }));
  const [matchDate, setMatchDate] = React.useState(match.date || "");
  const [matchTime, setMatchTime] = React.useState(match.time || "");
  const [venue, setVenue] = React.useState(match.venue || "");

  const winsNeeded = Math.ceil(bestOf / 2);

  // For team matches with goal events: derive score from events
  React.useEffect(() => {
    if (!isTeam) return;
    const homeGoals = events.filter(e => e.type === "goal" && e.team === "home").length;
    const awayGoals = events.filter(e => e.type === "goal" && e.team === "away").length;
    setHs(homeGoals);
    setAs(awayGoals);
  }, [events, isTeam]);

  const valid = (() => {
    if (hs === as && bestOf > 1) return false;
    if (hs === as && !isTeam) return false; // KO/individual cannot tie generally — but league allows
    if (bestOf > 1 && hs !== winsNeeded && as !== winsNeeded) return false;
    return true;
  })();

  // For non-team / non-football: simple stepper interface only
  const stepperOnly = !isTeam || sport?.id !== "football";

  const homeRoster = getRoster?.(match.home?.id) || [];
  const awayRoster = getRoster?.(match.away?.id) || [];

  const tabs = [
    { id: "score", label: "النتيجة", icon: "📊" },
  ];
  if (isTeam && sport?.id === "football") {
    tabs.push({ id: "events", label: "الأهداف والبطاقات", icon: "⚽" });
    tabs.push({ id: "lineup", label: "التشكيلة", icon: "👥" });
    tabs.push({ id: "rating", label: "التقييم", icon: "⭐" });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-match" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>تفاصيل المباراة</h2>
            <div className="match-modal-teams">
              <strong>{match.home?.name}</strong>
              <span className="match-modal-vs">{toArabicNum(hs)} — {toArabicNum(as)}</span>
              <strong>{match.away?.name}</strong>
            </div>
          </div>
          <button className="row-remove" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        {tabs.length > 1 && (
          <div className="match-tabs" role="tablist">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`match-tab ${tab === t.id ? "is-active" : ""}`}
                onClick={() => setTab(t.id)}
                type="button"
              >
                <span className="match-tab-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="match-meta-row">
          <label className="match-meta-field">
            <span className="match-meta-label">📅 التاريخ</span>
            <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} />
          </label>
          <label className="match-meta-field">
            <span className="match-meta-label">🕐 الوقت</span>
            <input type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} />
          </label>
          <label className="match-meta-field match-meta-venue">
            <span className="match-meta-label">📍 الملعب</span>
            <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="مثال: ملعب رقم ٢" />
          </label>
        </div>

        <div className="modal-body match-modal-body">
          {tab === "score" && (
            <ScoreTab
              match={match}
              hs={hs} setHs={setHs} as={as} setAs={setAs}
              bestOf={bestOf}
              winsNeeded={winsNeeded}
              stepperOnly={stepperOnly}
              isTeam={isTeam}
              eventGoals={events.filter(e => e.type === "goal").length}
              onJumpToEvents={() => setTab("events")}
            />
          )}
          {tab === "events" && (
            <EventsTab
              match={match}
              events={events}
              setEvents={setEvents}
              homeRoster={homeRoster}
              awayRoster={awayRoster}
            />
          )}
          {tab === "lineup" && (
            <LineupTab
              match={match}
              homeRoster={homeRoster}
              awayRoster={awayRoster}
              lineups={lineups}
              setLineups={setLineups}
            />
          )}
          {tab === "rating" && (
            <RatingTab
              match={match}
              homeRoster={homeRoster}
              awayRoster={awayRoster}
              lineups={lineups}
              ratings={ratings}
              setRatings={setRatings}
            />
          )}
        </div>

        <footer className="modal-footer">
          <span className="modal-meta">
            {valid ? "جاهز للحفظ" : "أكمل النتيجة"}
          </span>
          <div>
            <button className="btn-ghost" onClick={onClose} type="button">إلغاء</button>
            <button
              className="btn-primary"
              disabled={!valid}
              type="button"
              onClick={() => onSave({
                homeScore: hs,
                awayScore: as,
                events,
                lineups,
                ratings,
                date: matchDate,
                time: matchTime,
                venue,
              })}
            >حفظ التفاصيل</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// --------------------- Score Tab ---------------------
function ScoreTab({ match, hs, setHs, as, setAs, bestOf, winsNeeded, stepperOnly, isTeam, eventGoals, onJumpToEvents }) {
  const max = bestOf > 1 ? winsNeeded : 99;
  const linkedToEvents = isTeam && eventGoals > 0;

  return (
    <div className="score-entry">
      <div className="score-side">
        <div className="score-name">{match.home?.name}</div>
        <div className="score-stepper">
          <button onClick={() => setHs(Math.min(max, hs + 1))} disabled={linkedToEvents}>+</button>
          <div className="score-num">{toArabicNum(hs)}</div>
          <button onClick={() => setHs(Math.max(0, hs - 1))} disabled={linkedToEvents}>−</button>
        </div>
      </div>
      <div className="score-vs">VS</div>
      <div className="score-side">
        <div className="score-name">{match.away?.name}</div>
        <div className="score-stepper">
          <button onClick={() => setAs(Math.min(max, as + 1))} disabled={linkedToEvents}>+</button>
          <div className="score-num">{toArabicNum(as)}</div>
          <button onClick={() => setAs(Math.max(0, as - 1))} disabled={linkedToEvents}>−</button>
        </div>
      </div>
      {linkedToEvents && (
        <div className="score-link-note">
          النتيجة محسوبة من سجل الأهداف.{" "}
          <button className="link-btn" onClick={onJumpToEvents} type="button">عدّل الأهداف</button>
        </div>
      )}
      {bestOf > 1 && hs === as && (
        <div className="modal-warn">يجب أن يصل أحد الفريقين إلى {toArabicNum(winsNeeded)}</div>
      )}
    </div>
  );
}

// --------------------- Events Tab (goals + cards) ---------------------
function EventsTab({ match, events, setEvents, homeRoster, awayRoster }) {
  const addEvent = (e) => setEvents([...events, { id: `ev_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, ...e }]);
  const removeEvent = (id) => setEvents(events.filter(e => e.id !== id));

  const goals = events.filter(e => e.type === "goal").sort((a, b) => (a.minute || 0) - (b.minute || 0));
  const cards = events.filter(e => e.type === "card").sort((a, b) => (a.minute || 0) - (b.minute || 0));

  return (
    <div className="events-tab">
      <div className="events-section">
        <div className="events-section-head">
          <h3>الأهداف ({toArabicNum(goals.length)})</h3>
        </div>
        <div className="events-list">
          {goals.length === 0 && <div className="empty-mini">لا توجد أهداف بعد</div>}
          {goals.map(g => (
            <EventChip key={g.id} ev={g} match={match} onRemove={() => removeEvent(g.id)} />
          ))}
        </div>
        <div className="events-add-grid">
          <AddGoalForm side="home" team={match.home} roster={homeRoster} onAdd={addEvent} />
          <AddGoalForm side="away" team={match.away} roster={awayRoster} onAdd={addEvent} />
        </div>
      </div>

      <div className="events-section">
        <div className="events-section-head">
          <h3>البطاقات ({toArabicNum(cards.length)})</h3>
        </div>
        <div className="events-list">
          {cards.length === 0 && <div className="empty-mini">لا توجد بطاقات</div>}
          {cards.map(c => (
            <EventChip key={c.id} ev={c} match={match} onRemove={() => removeEvent(c.id)} />
          ))}
        </div>
        <div className="events-add-grid">
          <AddCardForm side="home" team={match.home} roster={homeRoster} onAdd={addEvent} />
          <AddCardForm side="away" team={match.away} roster={awayRoster} onAdd={addEvent} />
        </div>
      </div>
    </div>
  );
}

function EventChip({ ev, match, onRemove }) {
  const team = ev.team === "home" ? match.home : match.away;
  if (ev.type === "goal") {
    return (
      <div className="event-chip event-goal">
        <span className="event-icon">⚽</span>
        {ev.subtype === "penalty" && <span className="event-tag">بلنتي</span>}
        {ev.subtype === "own" && <span className="event-tag event-tag-warn">خطأ</span>}
        <span className="event-min">{ev.minute ? `${toArabicNum(ev.minute)}'` : ""}</span>
        <span className="event-team-dot">{team?.name?.charAt(0)}</span>
        <span className="event-player"><strong>{ev.scorer || "—"}</strong></span>
        {ev.assist && <span className="event-assist">صناعة: {ev.assist}</span>}
        <button className="row-remove" onClick={onRemove} aria-label="حذف" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>
    );
  }
  // card
  return (
    <div className={`event-chip event-card event-card-${ev.color}`}>
      <span className={`card-rect card-${ev.color}`}></span>
      <span className="event-min">{ev.minute ? `${toArabicNum(ev.minute)}'` : ""}</span>
      <span className="event-team-dot">{team?.name?.charAt(0)}</span>
      <span className="event-player"><strong>{ev.player || "—"}</strong></span>
      <button className="row-remove" onClick={onRemove} aria-label="حذف" type="button">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

function AddGoalForm({ side, team, roster, onAdd }) {
  const [scorer, setScorer] = React.useState("");
  const [assist, setAssist] = React.useState("");
  const [minute, setMinute] = React.useState("");
  const [subtype, setSubtype] = React.useState("normal");
  const namesPool = roster.length ? roster.map(p => p.name) : [];

  const submit = () => {
    if (!scorer.trim()) return;
    onAdd({
      type: "goal", team: side,
      scorer: scorer.trim(),
      assist: subtype === "penalty" || subtype === "own" ? "" : assist.trim() || null,
      minute: minute ? parseInt(minute, 10) : null,
      subtype,
    });
    setScorer(""); setAssist(""); setMinute(""); setSubtype("normal");
  };

  return (
    <div className="add-event-form">
      <div className="add-event-head">
        <span className="event-team-dot">{team?.name?.charAt(0)}</span>
        <strong>{team?.name}</strong>
      </div>
      <PlayerPicker placeholder="المسجّل" value={scorer} onChange={setScorer} options={namesPool} />
      {subtype === "normal" && (
        <PlayerPicker placeholder="صانع الهدف (اختياري)" value={assist} onChange={setAssist} options={namesPool.filter(n => n !== scorer)} />
      )}
      <div className="add-event-row">
        <input
          type="number" min="1" max="120" placeholder="الدقيقة"
          value={minute} onChange={e => setMinute(e.target.value)}
          className="text-input minute-input"
        />
        <div className="goal-type-pills">
          <button type="button" className={`pill ${subtype === "normal" ? "is-active" : ""}`} onClick={() => setSubtype("normal")}>عادي</button>
          <button type="button" className={`pill ${subtype === "penalty" ? "is-active" : ""}`} onClick={() => setSubtype("penalty")}>بلنتي</button>
          <button type="button" className={`pill ${subtype === "own" ? "is-active" : ""}`} onClick={() => setSubtype("own")}>خطأ</button>
        </div>
        <button type="button" className="btn-secondary btn-add-event" onClick={submit} disabled={!scorer.trim()}>
          + هدف
        </button>
      </div>
    </div>
  );
}

function AddCardForm({ side, team, roster, onAdd }) {
  const [player, setPlayer] = React.useState("");
  const [minute, setMinute] = React.useState("");
  const [color, setColor] = React.useState("yellow");
  const namesPool = roster.length ? roster.map(p => p.name) : [];

  const submit = () => {
    if (!player.trim()) return;
    onAdd({
      type: "card", team: side,
      player: player.trim(),
      minute: minute ? parseInt(minute, 10) : null,
      color,
    });
    setPlayer(""); setMinute(""); setColor("yellow");
  };

  return (
    <div className="add-event-form">
      <div className="add-event-head">
        <span className="event-team-dot">{team?.name?.charAt(0)}</span>
        <strong>{team?.name}</strong>
      </div>
      <PlayerPicker placeholder="اللاعب" value={player} onChange={setPlayer} options={namesPool} />
      <div className="add-event-row">
        <input
          type="number" min="1" max="120" placeholder="الدقيقة"
          value={minute} onChange={e => setMinute(e.target.value)}
          className="text-input minute-input"
        />
        <div className="goal-type-pills">
          <button type="button" className={`pill pill-yellow ${color === "yellow" ? "is-active" : ""}`} onClick={() => setColor("yellow")}>
            <span className="card-rect card-yellow"></span>صفراء
          </button>
          <button type="button" className={`pill pill-red ${color === "red" ? "is-active" : ""}`} onClick={() => setColor("red")}>
            <span className="card-rect card-red"></span>حمراء
          </button>
        </div>
        <button type="button" className="btn-secondary btn-add-event" onClick={submit} disabled={!player.trim()}>
          + بطاقة
        </button>
      </div>
    </div>
  );
}

function PlayerPicker({ placeholder, value, onChange, options }) {
  const [focused, setFocused] = React.useState(false);
  const filtered = (options || []).filter(o => o.includes(value)).slice(0, 6);
  const showSuggest = focused && filtered.length > 0 && (value !== filtered[0] || filtered.length > 1);
  return (
    <div className="player-picker">
      <input
        type="text"
        className="text-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {showSuggest && (
        <div className="player-picker-suggest">
          {filtered.map(o => (
            <button
              key={o}
              type="button"
              className="player-picker-item"
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setFocused(false); }}
            >{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------- Lineup Tab ---------------------
function LineupTab({ match, homeRoster, awayRoster, lineups, setLineups }) {
  const toggle = (side, id) => {
    const current = lineups[side];
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    setLineups({ ...lineups, [side]: next });
  };

  const renderSide = (side, team, roster) => (
    <div className="lineup-side">
      <div className="lineup-side-head">
        <span className="event-team-dot">{team?.name?.charAt(0)}</span>
        <strong>{team?.name}</strong>
        <span className="lineup-count">{toArabicNum(lineups[side].length)}/{toArabicNum(roster.length)}</span>
      </div>
      {roster.length === 0 ? (
        <div className="empty-mini">لم تُضَف تشكيلة لهذا الفريق</div>
      ) : (
        <div className="lineup-list">
          {roster.map(pl => {
            const inLineup = lineups[side].includes(pl.id);
            return (
              <button
                key={pl.id}
                type="button"
                className={`lineup-row ${inLineup ? "is-on" : ""}`}
                onClick={() => toggle(side, pl.id)}
              >
                <span className="lineup-row-check">
                  {inLineup ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : ""}
                </span>
                <span className="lineup-row-name">{pl.name}</span>
                <span className={`lineup-row-status ${inLineup ? "is-on" : ""}`}>
                  {inLineup ? "أساسي" : "خارج"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="lineup-tab">
      <p className="tab-hint">حدد اللاعبين الذين شاركوا في هذه المباراة من تشكيلة كل فريق.</p>
      <div className="lineup-grid">
        {renderSide("home", match.home, homeRoster)}
        {renderSide("away", match.away, awayRoster)}
      </div>
    </div>
  );
}

// --------------------- Rating Tab ---------------------
function RatingTab({ match, homeRoster, awayRoster, lineups, ratings, setRatings }) {
  const homePlayers = homeRoster.filter(p => lineups.home.includes(p.id));
  const awayPlayers = awayRoster.filter(p => lineups.away.includes(p.id));

  const setRating = (id, val) => setRatings({ ...ratings, [id]: val });

  const renderSide = (team, players) => (
    <div className="rating-side">
      <div className="lineup-side-head">
        <span className="event-team-dot">{team?.name?.charAt(0)}</span>
        <strong>{team?.name}</strong>
      </div>
      {players.length === 0 ? (
        <div className="empty-mini">حدّد التشكيلة أولاً من تبويب "التشكيلة"</div>
      ) : (
        <div className="rating-list">
          {players.map(pl => {
            const r = ratings[pl.id] || 0;
            return (
              <div key={pl.id} className="rating-row">
                <span className="rating-name">{pl.name}</span>
                <div className="rating-stars">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`rating-star ${n <= r ? "is-on" : ""}`}
                      onClick={() => setRating(pl.id, n === r ? 0 : n)}
                      aria-label={`${n} نجوم`}
                    >★</button>
                  ))}
                </div>
                <span className="rating-num">{r ? toArabicNum(r) : "—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="rating-tab">
      <p className="tab-hint">قيّم أداء كل لاعب بعد نهاية المباراة (١–٥).</p>
      <div className="rating-grid">
        {renderSide(match.home, homePlayers)}
        {renderSide(match.away, awayPlayers)}
      </div>
    </div>
  );
}

window.MatchDetailsModal = MatchDetailsModal;
