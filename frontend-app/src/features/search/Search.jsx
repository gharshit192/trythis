import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import ListRow from '../../components/ListRow';
import SearchBar from '../../components/SearchBar';
import Chip from '../../components/Chip';
import EmptyState from '../../components/EmptyState';
import { getCategoryTile } from '../../lib/categoryMeta';
import { relativeTime } from '../../lib/format';

// Search everything you saved. Local match first (instant), server search for
// the deeper text (transcripts, OCR) after a short pause.
const KINDS = [['all', 'All'], ['place', 'Places'], ['food', 'Food'], ['shop', 'Shopping'], ['learn', 'Watch & read']];

export default function Search({ onNavigate, onBack }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [saves, setSaves] = useState([]);
  const [remote, setRemote] = useState(null);
  const timer = useRef(null);

  useEffect(() => { api.getSaves().then((r) => r?.status === 'success' && setSaves(r.data || [])); }, []);
  useEffect(() => {
    clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) { setRemote(null); return; }
    timer.current = setTimeout(() => api.search(term)
      .then((r) => setRemote(r?.status === 'success' ? { q: term, saves: r.data?.saves || [], weak: !!r.data?.weak, searchId: r.data?.searchId } : null))
      .catch(() => {}), 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const needle = q.trim().toLowerCase();
  const local = needle ? saves.filter((s) => [s.title, s.aiAnalysis?.summary, ...(s.tags || []), s.extractedLocation?.city].filter(Boolean).join(' ').toLowerCase().includes(needle)) : saves;
  // The server ranks by relevance and reads what the local pass can't see —
  // transcripts, screenshot OCR, and Devanagari spellings of a Latin query. Once
  // it has answered *this* term, its order wins; local-only hits trail it.
  const fresh = remote && remote.q === q.trim() ? remote : null;
  const merged = fresh
    ? [...fresh.saves, ...local.filter((l) => !fresh.saves.some((r) => r._id === l._id))]
    : local;
  const rows = merged.filter((s) => kind === 'all' || getCategoryTile(s.category).kind === kind).slice(0, 60);
  const noExactMatch = !!fresh?.weak && local.length === 0;

  return (
    <div className="wt-screen has-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <SearchBar value={q} onChange={setQ} autoFocus placeholder={`Search ${saves.length} things you saved`} style={{ flex: 1 }} />
      </div>
      <div className="wt-chips" style={{ marginBottom: 6 }}>
        {KINDS.map(([id, label]) => <Chip key={id} small on={kind === id} onClick={() => setKind(id)}>{label}</Chip>)}
      </div>
      {needle.length >= 3 && (
        <button type="button" onClick={() => onNavigate('ask', { question: q.trim() })}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', margin: '6px 0 10px', padding: '11px 14px', borderRadius: 12, background: 'var(--teal-soft)', border: 0, color: 'var(--teal-d)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <Icon name="sparkle" size={18} />
          <span style={{ flex: 1, fontSize: 14.5 }}>Ask Wanna Try: <b>“{q.trim()}”</b></span>
          <Icon name="forward" size={16} />
        </button>
      )}
      {noExactMatch && rows.length > 0 && (
        <p style={{ margin: '2px 0 10px', fontSize: 13, color: 'var(--ink-3)' }}>
          Nothing exact for <b>“{q.trim()}”</b> — closest things you saved
        </p>
      )}
      {rows.length === 0
        ? <EmptyState title={needle ? 'Nothing matches' : 'Nothing saved yet'} text={needle ? 'Try a place, a dish, a creator, or a word from the reel.' : 'Share a reel or paste a link to start.'} />
        : rows.map((s, i) => <ListRow key={s._id} category={s.category} title={s.title} meta={[getCategoryTile(s.category).label, s.extractedLocation?.city].filter(Boolean).join(' · ')} trail={relativeTime(s.createdAt)} onClick={() => { api.logSearchTap(fresh?.searchId, s._id, i + 1); onNavigate('save-detail', { id: s._id }); }} />)}
    </div>
  );
}
