import { useMemo, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { unlockAudio, playTick, playUncheck, playFanfare, fireConfetti } from '../../lib/effects';

const SECTION_COLORS = ['olive', 'blue', 'amber', 'purple', 'rose', 'teal', 'slate', 'brown'];

export default function ChecklistCard() {
  const { userSteps } = useAppData();
  const [checked, setChecked] = useState(() => new Set());
  const [bouncing, setBouncing] = useState(null);

  const sections = useMemo(() => {
    const map = {};
    userSteps.forEach((s) => { (map[s.section] ||= []).push(s); });
    return Object.entries(map);
  }, [userSteps]);

  const total = userSteps.length;
  const done = checked.size;

  function toggle(id) {
    unlockAudio();
    setChecked((prev) => {
      const next = new Set(prev);
      const willCheck = !next.has(id);
      if (willCheck) next.add(id); else next.delete(id);
      willCheck ? playTick() : playUncheck();
      if (willCheck && next.size === total && total > 0) {
        fireConfetti(document.getElementById('confetti-container'));
        playFanfare();
      }
      return next;
    });
    setBouncing(id);
    setTimeout(() => setBouncing((b) => (b === id ? null : b)), 300);
  }

  function handleKey(e, id) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(id); }
  }

  function reset() { setChecked(new Set()); }

  const complete = total > 0 && done === total;

  return (
    <div className="card">
      <div className="page-hd" style={{ marginBottom: 14 }}>
        <h2 className="page-title" style={{ fontSize: 19 }}>Pre-Trade Checklist</h2>
        <p className="page-sub">Confirm every step.</p>
      </div>
      <div className="prog">
        <div className="prog-num">{done}<span> / {total}</span></div>
        <div className="prog-right">
          <div className="prog-label">Checklist Progress</div>
          <div className="prog-track" role="progressbar" aria-valuenow={done} aria-valuemin="0" aria-valuemax={total}>
            <div className="prog-fill" style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : '0%' }} />
          </div>
        </div>
      </div>
      <div className={`complete-banner ${complete ? 'visible' : ''}`}>
        <div className="complete-banner-icon">✦</div>
        <div>
          <div className="complete-banner-text">Checklist complete — ready to trade.</div>
          <div className="complete-banner-sub">Log your trade after execution.</div>
        </div>
      </div>

      <div id="checklist-steps-wrap">
        {total === 0 ? (
          <div className="empty-state">No checklist steps yet.<br />Add them in Settings.</div>
        ) : (
          sections.map(([name, steps], sIdx) => (
          <section className="section" data-color={SECTION_COLORS[sIdx % SECTION_COLORS.length]} key={name}>
            <div className="sec-label">
              <div className="sec-icon">{String(sIdx + 1).padStart(2, '0')}</div>
              <h2 className="sec-name">{name}</h2>
              <div className="sec-rule" />
            </div>
            <ul className="steps-wrap">
              {steps.map((step, i) => {
                const isChecked = checked.has(step.id);
                return (
                  <li key={step.id}
                    className={`step ${isChecked ? 'checked' : ''} ${bouncing === step.id ? 'bounce' : ''}`}
                    tabIndex={0}
                    aria-checked={isChecked}
                    onClick={() => toggle(step.id)}
                    onKeyDown={(e) => handleKey(e, step.id)}>
                    <div className="step-left-bar" />
                    <span className="step-num">{String(userSteps.indexOf(step) + 1).padStart(2, '0')}</span>
                    <div className="step-body">
                      <span className="step-cat">{name}</span>
                      <p className="step-title">{step.title}</p>
                    </div>
                    <div className="step-cb">
                      <svg className="cb-svg" width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.8 7L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      </div>

      <div className="checklist-footer">
        <button className="reset-btn" type="button" onClick={reset}>↺ Reset</button>
      </div>
    </div>
  );
}