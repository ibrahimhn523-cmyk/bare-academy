// =====================================================================
// screen-participants.jsx — Screen 3: Participants list (drag-reorder)
// =====================================================================

function ScreenParticipants({ draft, setDraft, onNext, onBack }) {
  const { SAUDI_TEAMS, uid } = window.TournamentData;
  const [showProgramModal, setShowProgramModal] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [dragId, setDragId] = React.useState(null);
  const [dragOverId, setDragOverId] = React.useState(null);
  const [expandedId, setExpandedId] = React.useState(null);
  const [rosterPickerFor, setRosterPickerFor] = React.useState(null);

  // Pull participants from the selected program's subscriptions (ADR-011 wire-up).
  const [programStudents, setProgramStudents] = React.useState([]);
  const [loadingStudents, setLoadingStudents] = React.useState(false);
  const [studentsError, setStudentsError] = React.useState(null);

  React.useEffect(() => {
    if (!draft.programId) { setProgramStudents([]); return; }
    let cancelled = false;
    setLoadingStudents(true);
    setStudentsError(null);
    window.TDB.loadParticipants(draft.programId)
      .then(list => {
        if (cancelled) return;
        setProgramStudents(list || []);
        setLoadingStudents(false);
      })
      .catch(e => {
        if (cancelled) return;
        console.warn('loadParticipants failed:', e.message);
        setStudentsError(e.message);
        setLoadingStudents(false);
      });
    return () => { cancelled = true; };
  }, [draft.programId]);

  const participants = draft.participants || [];
  const setParticipants = (p) => setDraft({ ...draft, participants: p });

  const addParticipant = () => {
    if (!newName.trim()) return;
    setParticipants([...participants, { id: uid(), name: newName.trim(), roster: [] }]);
    setNewName("");
  };

  const removeParticipant = (id) => setParticipants(participants.filter(p => p.id !== id));

  const updateParticipantLogo = (id, logo) => {
    setParticipants(participants.map(p => p.id === id ? { ...p, logo } : p));
  };

  const updateRoster = (teamId, nextRoster) => {
    setParticipants(participants.map(p => p.id === teamId ? { ...p, roster: nextRoster } : p));
  };
  const addPlayerToTeam = (teamId, name) => {
    if (!name.trim()) return;
    const team = participants.find(p => p.id === teamId);
    const roster = team?.roster || [];
    updateRoster(teamId, [...roster, { id: uid(), name: name.trim() }]);
  };
  const removePlayerFromTeam = (teamId, playerId) => {
    const team = participants.find(p => p.id === teamId);
    updateRoster(teamId, (team?.roster || []).filter(pl => pl.id !== playerId));
  };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const next = [...participants];
    const fromIdx = next.findIndex(p => p.id === dragId);
    const toIdx = next.findIndex(p => p.id === targetId);
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setParticipants(next);
    setDragId(null); setDragOverId(null);
  };

  const isTeam = draft.competitionType === "team";
  const isDouble = draft.competitionType === "double";

  // Pool format: [{value, label, sub?}] — `value` is the stable id sent back
  // through onAdd. For students we pass studentId; for team-mode (no DB) we
  // fall back to the static SAUDI_TEAMS array keyed by name.
  const studentPool = programStudents.map(s => ({
    value: s.studentId,
    label: s.name,
    sub:   s.group ? `· ${s.group}` : (s.category ? `· ${s.category}` : ''),
  }));
  const teamPool = SAUDI_TEAMS.map(n => ({ value: n, label: n }));
  const programPool = isTeam ? teamPool : studentPool;

  const requiredCount = computeRequiredCount(draft);

  // Doubles: track pair players inline
  const updatePair = (pairId, idx, name) => {
    setParticipants(participants.map(p => {
      if (p.id !== pairId) return p;
      const players = [...(p.players || ["", ""])];
      players[idx] = name;
      const newName = players.filter(Boolean).join(" / ") || "زوج جديد";
      return { ...p, players, name: newName };
    }));
  };

  const addPair = () => {
    setParticipants([...participants, { id: uid(), name: "زوج جديد", players: ["", ""] }]);
  };

  // Build set of names already in any pair (to disable in dropdowns)
  const usedInPairs = React.useMemo(() => {
    const s = new Set();
    if (!isDouble) return s;
    participants.forEach(p => (p.players || []).forEach(n => n && s.add(n)));
    return s;
  }, [participants, isDouble]);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">الخطوة ٣ من ٥</div>
          <h1>المشاركون</h1>
          <p className="lede">
            أضف {isTeam ? "الفرق" : "اللاعبين"}، ورتّبهم بالسحب.
            {requiredCount && <> العدد المطلوب: <strong>{toArabicNum(requiredCount)}</strong> مشارك.</>}
          </p>
        </div>
        <div className="participant-count-badge">
          <strong>{toArabicNum(participants.length)}</strong>
          <span>{isTeam ? "فريق" : "لاعب"}</span>
        </div>
      </header>

      <div className="participant-toolbar">
        {isDouble ? (
          <div className="add-participant">
            <button className="btn-secondary" onClick={addPair} type="button">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              إضافة زوج
            </button>
            <span className="lede" style={{ fontSize: 13, color: "var(--c-text-3)" }}>
              اربط لاعبَين معاً ليكوّنا زوجاً
            </span>
          </div>
        ) : (
          <div className="add-participant">
            <input
              type="text"
              className="text-input"
              placeholder={isTeam ? "اسم الفريق" : "اسم اللاعب"}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addParticipant()}
            />
            <button className="btn-secondary" onClick={addParticipant} type="button">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              إضافة
            </button>
          </div>
        )}
        <div className="toolbar-actions">
          <button className="btn-ghost-icon" onClick={() => setShowProgramModal(true)} type="button">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            سحب من البرنامج
          </button>
          {participants.length > 0 && (
            <button className="btn-ghost-icon danger" onClick={() => setParticipants([])} type="button">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M5 7h14M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-7 0v12a2 2 0 002 2h6a2 2 0 002-2V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              مسح الكل
            </button>
          )}
        </div>
      </div>

      <div className="participants-list">
        {participants.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <circle cx="17" cy="9" r="2" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M14 17c0-2 1.7-3.5 3-3.5s3 1.5 3 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="empty-title">لا يوجد مشاركون بعد</div>
            <div className="empty-desc">أضف يدوياً أو اسحب من برنامج الأكاديمية</div>
          </div>
        )}
        {participants.map((p, i) => {
          const expanded = expandedId === p.id;
          const roster = p.roster || [];
          if (isDouble) {
            const players = p.players || ["", ""];
            return (
              <div
                key={p.id}
                className={`pair-row ${dragOverId === p.id ? "is-drop-target" : ""}`}
                draggable
                onDragStart={(e) => handleDragStart(e, p.id)}
                onDragOver={(e) => handleDragOver(e, p.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => handleDrop(e, p.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              >
                <div className="pair-num">{toArabicNum(i + 1)}</div>
                <div className="pair-slots">
                  {[0, 1].map(idx => (
                    <div key={idx} className="pair-slot">
                      <span className="pair-link">
                        {idx === 0 ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                            <path d="M9 12h6M9 8h6M9 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                            <circle cx="6" cy="12" r="2" stroke="currentColor" strokeWidth="1.6"/>
                            <circle cx="18" cy="12" r="2" stroke="currentColor" strokeWidth="1.6"/>
                          </svg>
                        ) : "+"}
                      </span>
                      <input
                        list={`pair-pool-${p.id}-${idx}`}
                        className="pair-pname-input"
                        placeholder={`اللاعب ${toArabicNum(idx + 1)}`}
                        value={players[idx] || ""}
                        onChange={e => updatePair(p.id, idx, e.target.value)}
                      />
                      <datalist id={`pair-pool-${p.id}-${idx}`}>
                        {programStudents
                          .map(s => s.name)
                          .filter(n => !usedInPairs.has(n) || players[idx] === n)
                          .map(n => <option key={n} value={n} />)}
                      </datalist>
                    </div>
                  ))}
                </div>
                <button className="row-remove" onClick={() => removeParticipant(p.id)} aria-label="إزالة">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            );
          }
          return (
            <div key={p.id} className={`participant-block ${expanded ? "is-expanded" : ""}`}>
              <div
                className={`participant-row ${dragOverId === p.id ? "is-drop-target" : ""} ${dragId === p.id ? "is-dragging" : ""}`}
                draggable
                onDragStart={(e) => handleDragStart(e, p.id)}
                onDragOver={(e) => handleDragOver(e, p.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => handleDrop(e, p.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              >
                <div className="drag-handle" aria-label="سحب">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/>
                    <circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/>
                    <circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>
                  </svg>
                </div>
                <div className="participant-seed">{toArabicNum(i + 1)}</div>
                <ParticipantAvatar participant={p} onLogoChange={(url) => updateParticipantLogo(p.id, url)} />
                <div className="participant-name">{p.name}</div>
                {isTeam && (
                  <button
                    className="roster-toggle"
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6"/>
                      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      <circle cx="17" cy="9" r="2" stroke="currentColor" strokeWidth="1.6"/>
                      <path d="M14 17c0-2 1.7-3.5 3-3.5s3 1.5 3 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                    <span>{toArabicNum(roster.length)} لاعب</span>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" className={`chev ${expanded ? "is-up" : ""}`}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
                <button className="row-remove" onClick={() => removeParticipant(p.id)} aria-label="إزالة">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              {isTeam && expanded && (
                <RosterPanel
                  team={p}
                  roster={roster}
                  onAdd={(name) => addPlayerToTeam(p.id, name)}
                  onRemove={(pid) => removePlayerFromTeam(p.id, pid)}
                  onPickFromProgram={() => setRosterPickerFor(p.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      {showProgramModal && (
        <ProgramModal
          isTeam={isTeam}
          title={isTeam ? "سحب الفرق من البرنامج" : "سحب اللاعبين من البرنامج"}
          pool={programPool}
          existing={isTeam
            ? participants.map(p => p.name)             // team mode: existence by name
            : participants.map(p => p.studentId).filter(Boolean) // individual: by studentId
          }
          loading={!isTeam && loadingStudents}
          error={!isTeam && studentsError}
          emptyHint={!isTeam && !programStudents.length && !loadingStudents
            ? 'لا يوجد مشتركون في البرنامج المحدد'
            : null}
          onClose={() => setShowProgramModal(false)}
          onAdd={(values) => {
            const fresh = values.map(v => {
              if (isTeam) {
                return { id: uid(), name: v, roster: [] };
              }
              const student = programStudents.find(s => s.studentId === v);
              return {
                id:        uid(),
                name:      student?.name || String(v),
                studentId: student?.studentId || null,
                roster:    [],
              };
            });
            setParticipants([...participants, ...fresh]);
            setShowProgramModal(false);
          }}
        />
      )}

      {rosterPickerFor && (() => {
        const team = participants.find(p => p.id === rosterPickerFor);
        // Map studentId → {teamId, teamName, playerId} so RosterPicker can flag
        // students already on another team. Only DB-sourced roster entries (those
        // with studentId) participate; manual additions stay invisible to the
        // picker.
        const playerTeamMap = {};
        participants.forEach(t => {
          (t.roster || []).forEach(pl => {
            if (pl.studentId) {
              playerTeamMap[pl.studentId] = { teamId: t.id, teamName: t.name, playerId: pl.id };
            }
          });
        });
        return (
          <RosterPickerModal
            targetTeam={team}
            pool={studentPool}
            playerTeamMap={playerTeamMap}
            studentsById={new Map(programStudents.map(s => [s.studentId, s]))}
            loading={loadingStudents}
            error={studentsError}
            emptyHint={!programStudents.length && !loadingStudents
              ? 'لا يوجد مشتركون في البرنامج المحدد'
              : null}
            onClose={() => setRosterPickerFor(null)}
            onCommit={(adds, moves) => {
              // adds: array of studentIds (new), moves: array of {studentId, fromTeamId, fromPlayerId}
              let next = participants.map(p => ({ ...p, roster: [...(p.roster || [])] }));
              // remove from source teams
              moves.forEach(m => {
                const src = next.find(p => p.id === m.fromTeamId);
                if (src) src.roster = src.roster.filter(pl => pl.id !== m.fromPlayerId);
              });
              // add to target
              const target = next.find(p => p.id === rosterPickerFor);
              if (target) {
                adds.forEach(sid => {
                  const s = programStudents.find(x => x.studentId === sid);
                  target.roster.push({ id: uid(), name: s?.name || String(sid), studentId: sid });
                });
                moves.forEach(m => {
                  const s = programStudents.find(x => x.studentId === m.studentId);
                  target.roster.push({ id: uid(), name: s?.name || String(m.studentId), studentId: m.studentId });
                });
              }
              setParticipants(next);
              setRosterPickerFor(null);
            }}
          />
        );
      })()}

      <footer className="screen-footer">
        <button className="btn-ghost" onClick={onBack}>السابق</button>
        <button className="btn-primary" disabled={participants.length < 2} onClick={onNext}>
          التالي: نقاط البرنامج
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ marginRight: 8 }}>
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </footer>
    </div>
  );
}

function ParticipantAvatar({ participant, onLogoChange }) {
  const fileRef = React.useRef(null);
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLogoChange(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return (
    <button
      type="button"
      className={`participant-avatar ${participant.logo ? "has-logo" : ""}`}
      onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
      title="تغيير شعار الفريق"
    >
      {participant.logo ? <img src={participant.logo} alt="" /> : participant.name.charAt(0)}
      <span className="participant-avatar-edit">
        <svg viewBox="0 0 24 24" width="9" height="9" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </span>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} onClick={(e) => e.stopPropagation()} />
    </button>
  );
}

function RosterPanel({ team, roster, onAdd, onRemove, onPickFromProgram }) {
  const [name, setName] = React.useState("");
  const handleAdd = () => {
    if (name.trim()) { onAdd(name); setName(""); }
  };
  return (
    <div className="roster-panel">
      <div className="roster-header">
        <div className="roster-title">
          <span className="roster-team-dot">{team.name.charAt(0)}</span>
          <span>تشكيلة {team.name}</span>
          <span className="roster-count">{toArabicNum(roster.length)} لاعب</span>
        </div>
        <button className="link-btn" onClick={onPickFromProgram} type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" style={{ verticalAlign: "middle", marginInlineEnd: 4 }}>
            <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          سحب من البرنامج
        </button>
      </div>

      <div className="roster-add">
        <input
          type="text"
          className="text-input"
          placeholder="اسم اللاعب"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <button className="btn-secondary" onClick={handleAdd} type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          إضافة
        </button>
      </div>

      {roster.length === 0 ? (
        <div className="roster-empty">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" style={{ opacity: 0.4 }}>
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span>أضف لاعبين للفريق — يدوياً أو من برنامج الأكاديمية</span>
        </div>
      ) : (
        <div className="roster-list">
          {roster.map((player, i) => (
            <div key={player.id} className="roster-chip">
              <span className="roster-chip-num">{toArabicNum(i + 1)}</span>
              <span>{player.name}</span>
              <button className="roster-chip-remove" onClick={() => onRemove(player.id)} aria-label="إزالة" type="button">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RosterPickerModal({ targetTeam, pool, playerTeamMap, onClose, onCommit, loading, error, emptyHint }) {
  // pool: Array<{value, label, sub?}>             (value = studentId)
  // playerTeamMap: { [studentId]: {teamId, teamName, playerId} }
  // onCommit(adds: studentId[], moves: {studentId, fromTeamId, fromPlayerId}[])
  const [search, setSearch] = React.useState("");
  // selected: Map(studentId -> { kind: 'add' | 'move', from?: {teamId, teamName, playerId} })
  const [selected, setSelected] = React.useState(new Map());

  const filtered = pool.filter(p => (p.label || '').includes(search));

  const toggle = (p) => {
    const next = new Map(selected);
    if (next.has(p.value)) {
      next.delete(p.value);
    } else {
      const owned = playerTeamMap[p.value];
      if (owned && owned.teamId === targetTeam.id) return; // already in this team
      next.set(p.value, owned ? { kind: "move", from: owned } : { kind: "add" });
    }
    setSelected(next);
  };

  const adds = [];
  const moves = [];
  selected.forEach((v, sid) => {
    if (v.kind === "add") adds.push(sid);
    else moves.push({ studentId: sid, fromTeamId: v.from.teamId, fromPlayerId: v.from.playerId });
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>إضافة لاعبين لـ {targetTeam.name}</h2>
          <button className="row-remove" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>
        <div className="modal-search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="بحث في اللاعبين…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="modal-body">
          {loading && (
            <div style={{padding:40,textAlign:'center',color:'var(--c-text-3)'}}>⏳ جاري تحميل المشتركين…</div>
          )}
          {!loading && error && (
            <div style={{padding:40,textAlign:'center',color:'var(--c-warning)'}}>⚠️ خطأ: {error}</div>
          )}
          {!loading && !error && emptyHint && (
            <div style={{padding:40,textAlign:'center',color:'var(--c-text-3)'}}>{emptyHint}</div>
          )}
          {!loading && !error && !emptyHint && (
            <div className="program-grid">
              {filtered.map(p => {
                const owned = playerTeamMap[p.value];
                const inThisTeam = owned && owned.teamId === targetTeam.id;
                const inOtherTeam = owned && owned.teamId !== targetTeam.id;
                const sel = selected.get(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    className={`program-chip ${sel ? "is-selected" : ""} ${inThisTeam ? "is-existing" : ""} ${inOtherTeam ? "is-other-team" : ""}`}
                    onClick={() => toggle(p)}
                    disabled={inThisTeam}
                  >
                    <span className="program-chip-dot">{(p.label || '?').charAt(0)}</span>
                    <span className="program-chip-name">{p.label}{p.sub ? <span style={{color:'var(--c-text-3)',fontSize:'.8em',marginInlineStart:6}}>{p.sub}</span> : null}</span>
                    {inThisTeam && <span className="program-chip-meta">في الفريق</span>}
                    {inOtherTeam && !sel && <span className="program-chip-meta program-chip-other">في {owned.teamName}</span>}
                    {sel?.kind === "move" && <span className="program-chip-meta program-chip-move">سينتقل من {sel.from.teamName}</span>}
                    {sel && (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" className="program-chip-check">
                        <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <footer className="modal-footer">
          <span className="modal-meta">
            {toArabicNum(adds.length)} إضافة · {toArabicNum(moves.length)} نقل
          </span>
          <div>
            <button className="btn-ghost" onClick={onClose} type="button">إلغاء</button>
            <button
              className="btn-primary"
              disabled={selected.size === 0}
              onClick={() => onCommit(adds, moves)}
              type="button"
            >تأكيد ({toArabicNum(selected.size)})</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ProgramModal({ isTeam, pool, existing, onClose, onAdd, title, loading, error, emptyHint }) {
  // pool: Array<{value, label, sub?}>  (value is the stable id sent through onAdd)
  // existing: Array<value>            (already-added values to disable in the grid)
  const existingSet = React.useMemo(() => new Set(existing), [existing]);
  const [selected, setSelected] = React.useState(new Set());
  const [search, setSearch] = React.useState("");

  const filtered = pool.filter(p => (p.label || '').includes(search));
  const selectableInFiltered = filtered.filter(p => !existingSet.has(p.value));
  const allSelected = selectableInFiltered.length > 0 &&
    selectableInFiltered.every(p => selected.has(p.value));

  const toggle = (p) => {
    if (existingSet.has(p.value)) return;
    const next = new Set(selected);
    if (next.has(p.value)) next.delete(p.value); else next.add(p.value);
    setSelected(next);
  };

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) {
      selectableInFiltered.forEach(p => next.delete(p.value));
    } else {
      selectableInFiltered.forEach(p => next.add(p.value));
    }
    setSelected(next);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title || "سحب من برنامج الأكاديمية"}</h2>
          <button className="row-remove" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>
        <div className="modal-search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder={`بحث في ${isTeam ? "الفرق" : "اللاعبين"}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="link-btn" onClick={toggleAll} type="button">
            {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
          </button>
        </div>
        <div className="modal-body">
          {loading && (
            <div style={{padding:40,textAlign:'center',color:'var(--c-text-3)'}}>⏳ جاري تحميل المشتركين…</div>
          )}
          {!loading && error && (
            <div style={{padding:40,textAlign:'center',color:'var(--c-warning)'}}>⚠️ خطأ: {error}</div>
          )}
          {!loading && !error && emptyHint && (
            <div style={{padding:40,textAlign:'center',color:'var(--c-text-3)'}}>{emptyHint}</div>
          )}
          {!loading && !error && !emptyHint && (
            <div className="program-grid">
              {filtered.map(p => {
                const isExisting = existingSet.has(p.value);
                const isSel = selected.has(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    className={`program-chip ${isSel ? "is-selected" : ""} ${isExisting ? "is-existing" : ""}`}
                    onClick={() => toggle(p)}
                    disabled={isExisting}
                  >
                    <span className="program-chip-dot">{(p.label || '?').charAt(0)}</span>
                    <span>{p.label}{p.sub ? <span style={{color:'var(--c-text-3)',fontSize:'.8em',marginInlineStart:6}}>{p.sub}</span> : null}</span>
                    {isSel && (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" className="program-chip-check">
                        <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {isExisting && <span className="program-chip-meta">مضاف</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <footer className="modal-footer">
          <span className="modal-meta">{toArabicNum(selected.size)} محدد</span>
          <div>
            <button className="btn-ghost" onClick={onClose} type="button">إلغاء</button>
            <button
              className="btn-primary"
              disabled={selected.size === 0}
              onClick={() => onAdd([...selected])}
              type="button"
            >إضافة المختارين</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function computeRequiredCount(draft) {
  if (draft.type === "knockout") return draft.config?.participantCount;
  if (draft.type === "groups_knockout") {
    return (draft.config?.groupCount || 0) * (draft.config?.perGroup || 0) || null;
  }
  return null;
}

function toArabicNum(n) {
  return String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
}

window.ScreenParticipants = ScreenParticipants;
window.toArabicNum = toArabicNum;
