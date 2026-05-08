// =====================================================================
// EDIT TOURNAMENT MODAL — name, icon, participants, lineups, status
// =====================================================================

function EditTournamentModal({ tournament, onSave, onClose, onArchive }) {
  const { SPORTS, uid } = window.TournamentData;
  const [draft, setDraft] = React.useState(() => JSON.parse(JSON.stringify(tournament)));
  const [section, setSection] = React.useState("general");
  const [movePlayer, setMovePlayer] = React.useState(null); // {teamId, playerId}

  if (!tournament) return null;

  const isTeam = !!draft.sport?.team;
  const set = (k, v) => setDraft({ ...draft, [k]: v });

  // Participants
  const updateParticipant = (id, patch) => {
    setDraft({
      ...draft,
      participants: draft.participants.map(p => p.id === id ? { ...p, ...patch } : p),
    });
  };
  const removeParticipant = (id) => {
    setDraft({ ...draft, participants: draft.participants.filter(p => p.id !== id) });
  };

  // Roster operations
  const updateRosterPlayer = (teamId, playerId, name) => {
    setDraft({
      ...draft,
      participants: draft.participants.map(p => {
        if (p.id !== teamId) return p;
        return {
          ...p,
          roster: (p.roster || []).map(pl => pl.id === playerId ? { ...pl, name } : pl),
        };
      }),
    });
  };

  const removeRosterPlayer = (teamId, playerId) => {
    setDraft({
      ...draft,
      participants: draft.participants.map(p => {
        if (p.id !== teamId) return p;
        return { ...p, roster: (p.roster || []).filter(pl => pl.id !== playerId) };
      }),
    });
  };

  const addRosterPlayer = (teamId, name) => {
    if (!name.trim()) return;
    setDraft({
      ...draft,
      participants: draft.participants.map(p => {
        if (p.id !== teamId) return p;
        return { ...p, roster: [...(p.roster || []), { id: uid(), name: name.trim() }] };
      }),
    });
  };

  const movePlayerTo = (fromTeamId, playerId, toTeamId) => {
    if (fromTeamId === toTeamId) return;
    let player = null;
    const next = draft.participants.map(p => {
      if (p.id === fromTeamId) {
        const roster = (p.roster || []).filter(pl => {
          if (pl.id === playerId) { player = pl; return false; }
          return true;
        });
        return { ...p, roster };
      }
      return p;
    }).map(p => {
      if (p.id === toTeamId && player) {
        return { ...p, roster: [...(p.roster || []), player] };
      }
      return p;
    });
    setDraft({ ...draft, participants: next });
    setMovePlayer(null);
  };

  const sections = [
    { id: "general", label: "عام", icon: "⚙" },
    ...(isTeam ? [{ id: "lineups", label: "التشكيلات", icon: "👥" }] : [{ id: "participants", label: "المشاركون", icon: "🧑" }]),
    { id: "status", label: "الحالة", icon: "🚦" },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-edit-tournament" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>تعديل البطولة</h2>
            <p className="lede" style={{ fontSize: 13, marginTop: 4 }}>
              عدّل الاسم والأيقونة والمشاركين والتشكيلات
            </p>
          </div>
          <button className="row-remove" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        <div className="edit-shell">
          <nav className="edit-nav">
            {sections.map(s => (
              <button
                key={s.id}
                type="button"
                className={`edit-nav-item ${section === s.id ? "is-active" : ""}`}
                onClick={() => setSection(s.id)}
              >
                <span className="edit-nav-icon">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>

          <div className="edit-pane">
            {section === "general" && (
              <GeneralSection draft={draft} set={set} SPORTS={SPORTS} />
            )}
            {section === "participants" && (
              <ParticipantsSection
                draft={draft}
                onUpdate={updateParticipant}
                onRemove={removeParticipant}
              />
            )}
            {section === "lineups" && (
              <LineupsSection
                draft={draft}
                onUpdate={updateParticipant}
                onRemove={removeParticipant}
                onAddPlayer={addRosterPlayer}
                onUpdatePlayer={updateRosterPlayer}
                onRemovePlayer={removeRosterPlayer}
                onMovePlayer={(t, p) => setMovePlayer({ teamId: t, playerId: p })}
              />
            )}
            {section === "status" && (
              <StatusSection draft={draft} set={set} onArchive={onArchive} />
            )}
          </div>
        </div>

        {movePlayer && (
          <MovePlayerSheet
            participants={draft.participants}
            from={movePlayer.teamId}
            playerId={movePlayer.playerId}
            onClose={() => setMovePlayer(null)}
            onPick={(toId) => movePlayerTo(movePlayer.teamId, movePlayer.playerId, toId)}
          />
        )}

        <footer className="modal-footer">
          <span className="modal-meta">التعديلات تُحفظ على البطولة فوراً</span>
          <div>
            <button className="btn-ghost" onClick={onClose} type="button">إلغاء</button>
            <button className="btn-primary" onClick={() => onSave(draft)} type="button">حفظ التعديلات</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ---------- General ----------
function GeneralSection({ draft, set, SPORTS }) {
  return (
    <div className="edit-section">
      <div className="form-block">
        <label className="field-label">اسم البطولة</label>
        <input
          type="text"
          className="text-input"
          value={draft.name || ""}
          onChange={e => set("name", e.target.value)}
        />
      </div>

      <div className="form-block">
        <label className="field-label">الرياضة / الأيقونة</label>
        <div className="sport-grid sport-grid-compact">
          {SPORTS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`sport-card ${draft.sport?.id === s.id ? "is-active" : ""}`}
              onClick={() => set("sport", s)}
            >
              <div className="sport-emoji">{s.emoji}</div>
              <div className="sport-name">{s.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="form-block">
        <label className="field-label">رمز مخصص (إيموجي أو حرف)</label>
        <input
          type="text"
          className="text-input"
          maxLength={4}
          style={{ width: 120, fontSize: 22, textAlign: "center" }}
          value={draft.sport?.emoji || ""}
          onChange={e => set("sport", { ...draft.sport, emoji: e.target.value })}
        />
      </div>
    </div>
  );
}

// ---------- Participants (individual) ----------
function ParticipantsSection({ draft, onUpdate, onRemove }) {
  return (
    <div className="edit-section">
      <div className="edit-pane-head">
        <h3>المشاركون ({toArabicNum(draft.participants.length)})</h3>
        <p className="lede" style={{ fontSize: 12, color: "var(--c-text-3)" }}>
          عدّل الأسماء أو احذف. الإحصائيات والنتائج المسجّلة باسم المشارك ستُتحدّث تلقائياً.
        </p>
      </div>
      <div className="edit-list">
        {draft.participants.map(p => (
          <div key={p.id} className="edit-row">
            <span className="edit-row-icon">🧑</span>
            <input
              type="text"
              className="text-input edit-row-input"
              value={p.name}
              onChange={e => onUpdate(p.id, { name: e.target.value })}
            />
            <button className="row-remove" onClick={() => onRemove(p.id)} aria-label="حذف">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Lineups (team) ----------
function LineupsSection({ draft, onUpdate, onRemove, onAddPlayer, onUpdatePlayer, onRemovePlayer, onMovePlayer }) {
  const [openTeam, setOpenTeam] = React.useState(draft.participants[0]?.id || null);
  const [newPlayer, setNewPlayer] = React.useState("");

  return (
    <div className="edit-section">
      <div className="edit-pane-head">
        <h3>الفرق والتشكيلات</h3>
        <p className="lede" style={{ fontSize: 12, color: "var(--c-text-3)" }}>
          اختر فريقاً لتعديل تشكيلته. لنقل لاعب: اضغط زر النقل بجنب اسمه.
        </p>
      </div>

      <div className="lineup-edit-grid">
        <div className="team-list">
          {draft.participants.map(p => (
            <button
              key={p.id}
              type="button"
              className={`team-list-item ${openTeam === p.id ? "is-active" : ""}`}
              onClick={() => setOpenTeam(p.id)}
            >
              <div className="tli-info">
                <input
                  className="tli-name"
                  value={p.name}
                  onChange={e => { e.stopPropagation(); onUpdate(p.id, { name: e.target.value }); }}
                  onClick={e => e.stopPropagation()}
                />
                <div className="tli-meta">{toArabicNum((p.roster || []).length)} لاعب</div>
              </div>
              <button
                className="row-remove"
                onClick={(e) => { e.stopPropagation(); if (confirm(`حذف ${p.name}؟`)) onRemove(p.id); }}
                aria-label="حذف الفريق"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </button>
          ))}
        </div>

        <div className="roster-pane">
          {(() => {
            const team = draft.participants.find(p => p.id === openTeam);
            if (!team) return <div className="empty-mini">اختر فريقاً</div>;
            const roster = team.roster || [];
            return (
              <>
                <div className="roster-head">
                  <h4>{team.name}</h4>
                  <span className="lede" style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                    {toArabicNum(roster.length)} لاعب
                  </span>
                </div>

                <div className="roster-add">
                  <input
                    type="text"
                    className="text-input"
                    placeholder="اسم اللاعب"
                    value={newPlayer}
                    onChange={e => setNewPlayer(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        onAddPlayer(team.id, newPlayer);
                        setNewPlayer("");
                      }
                    }}
                  />
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => { onAddPlayer(team.id, newPlayer); setNewPlayer(""); }}
                  >
                    + إضافة
                  </button>
                </div>

                <div className="roster-list">
                  {roster.length === 0 && (
                    <div className="empty-mini">لا يوجد لاعبون في التشكيلة</div>
                  )}
                  {roster.map((pl, idx) => (
                    <div key={pl.id} className="roster-row">
                      <span className="roster-num">{toArabicNum(idx + 1)}</span>
                      <input
                        type="text"
                        className="text-input roster-input"
                        value={pl.name}
                        onChange={e => onUpdatePlayer(team.id, pl.id, e.target.value)}
                      />
                      <button
                        className="btn-ghost-icon"
                        type="button"
                        onClick={() => onMovePlayer(team.id, pl.id)}
                        title="نقل لفريق آخر"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                          <path d="M14 5l7 7-7 7M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        نقل
                      </button>
                      <button
                        className="row-remove"
                        onClick={() => onRemovePlayer(team.id, pl.id)}
                        aria-label="حذف"
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
                          <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ---------- Move player picker ----------
function MovePlayerSheet({ participants, from, playerId, onClose, onPick }) {
  const sourceTeam = participants.find(p => p.id === from);
  const player = (sourceTeam?.roster || []).find(pl => pl.id === playerId);
  const targets = participants.filter(p => p.id !== from);

  return (
    <div className="move-sheet-backdrop" onClick={onClose}>
      <div className="move-sheet" onClick={e => e.stopPropagation()}>
        <header className="move-sheet-head">
          <div>
            <div className="lede" style={{ fontSize: 12, color: "var(--c-text-3)" }}>نقل اللاعب</div>
            <h3>{player?.name}</h3>
            <div className="lede" style={{ fontSize: 12, color: "var(--c-text-3)" }}>
              من {sourceTeam?.name} إلى…
            </div>
          </div>
          <button className="row-remove" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>
        <div className="move-sheet-list">
          {targets.map(t => (
            <button
              key={t.id}
              type="button"
              className="move-target"
              onClick={() => onPick(t.id)}
            >
              <span className="move-target-name">{t.name}</span>
              <span className="move-target-meta">{toArabicNum((t.roster || []).length)} لاعب</span>
              <span className="move-target-arrow">←</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Status ----------
function StatusSection({ draft, set, onArchive }) {
  const statuses = [
    { id: "active", label: "جارية", desc: "البطولة قيد التشغيل، يمكن إدخال النتائج" },
    { id: "completed", label: "منتهية", desc: "انتهت جميع المباريات؛ تُعرض في الأرشيف" },
    { id: "draft", label: "مسودة", desc: "لم تُطلق بعد" },
  ];
  return (
    <div className="edit-section">
      <div className="edit-pane-head">
        <h3>حالة البطولة</h3>
      </div>
      <div className="status-grid">
        {statuses.map(s => (
          <button
            key={s.id}
            type="button"
            className={`status-card ${draft.status === s.id ? "is-active" : ""}`}
            onClick={() => set("status", s.id)}
          >
            <div className="status-card-name">
              <span className={`status-dot status-dot-${s.id}`}></span>
              {s.label}
            </div>
            <div className="status-card-desc">{s.desc}</div>
          </button>
        ))}
      </div>

      <div className="danger-block">
        <div>
          <div style={{ fontWeight: 700 }}>أرشفة البطولة</div>
          <div className="lede" style={{ fontSize: 12, color: "var(--c-text-3)" }}>
            تنقل البطولة من القائمة الجارية إلى المنتهية. يمكن استرجاعها بتغيير الحالة.
          </div>
        </div>
        <button
          className="btn-ghost-icon danger"
          type="button"
          onClick={() => { if (confirm("أرشفة هذه البطولة؟")) onArchive(); }}
        >
          أرشفة
        </button>
      </div>
    </div>
  );
}

window.EditTournamentModal = EditTournamentModal;
