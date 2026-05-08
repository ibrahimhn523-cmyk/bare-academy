// =====================================================================
// screen-settings.jsx — Screen 2: Detailed settings (conditional)
// =====================================================================

function NumStepper({ value, onChange, min = 0, max = 99 }) {
  return (
    <div className="num-stepper">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="إنقاص"
      >−</button>
      <input
        type="number"
        value={value}
        onChange={e => {
          const v = parseInt(e.target.value || "0", 10);
          onChange(Math.min(max, Math.max(min, isNaN(v) ? 0 : v)));
        }}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="زيادة"
      >+</button>
    </div>
  );
}

function ToggleGroup({ value, options, onChange }) {
  return (
    <div className="toggle-group">
      {options.map(o => (
        <button
          key={o.id}
          className={`toggle-btn ${value === o.id ? "is-active" : ""}`}
          onClick={() => onChange(o.id)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ScreenSettings({ draft, setDraft, onNext, onBack }) {
  const cfg = draft.config || {};
  const setCfg = (patch) => setDraft({ ...draft, config: { ...cfg, ...patch } });

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">الخطوة ٢ من ٥</div>
          <h1>الإعدادات التفصيلية</h1>
          <p className="lede">حسب نوع البطولة: <span className="pill">{tournamentTypeLabel(draft.type)}</span></p>
        </div>
      </header>

      <div className="form-stack">
        {draft.type === "league" && <LeagueSettings cfg={cfg} setCfg={setCfg} />}
        {draft.type === "knockout" && <KnockoutSettings cfg={cfg} setCfg={setCfg} />}
        {draft.type === "league_knockout" && (
          <>
            <SectionHeader title="إعدادات مرحلة الدوري" />
            <LeagueSettings cfg={cfg} setCfg={setCfg} />
            <SectionHeader title="مرحلة خروج المغلوب" />
            <div className="field-group">
              <label className="field-label">كم يتأهل من الدوري للـ bracket؟</label>
              <NumStepper value={cfg.qualifiers || 4} onChange={v => setCfg({ qualifiers: v })} min={2} max={32} />
            </div>
            <KnockoutSettings cfg={cfg} setCfg={setCfg} hideCount />
          </>
        )}
        {draft.type === "groups_knockout" && (
          <>
            <SectionHeader title="مرحلة المجموعات" />
            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">عدد المجموعات</label>
                <NumStepper value={cfg.groupCount || 4} onChange={v => setCfg({ groupCount: v })} min={2} max={16} />
              </div>
              <div className="field-group">
                <label className="field-label">عدد المشاركين في كل مجموعة</label>
                <NumStepper value={cfg.perGroup || 4} onChange={v => setCfg({ perGroup: v })} min={2} max={8} />
              </div>
              <div className="field-group">
                <label className="field-label">يتأهل من كل مجموعة</label>
                <NumStepper value={cfg.qualifiersPerGroup || 2} onChange={v => setCfg({ qualifiersPerGroup: v })} min={1} max={4} />
              </div>
              <div className="field-group">
                <label className="field-label">نقاط (فوز/تعادل/خسارة)</label>
                <PointsRow
                  values={cfg.points || { win: 3, draw: 1, loss: 0 }}
                  onChange={v => setCfg({ points: v })}
                />
              </div>
            </div>
            <SectionHeader title="مرحلة خروج المغلوب" />
            <KnockoutSettings cfg={cfg} setCfg={setCfg} hideCount />
          </>
        )}
      </div>

      <footer className="screen-footer">
        <button className="btn-ghost" onClick={onBack}>السابق</button>
        <button className="btn-primary" onClick={onNext}>
          التالي: المشاركون
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ marginRight: 8 }}>
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </footer>
    </div>
  );
}

function SectionHeader({ title }) {
  return <div className="section-header"><span className="section-line" /><h2>{title}</h2><span className="section-line" /></div>;
}

function PointsRow({ values, onChange }) {
  return (
    <div className="points-row">
      <div className="points-cell">
        <div className="points-cell-label">فوز</div>
        <NumStepper value={values.win} onChange={v => onChange({ ...values, win: v })} max={20} />
      </div>
      <div className="points-cell">
        <div className="points-cell-label">تعادل</div>
        <NumStepper value={values.draw} onChange={v => onChange({ ...values, draw: v })} max={20} />
      </div>
      <div className="points-cell">
        <div className="points-cell-label">خسارة</div>
        <NumStepper value={values.loss} onChange={v => onChange({ ...values, loss: v })} max={20} />
      </div>
    </div>
  );
}

function LeagueSettings({ cfg, setCfg }) {
  return (
    <>
      <section className="field-group">
        <label className="field-label">شكل المباريات</label>
        <ToggleGroup
          value={cfg.doubleRound ? "double" : "single"}
          options={[
            { id: "single", label: "ذهاب فقط" },
            { id: "double", label: "ذهاب وإياب" },
          ]}
          onChange={id => setCfg({ doubleRound: id === "double" })}
        />
      </section>

      <section className="field-group">
        <label className="field-label">نقاط الجدول</label>
        <PointsRow
          values={cfg.points || { win: 3, draw: 1, loss: 0 }}
          onChange={v => setCfg({ points: v })}
        />
      </section>

      <section className="field-group">
        <label className="field-label">ترتيب الجدول عند التساوي</label>
        <ToggleGroup
          value={cfg.tiebreak || "gd"}
          options={[
            { id: "gd", label: "فارق الأهداف" },
            { id: "gf", label: "الأهداف المسجلة" },
          ]}
          onChange={id => setCfg({ tiebreak: id })}
        />
      </section>
    </>
  );
}

function KnockoutSettings({ cfg, setCfg, hideCount }) {
  const counts = [8, 16, 32];
  return (
    <>
      {!hideCount && (
        <section className="field-group">
          <label className="field-label">عدد المشاركين</label>
          <div className="count-row">
            {counts.map(n => (
              <button
                key={n}
                type="button"
                className={`count-pill ${cfg.participantCount === n ? "is-active" : ""}`}
                onClick={() => setCfg({ participantCount: n, customCount: false })}
              >{n}</button>
            ))}
            <button
              type="button"
              className={`count-pill ${cfg.customCount ? "is-active" : ""}`}
              onClick={() => setCfg({ customCount: true })}
            >مخصص</button>
            {cfg.customCount && (
              <input
                type="number"
                className="text-input inline-num"
                min={2} max={128}
                value={cfg.participantCount || 4}
                onChange={e => setCfg({ participantCount: parseInt(e.target.value || "4", 10) })}
              />
            )}
          </div>
        </section>
      )}

      <section className="field-group">
        <label className="field-label">البذر (Seeding)</label>
        <ToggleGroup
          value={cfg.seeding || "auto"}
          options={[
            { id: "auto", label: "تلقائي" },
            { id: "manual", label: "يدوي" },
          ]}
          onChange={id => setCfg({ seeding: id })}
        />
      </section>

      <section className="field-group">
        <label className="field-label">مباراة المركز الثالث</label>
        <ToggleGroup
          value={cfg.thirdPlace ? "yes" : "no"}
          options={[
            { id: "yes", label: "نعم" },
            { id: "no", label: "لا" },
          ]}
          onChange={id => setCfg({ thirdPlace: id === "yes" })}
        />
      </section>

      <section className="field-group">
        <label className="field-label">أفضل من</label>
        <ToggleGroup
          value={String(cfg.bestOf || 1)}
          options={[
            { id: "1", label: "مباراة واحدة" },
            { id: "3", label: "أفضل من ٣" },
            { id: "5", label: "أفضل من ٥" },
          ]}
          onChange={id => setCfg({ bestOf: parseInt(id, 10) })}
        />
      </section>
    </>
  );
}

function tournamentTypeLabel(t) {
  return {
    league: "دوري",
    knockout: "خروج مغلوب",
    league_knockout: "دوري + خروج مغلوب",
    groups_knockout: "مجموعات + خروج مغلوب",
  }[t] || "—";
}

window.ScreenSettings = ScreenSettings;
window.tournamentTypeLabel = tournamentTypeLabel;
