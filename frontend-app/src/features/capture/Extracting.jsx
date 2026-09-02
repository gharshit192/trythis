import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

// "Reading your reels" — narrated progress for one or many upload jobs. The
// pipeline takes ~30 s a reel; narrated it reads as thorough, silent as broken.
const STAGES = [
  { key: 'caption', title: 'Read the caption',       sub: 'Title, description, hashtags' },
  { key: 'audio',   title: 'Listened to the audio',  sub: 'Hindi, English or mixed → English' },
  { key: 'frames',  title: 'Reading text on screen', sub: 'Menus, boards, prices' },
  { key: 'map',     title: 'Pin them on the map',    sub: 'Matching against known places' },
];
const POLL_MS = 2500;

export default function Extracting({ onNavigate, payload }) {
  const jobIds = payload?.jobIds || (payload?.jobId ? [payload.jobId] : []);
  const links = payload?.links || [];
  const [jobs, setJobs] = useState({});
  const [tick, setTick] = useState(0);
  const started = useRef(Date.now());

  useEffect(() => {
    if (!jobIds.length) return;
    let alive = true;
    const poll = async () => {
      const results = await Promise.all(jobIds.map((id) => api.getJobStatus(id).catch(() => null)));
      if (!alive) return;
      const next = {};
      for (let i = 0; i < results.length; i++) {
        const r = results[i]; if (!r) continue;
        // The job completes when the worker hands off; the reel is only *read*
        // when the save leaves 'processing'. Report the save's state instead.
        if (r.status === 'COMPLETED' && r.result?.saveId) {
          const sv = await api.getSaveById(r.result.saveId).catch(() => null);
          const ps = sv?.data?.processingStatus;
          if (ps === 'processing' || ps === 'pending') r.status = 'PROCESSING';
          if (sv?.data?.title) r.result.title = sv.data.title;
        }
        next[jobIds[i]] = r;
      }
      if (!alive) return;
      setJobs(next);
      setTick((t) => t + 1);
    };
    poll();
    const h = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(h); };
  }, [jobIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = jobIds.map((id) => jobs[id]).filter(Boolean);
  const done = list.filter((j) => j.status === 'COMPLETED' || j.status === 'FAILED');
  const finished = jobIds.length > 0 && done.length === jobIds.length;
  const current = list.find((j) => j.status === 'PROCESSING') || list.find((j) => j.status === 'PENDING') || list[0];
  // Stage progress is elapsed-time based per job: the worker does not report
  // sub-stages, and honest narration beats a spinner.
  const elapsed = (Date.now() - started.current) / 1000;
  const stageIdx = finished ? STAGES.length : Math.min(STAGES.length - 1, Math.floor(elapsed / 8));

  useEffect(() => {
    if (!finished) return;
    const saveIds = done.map((j) => j.result?.saveId).filter(Boolean);
    const t = setTimeout(() => {
      if (payload?.onboarding || saveIds.length > 1) onNavigate('starter', { saveIds, failed: done.filter((j) => j.status === 'FAILED').length });
      else if (saveIds.length === 1) onNavigate('save-detail', { id: saveIds[0], refresh: true });
      else onNavigate('home', { refresh: true });
    }, 600);
    return () => clearTimeout(t);
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = current?.result?.title || links[jobIds.indexOf(current?.jobId)] || current?.sourceUrl || 'your reel';

  return (
    <div className="wt-screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
        <span className="wt-eyebrow">Reading your reels</span>
        {jobIds.length > 1 && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--faint)' }}>{Math.min(done.length + 1, jobIds.length)} of {jobIds.length}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', marginBottom: 26 }}>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>{(current?.sourceUrl || '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.25 }}>{String(title).slice(0, 90)}</span>
      </div>

      <div>
        {STAGES.map((s, i) => {
          const state = i < stageIdx ? 'done' : i === stageIdx ? 'now' : 'todo';
          return (
            <div key={s.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 0', borderBottom: i < STAGES.length - 1 ? '1px solid var(--line)' : 0 }}>
              {state === 'done' && <div style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--teal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="check" size={13} stroke={3} /></div>}
              {state === 'now' && <span className="wt-spinner" />}
              {state === 'todo' && <div style={{ width: 26, height: 26, borderRadius: 13, border: '1.5px solid var(--line)', flexShrink: 0 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15.5, fontWeight: 600, color: state === 'todo' ? 'var(--faint)' : 'var(--ink)' }}>{s.title}</span>
                <span style={{ fontSize: 13.5, color: state === 'todo' ? 'var(--faint)' : 'var(--mute)' }}>{s.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <p style={{ fontSize: 13.5, color: 'var(--faint)', margin: 0, textAlign: 'center', lineHeight: 1.45 }}>About 30 seconds a reel. You can leave — we'll tell you when it's done.</p>
        <Button variant="secondary" onClick={() => onNavigate('home', { refresh: true })}>Continue in background</Button>
      </div>
      <span hidden>{tick}</span>
    </div>
  );
}
