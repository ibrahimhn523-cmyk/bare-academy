// =====================================================================
// screen-points.jsx — Screen 4: Points integration
// =====================================================================

function ScreenPoints({ draft, setDraft, onNext, onBack }) {
  const ps = draft.pointsSystem || {
    mode: "perMatch", win: 10, draw: 5, loss: 2,
    first: 100, second: 60, third: 40,
  };
  const setPs = (patch) => setDraft({ ...draft, pointsSystem: { ...ps, ...patch } });

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">الخطوة ٤ من ٥</div>
          <h1>ربط النقاط بالنظام العام</h1>
          <p className="lede">نقاط البطولة المضافة لرصيد كل لاعب في برنامج الأكاديمية. منفصلة عن نقاط جدول البطولة.</p>
        </div>
      </header>

      <div className="form-stack">
        <section className="field-group">
          <label className="field-label">متى تُضاف النقاط؟</label>
          <div className="seg-row">
            <button
              type="button"
              className={`seg-card ${ps.mode === "perMatch" ? "is-active" : ""}`}
              onClick={() => setPs({ mode: "perMatch" })}
            >
              <strong>مع كل مباراة</strong>
              <span>اللاعب يحصل على نقاط فور انتهاء كل مباراة</span>
            </button>
            <button
              type="button"
              className={`seg-card ${ps.mode === "endOnly" ? "is-active" : ""}`}
              onClick={() => setPs({ mode: "endOnly" })}
            >
              <strong>في نهاية البطولة</strong>
              <span>تُحسب فقط للمراكز الثلاثة الأولى</span>
            </button>
          </div>
        </section>

        {ps.mode === "perMatch" && (
          <section className="field-group">
            <label className="field-label">نقاط لكل مباراة</label>
            <div className="points-row big">
              <div className="points-cell">
                <div className="points-cell-label">فوز</div>
                <NumStepper value={ps.win} onChange={v => setPs({ win: v })} max={999} />
              </div>
              <div className="points-cell">
                <div className="points-cell-label">تعادل</div>
                <NumStepper value={ps.draw} onChange={v => setPs({ draw: v })} max={999} />
              </div>
              <div className="points-cell">
                <div className="points-cell-label">خسارة</div>
                <NumStepper value={ps.loss} onChange={v => setPs({ loss: v })} max={999} />
              </div>
            </div>
          </section>
        )}

        <section className="field-group">
          <label className="field-label">نقاط المراكز عند انتهاء البطولة</label>
          <div className="podium-row">
            <PodiumCard
              rank={1} medal="🥇" label="المركز الأول" tone="gold"
              value={ps.first} onChange={v => setPs({ first: v })}
            />
            <PodiumCard
              rank={2} medal="🥈" label="المركز الثاني" tone="silver"
              value={ps.second} onChange={v => setPs({ second: v })}
            />
            <PodiumCard
              rank={3} medal="🥉" label="المركز الثالث" tone="bronze"
              value={ps.third} onChange={v => setPs({ third: v })}
            />
          </div>
        </section>

        <div className="info-card">
          <div className="info-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M12 8v0M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <strong>كيف تُحسب؟</strong>
            <p>
              {ps.mode === "perMatch"
                ? `كل لاعب يجمع نقاطه من المباريات تلقائياً. الفائز بالبطولة يحصل على ${toArabicNum(ps.first)} نقطة إضافية كمكافأة المركز الأول.`
                : `لا تُضاف نقاط أثناء البطولة. عند الانتهاء، الثلاثة الأوائل فقط يحصلون على نقاطهم.`}
            </p>
          </div>
        </div>
      </div>

      <footer className="screen-footer">
        <button className="btn-ghost" onClick={onBack}>السابق</button>
        <button className="btn-primary" onClick={onNext}>
          التالي: المعاينة والإطلاق
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ marginRight: 8 }}>
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </footer>
    </div>
  );
}

function PodiumCard({ rank, medal, label, tone, value, onChange }) {
  return (
    <div className={`podium-card podium-${tone}`}>
      <div className="podium-medal">{medal}</div>
      <div className="podium-label">{label}</div>
      <NumStepper value={value} onChange={onChange} max={9999} />
      <div className="podium-suffix">نقطة</div>
    </div>
  );
}

window.ScreenPoints = ScreenPoints;
