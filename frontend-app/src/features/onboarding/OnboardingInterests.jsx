import { useState } from 'react';
import api from '../../api';
import Chip from '../../components/Chip';
import Button from '../../components/Button';
import { INTERESTS, KIND_HUE } from '../../lib/categoryMeta';
import { Progress } from './OnboardingCity';

// Question 2 of 2 (ADR 0014). Budget, group type and the rest are inferred later.
export default function OnboardingInterests({ onNavigate }) {
  const [on, setOn] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const toggle = (id) => setOn((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const next = async () => {
    setSaving(true);
    try { await api.updateOnboarding({ interests: [...on], currentStep: 2 }); } catch {}
    setSaving(false);
    onNavigate('onboarding-import');
  };

  return (
    <div className="wt-screen">
      <Progress step={2} />
      <h1 className="wt-title lg" style={{ fontSize: 33, marginBottom: 9 }}>What do you<br />want more of?</h1>
      <p className="wt-sub" style={{ marginBottom: 24 }}>Pick a few. We'll learn the rest from what you save.</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, alignContent: 'flex-start' }}>
        {INTERESTS.map((i) => (
          <Chip key={i.id} select on={on.has(i.id)} dot={KIND_HUE[i.kind]} onClick={() => toggle(i.id)}>{i.label}</Chip>
        ))}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <p style={{ fontSize: 13.5, color: 'var(--faint)', margin: 0, textAlign: 'center' }}>{on.size === 0 ? 'Pick at least one' : `${on.size} selected`}</p>
        <Button onClick={next} disabled={saving || on.size === 0}>Continue</Button>
      </div>
    </div>
  );
}
