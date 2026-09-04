import { Component } from 'react';

// The last line of defence against a white screen. Two cases:
// 1. A stale chunk — the app is running a build whose files were replaced by a
//    newer deploy, so the next lazily-loaded screen 404s. Reload once, which
//    picks up the new build; the user sees a flicker, not a blank page.
// 2. Any other render error: say so, offer Reload and Home. Never blank.
const isStaleChunk = (err) => /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Unexpected token '<'/i.test(String(err?.message || err || ''));

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    try { console.error('[wt] render error', error, info?.componentStack); } catch {}
    if (isStaleChunk(error)) {
      let last = 0; try { last = Number(sessionStorage.getItem('wt_chunk_reload') || 0); } catch {}
      if (Date.now() - last > 60000) { try { sessionStorage.setItem('wt_chunk_reload', String(Date.now())); } catch {} window.location.reload(); }
    }
  }
  render() {
    if (!this.state.error) return this.props.children;
    const stale = isStaleChunk(this.state.error);
    return (
      <div className="wt-screen" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: '0 0 8px' }}>{stale ? 'A new version is ready' : 'Something went wrong'}</p>
        <p className="wt-sub" style={{ marginBottom: 20 }}>{stale ? 'The app updated while you were using it. Reload to continue.' : 'Nothing was lost. Reload, or go back home.'}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button type="button" className="wt-btn sm" style={{ width: 'auto', padding: '0 18px' }} onClick={() => window.location.reload()}>Reload</button>
          <button type="button" className="wt-btn sm secondary" style={{ width: 'auto', padding: '0 18px' }} onClick={() => { window.location.href = '/'; }}>Home</button>
        </div>
      </div>
    );
  }
}
