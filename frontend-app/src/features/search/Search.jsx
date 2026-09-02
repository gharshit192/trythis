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
    if (q.trim().length < 2) { setRemote(null); return; }
    timer.current = setTimeout(() => api.search(q.trim()).then((r) => setRemote(r?.status === 'success' ? (r.data?.saves || []) : null)).catch(() => {}), 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const needle = q.trim().toLowerCase();
  const local = needle ? saves.filter((s) => [s.title, s.aiAnalysis?.summary, ...(s.tags || []), s.extractedLocation?.city].filter(Boolean).join(' ').toLowerCase().includes(needle)) : saves;
  const merged = [...local, ...(remote || []).filter((r) => !local.some((l) => l._id === r._id))];
  const rows = merged.filter((s) => kind === 'all' || getCategoryTile(s.category).kind === kind).slice(0, 60);

  return (
    <div className="wt-screen has-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <SearchBar value={q} onChange={setQ} autoFocus placeholder={`Search ${saves.length} things you saved`} style={{ flex: 1 }} />
      </div>
      <div className="wt-chips" style={{ marginBottom: 6 }}>
        {KINDS.map(([id, label]) => <Chip key={id} small on={kind === id} onClick={() => setKind(id)}>{label}</Chip>)}
      </div>
      {rows.length === 0
        ? <EmptyState title={needle ? 'Nothing matches' : 'Nothing saved yet'} text={needle ? 'Try a place, a dish, a creator, or a word from the reel.' : 'Share a reel or paste a link to start.'} />
        : rows.map((s) => <ListRow key={s._id} category={s.category} title={s.title} meta={[getCategoryTile(s.category).label, s.extractedLocation?.city].filter(Boolean).join(' · ')} trail={relativeTime(s.createdAt)} onClick={() => onNavigate('save-detail', { id: s._id })} />)}
    </div>
  );
}
