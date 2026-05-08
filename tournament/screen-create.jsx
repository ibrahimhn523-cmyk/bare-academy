// =====================================================================
// screen-create.jsx — Screen 1: Create Tournament
// =====================================================================
const { useState } = React;

function ScreenCreate({ draft, setDraft, onNext }) {
  const { SPORTS } = window.TournamentData;
  const [customSport, setCustomSport] = useState("");

  const setField = (k, v) => setDraft({ ...draft, [k]: v });

  const competitionTypes = [
    { id: "individual", label: "فردي", desc: "لاعب ضد لاعب" },
    { id: "double", label: "ثنائي", desc: "زوج ضد زوج" },
    { id: "team", label: "جماعي", desc: "فريق ضد فريق" },
  ];

  const tournamentTypes = [
    { id: "league", label: "دوري", desc: "كل فريق يلاقي الجميع", icon: "⚖" },
    { id: "knockout", label: "خروج مغلوب", desc: "خسارة واحدة = خروج", icon: "✕" },
    { id: "league_knockout", label: "دوري + خروج مغلوب", desc: "دوري ثم مرحلة إقصائية", icon: "⇉" },
    { id: "groups_knockout", label: "مجموعات + خروج مغلوب", desc: "نظام كأس العالم", icon: "▦" },
  ];

  const valid = draft.name?.trim() && draft.sport && draft.competitionType && draft.type;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">الخطوة ١ من ٥</div>
          <h1>إنشاء بطولة جديدة</h1>
          <p className="lede">عرّف الأساسيات. باقي الإعدادات تتغير حسب اختياراتك.</p>
        </div>
      </header>

      <div className="form-stack">
        {/* Tournament name */}
        <section className="field-group">
          <label className="field-label">اسم البطولة</label>
          <input
            className="text-input lg"
            placeholder="مثال: بطولة الموسم الصيفي ٢٠٢٦"
            value={draft.name || ""}
            onChange={e => setField("name", e.target.value)}
          />
        </section>

        {/* Sport */}
        <section className="field-group">
          <label className="field-label">الرياضة</label>
          <div className="sport-grid">
            {SPORTS.map(s => (
              <button
                key={s.id}
                className={`sport-card ${draft.sport?.id === s.id ? "is-active" : ""}`}
                onClick={() => setField("sport", s)}
                type="button"
              >
                <span className="sport-emoji">{s.emoji}</span>
                <span className="sport-name">{s.name}</span>
              </button>
            ))}
            <button
              className={`sport-card sport-card-other ${draft.sport?.id === "other" ? "is-active" : ""}`}
              onClick={() => setField("sport", { id: "other", name: customSport || "أخرى", emoji: "✦", team: true })}
              type="button"
            >
              <span className="sport-emoji">✦</span>
              <span className="sport-name">أخرى</span>
            </button>
          </div>
          {draft.sport?.id === "other" && (
            <input
              className="text-input"
              placeholder="اسم الرياضة"
              value={customSport}
              onChange={e => {
                setCustomSport(e.target.value);
                setField("sport", { id: "other", name: e.target.value || "أخرى", emoji: "✦", team: true });
              }}
              style={{ marginTop: 12 }}
            />
          )}
        </section>

        {/* Competition type */}
        <section className="field-group">
          <label className="field-label">نوع المنافسة</label>
          <div className="seg-row">
            {competitionTypes.map(c => (
              <button
                key={c.id}
                className={`seg-card ${draft.competitionType === c.id ? "is-active" : ""}`}
                onClick={() => setField("competitionType", c.id)}
                type="button"
              >
                <strong>{c.label}</strong>
                <span>{c.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Tournament type */}
        <section className="field-group">
          <label className="field-label">نوع البطولة</label>
          <div className="type-grid">
            {tournamentTypes.map(t => (
              <button
                key={t.id}
                className={`type-card ${draft.type === t.id ? "is-active" : ""}`}
                onClick={() => setField("type", t.id)}
                type="button"
              >
                <div className="type-icon">{t.icon}</div>
                <div className="type-text">
                  <strong>{t.label}</strong>
                  <span>{t.desc}</span>
                </div>
                <div className="type-check">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <footer className="screen-footer">
        <div className="footer-hint">
          {valid ? "كل شي جاهز — كمل للإعدادات التفصيلية" : "اكمل الحقول للمتابعة"}
        </div>
        <button className="btn-primary" disabled={!valid} onClick={onNext}>
          التالي: الإعدادات
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ marginRight: 8 }}>
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </footer>
    </div>
  );
}

window.ScreenCreate = ScreenCreate;
