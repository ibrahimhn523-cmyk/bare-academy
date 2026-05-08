// =====================================================================
// screen-preview.jsx — Screen 5: Preview & Launch
// =====================================================================

function ScreenPreview({ draft, setDraft, onBack, onLaunch }) {
  const { generateLeagueFixtures, generateBracket } = window.TournamentData;

  // generate fixtures/bracket on entry if not yet generated
  React.useEffect(() => {
    if (draft.fixtures || draft.bracket) return;
    const next = { ...draft };
    if (draft.type === "league") {
      next.fixtures = generateLeagueFixtures(draft.participants, !!draft.config?.doubleRound);
    } else if (draft.type === "knockout") {
      next.bracket = generateBracket(draft.participants, !!draft.config?.thirdPlace);
    } else if (draft.type === "league_knockout") {
      next.fixtures = generateLeagueFixtures(draft.participants, !!draft.config?.doubleRound);
    } else if (draft.type === "groups_knockout") {
      // build groups
      const perGroup = draft.config?.perGroup || 4;
      const groupCount = draft.config?.groupCount || 4;
      const groups = [];
      for (let g = 0; g < groupCount; g++) {
        const slice = draft.participants.slice(g * perGroup, (g + 1) * perGroup);
        if (slice.length >= 2) {
          groups.push({
            id: `group_${g}`,
            label: `المجموعة ${["أ","ب","ج","د","هـ","و","ز","ح","ط","ي"][g] || (g+1)}`,
            participants: slice,
            fixtures: generateLeagueFixtures(slice, false),
          });
        }
      }
      next.groups = groups;
    }
    setDraft(next);
  // eslint-disable-next-line
  }, []);

  const totalMatches = countMatches(draft);

  return (
    <div className="screen screen-preview">
      <header className="screen-header">
        <div>
          <div className="eyebrow">الخطوة ٥ من ٥ — معاينة</div>
          <h1>{draft.name || "بطولة جديدة"}</h1>
          <p className="lede">
            راجع البطولة قبل الإطلاق. تقدر تجرّب إدخال نتائج تجريبية.
          </p>
        </div>
        <div className="preview-summary">
          <SummaryStat label="الرياضة" value={`${draft.sport?.emoji || "—"} ${draft.sport?.name || "—"}`} />
          <SummaryStat label="النوع" value={tournamentTypeLabel(draft.type)} />
          <SummaryStat label="المشاركون" value={toArabicNum(draft.participants?.length || 0)} />
          <SummaryStat label="المباريات" value={toArabicNum(totalMatches)} />
        </div>
      </header>

      <div className="preview-body">
        {draft.type === "league" && (
          <LeagueView tournament={draft} onUpdate={setDraft} />
        )}
        {draft.type === "knockout" && (
          <BracketView
            bracket={draft.bracket}
            onUpdate={(b) => setDraft({ ...draft, bracket: b })}
            bestOf={draft.config?.bestOf || 1}
            sport={draft.sport}
            getRoster={(teamId) => draft.participants.find(p => p.id === teamId)?.roster || []}
          />
        )}
        {draft.type === "league_knockout" && (
          <div className="phased">
            <PhaseTitle phase="١" title="مرحلة الدوري" />
            <LeagueView tournament={draft} onUpdate={setDraft} />
            <PhaseTitle phase="٢" title="مرحلة خروج المغلوب (تُولّد بعد انتهاء الدوري)" muted />
            <div className="placeholder-bracket">
              <div className="placeholder-icon">⚡</div>
              <div className="placeholder-title">سيتم إنشاء الـ bracket تلقائياً</div>
              <div className="placeholder-desc">
                أعلى {toArabicNum(draft.config?.qualifiers || 4)} فرق في الدوري يتأهلون للمرحلة الإقصائية
              </div>
            </div>
          </div>
        )}
        {draft.type === "groups_knockout" && (
          <GroupsView draft={draft} setDraft={setDraft} />
        )}
      </div>

      <footer className="screen-footer">
        <button className="btn-ghost" onClick={onBack}>السابق</button>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-secondary" onClick={() => alert("تم حفظ البطولة كمسودة")}>حفظ كمسودة</button>
          <button className="btn-primary btn-launch" onClick={onLaunch}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ marginLeft: 8 }}>
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            إطلاق البطولة
          </button>
        </div>
      </footer>
    </div>
  );
}

function GroupsView({ draft, setDraft }) {
  const { computeStandings } = window.TournamentData;
  const groups = draft.groups || [];
  const [editingMatch, setEditingMatch] = React.useState(null);

  const updateMatch = (matchId, payload) => {
    const next = JSON.parse(JSON.stringify(draft));
    next.groups.forEach(g => g.fixtures.forEach(round => round.forEach(m => {
      if (m.id === matchId) {
        m.homeScore = payload.homeScore;
        m.awayScore = payload.awayScore;
        m.events = payload.events;
        m.lineups = payload.lineups;
        m.ratings = payload.ratings;
        m.played = true;
      }
    })));
    setDraft(next);
    setEditingMatch(null);
  };

  return (
    <>
      <PhaseTitle phase="١" title="مرحلة المجموعات" />
      <div className="groups-grid">
        {groups.map(g => {
          const standings = computeStandings(
            g.participants, g.fixtures,
            draft.config?.points || { win: 3, draw: 1, loss: 0 },
            draft.config?.tiebreak || "gd"
          );
          const qualPerGroup = draft.config?.qualifiersPerGroup || 2;
          return (
            <div key={g.id} className="group-card">
              <div className="group-header">{g.label}</div>
              <table className="mini-standings">
                <thead><tr><th>#</th><th>الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>±</th><th>ن</th></tr></thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.id} className={i < qualPerGroup ? "is-qualifier" : ""}>
                      <td>{toArabicNum(i+1)}</td>
                      <td>{s.name}</td>
                      <td>{toArabicNum(s.played)}</td>
                      <td>{toArabicNum(s.won)}</td>
                      <td>{toArabicNum(s.drawn)}</td>
                      <td>{toArabicNum(s.lost)}</td>
                      <td>{s.gd > 0 ? "+" : ""}{toArabicNum(s.gd)}</td>
                      <td><strong>{toArabicNum(s.points)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="group-fixtures">
                {g.fixtures.flat().slice(0, 3).map(m => (
                  <div key={m.id} className={`mini-fixture ${m.played ? "is-played" : ""}`} onClick={() => setEditingMatch(m)}>
                    <span>{m.home.name}</span>
                    <span className="mini-score">{m.played ? `${toArabicNum(m.homeScore)} - ${toArabicNum(m.awayScore)}` : "VS"}</span>
                    <span>{m.away.name}</span>
                  </div>
                ))}
                {g.fixtures.flat().length > 3 && (
                  <div className="mini-more">و {toArabicNum(g.fixtures.flat().length - 3)} مباراة أخرى</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <PhaseTitle phase="٢" title="مرحلة خروج المغلوب" muted />
      <div className="placeholder-bracket">
        <div className="placeholder-icon">⚡</div>
        <div className="placeholder-title">سيتم إنشاء الـ bracket تلقائياً</div>
        <div className="placeholder-desc">
          أفضل {toArabicNum(draft.config?.qualifiersPerGroup || 2)} من كل مجموعة يتأهلون
        </div>
      </div>
      {editingMatch && (
        <MatchDetailsModal
          match={editingMatch}
          bestOf={1}
          sport={draft.sport}
          getRoster={(teamId) => draft.participants.find(p => p.id === teamId)?.roster || []}
          onClose={() => setEditingMatch(null)}
          onSave={(payload) => updateMatch(editingMatch.id, payload)}
        />
      )}
    </>
  );
}

function PhaseTitle({ phase, title, muted }) {
  return (
    <div className={`phase-title ${muted ? "is-muted" : ""}`}>
      <span className="phase-num">{phase}</span>
      <span className="phase-name">{title}</span>
    </div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="summary-stat">
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
    </div>
  );
}

function countMatches(draft) {
  if (draft.fixtures) return draft.fixtures.flat().length;
  if (draft.bracket) {
    let total = draft.bracket.rounds.flat().length;
    if (draft.bracket.thirdPlace) total += 1;
    return total;
  }
  if (draft.groups) return draft.groups.reduce((sum, g) => sum + g.fixtures.flat().length, 0);
  return 0;
}

window.ScreenPreview = ScreenPreview;
