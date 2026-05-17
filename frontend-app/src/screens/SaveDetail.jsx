import { useEffect, useState } from 'react';
import api from '../api';
import SmartImage from '../components/SmartImage';

export default function SaveDetail({ onNavigate, payload }) {
  const id = payload?.id;
  const [save, setSave] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const detail = await api.getSaveById(id);
        if (!active) return;
        if (detail.status !== 'success') throw new Error(detail.error?.message || 'Not found');
        setSave(detail.data);
        const r = await api.getRecommendations(id);
        if (active && r.status === 'success') setRecs(r.data || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this save?')) return;
    const res = await api.deleteSave(id);
    if (res.status === 'success') onNavigate('home');
    else alert(res.error?.message || 'Delete failed');
  };

  if (!id) {
    return (
      <div className="phone-frame">
        <div style={{ background: 'var(--paper)', flex: 1, padding: 20 }}>
          <p>No save selected.</p>
          <button className="btn-primary" onClick={() => onNavigate('home')}>Back</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="phone-frame"><div style={{ padding: 32, textAlign: 'center' }}>Loading…</div></div>;
  if (error) return <div className="phone-frame"><div style={{ padding: 32, color: 'var(--error,#d33)' }}>{error}</div></div>;

  const meta = save?.metadata || {};

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => onNavigate('home')}></i>
          <h1 className="display" style={{ fontSize: '18px' }}>Save Details</h1>
          <i className="ti ti-trash" style={{ fontSize: '20px', cursor: 'pointer', color: 'var(--error,#d33)' }} onClick={handleDelete}></i>
        </div>
        <div style={{ borderRadius: '12px', marginBottom: '16px', overflow: 'hidden', background: '#000' }}>
          {save?.videoUrl ? (
            <video
              src={save.videoUrl}
              poster={save.thumbnail || save.image}
              controls
              playsInline
              style={{ width: '100%', maxHeight: 420, display: 'block' }}
            />
          ) : (save?.thumbnail || save?.image) ? (
            <SmartImage saveId={save._id} src={save.thumbnail || save.image} alt={save.title} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
          ) : (
            <div style={{ height: 180 }} />
          )}
        </div>

        {save?.processingStatus && save.processingStatus !== 'done' && (
          <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 12 }}>
            ⏳ Processing: {save.processingStatus}…
          </div>
        )}

        {save?.aiAnalysis?.structuredData?.recipe?.isRecipe && (() => {
          const r = save.aiAnalysis.structuredData.recipe;
          return (
          <div style={{ background: 'var(--linen)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <p className="display" style={{ fontSize: 16, marginBottom: 6 }}>🍳 {r.title || 'Recipe'}</p>
            {r.cookingTime && <p style={{ fontSize: 12, color: 'var(--slate)' }}>⏱ {r.cookingTime}{r.servings ? ` · 🍽 ${r.servings}` : ''}{r.cuisine ? ` · ${r.cuisine}` : ''}</p>}
            {r.ingredients?.length > 0 && (
              <>
                <p style={{ fontSize: 13, fontWeight: 500, marginTop: 10 }}>Ingredients</p>
                <ul style={{ paddingLeft: 18, margin: '4px 0', fontSize: 13 }}>
                  {r.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
              </>
            )}
            {r.steps?.length > 0 && (
              <>
                <p style={{ fontSize: 13, fontWeight: 500, marginTop: 10 }}>Steps</p>
                <ol style={{ paddingLeft: 18, margin: '4px 0', fontSize: 13 }}>
                  {r.steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                </ol>
              </>
            )}
          </div>
          );
        })()}

        {save?.aiAnalysis?.structuredData?.itinerary && (() => {
          const it = save.aiAnalysis.structuredData.itinerary;
          return (
          <div style={{ background: 'var(--linen)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <p className="display" style={{ fontSize: 16, marginBottom: 6 }}>🗺 {it.destination || 'Trip'}</p>
            {it.bestSeason && <p style={{ fontSize: 12, color: 'var(--slate)' }}>Best season: {it.bestSeason}</p>}
            {it.highlights?.length > 0 && (
              <ul style={{ paddingLeft: 18, marginTop: 8, fontSize: 13 }}>
                {it.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            )}
          </div>
          );
        })()}

        {save?.aiAnalysis?.structuredData?.product && (() => {
          const p = save.aiAnalysis.structuredData.product;
          return (
          <div style={{ background: 'var(--linen)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <p className="display" style={{ fontSize: 16, marginBottom: 6 }}>🛍 {p.name || 'Product'}</p>
            {p.brand && <p style={{ fontSize: 12, color: 'var(--slate)' }}>{p.brand}</p>}
            {p.price && <p style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{p.currency || ''} {p.price}</p>}
            {p.buyUrl && <a href={p.buyUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--forest)', fontSize: 13 }}>Buy →</a>}
          </div>
          );
        })()}

        {save?.aiAnalysis?.structuredData?.event && (() => {
          const e = save.aiAnalysis.structuredData.event;
          return (
          <div style={{ background: 'var(--linen)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <p className="display" style={{ fontSize: 16, marginBottom: 6 }}>🎫 {e.eventName || 'Event'}</p>
            {e.venue && <p style={{ fontSize: 12, color: 'var(--slate)' }}>{e.venue}</p>}
            {e.eventDate && <p style={{ fontSize: 12 }}>{new Date(e.eventDate).toLocaleString()}</p>}
            {e.price && <p style={{ fontSize: 14, fontWeight: 500 }}>{e.currency || ''} {e.price}</p>}
          </div>
          );
        })()}

        {save?.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {save.tags.map((t, i) => <span key={i} className="tag tag-neutral">{t}</span>)}
          </div>
        )}

        {save?.aiAnalysis?.summary && (
          <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 12, fontStyle: 'italic' }}>{save.aiAnalysis.summary}</p>
        )}

        {save?.aiAnalysis?.transcription?.translation && (
          <details style={{ marginBottom: 12, fontSize: 13 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--slate)' }}>📝 Transcript (English)</summary>
            <p style={{ padding: 10, background: 'var(--linen)', borderRadius: 8, marginTop: 6, lineHeight: 1.5 }}>{save.aiAnalysis.transcription.translation}</p>
          </details>
        )}
        {save?.aiAnalysis?.transcription?.text && save?.aiAnalysis?.transcription?.detectedLanguage && save.aiAnalysis.transcription.detectedLanguage !== 'en' && (
          <details style={{ marginBottom: 12, fontSize: 13 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--slate)' }}>📝 Transcript ({save.aiAnalysis.transcription.detectedLanguage})</summary>
            <p style={{ padding: 10, background: 'var(--linen)', borderRadius: 8, marginTop: 6, lineHeight: 1.5 }}>{save.aiAnalysis.transcription.text}</p>
          </details>
        )}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {save?.category && <span className="tag tag-forest">{save.category.toUpperCase()}</span>}
            {meta.location && <span className="tag tag-neutral">{meta.location.toUpperCase()}</span>}
          </div>
          <h2 className="display" style={{ fontSize: '20px', marginBottom: '8px' }}>{save?.title}</h2>
          {save?.description && (
            <p style={{ fontSize: '14px', color: 'var(--slate)', lineHeight: '1.5' }}>{save.description}</p>
          )}
          {meta.price && <p style={{ marginTop: 8, fontWeight: 500 }}>💰 {meta.price}</p>}
        </div>
        <div style={{ background: 'var(--forest-faint)', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--forest)', fontWeight: '500' }}>Saved from {save?.source}</p>
          <p style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px' }}>{save?.engagement?.views || 0} views</p>
        </div>
        {recs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: 8 }}>Similar saves</p>
            {recs.slice(0, 3).map((r) => (
              <div key={r._id} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--hairline)', cursor: 'pointer' }} onClick={() => onNavigate('save-detail', { id: r._id })}>
                <p style={{ fontSize: 13 }}>{r.title}</p>
                <p style={{ fontSize: 11, color: 'var(--slate)' }}>score {(r.score || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
        {save?.url && (
          <button className="btn-secondary" style={{ marginBottom: 8 }} onClick={() => window.open(save.url, '_blank')}>Open source</button>
        )}
        <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => onNavigate('home')}>Back</button>
      </div>
    </div>
  );
}
