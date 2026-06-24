import { useEffect, useRef, useState } from 'react';
import api from '../api';

// Top-level mode picker → sub-flows
export default function AddSave({ onNavigate }) {
  const [mode, setMode] = useState(null); // null | 'link' | 'photos'
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    api.getCollections()
      .then((res) => { if (res.status === 'success') setCollections(res.data); })
      .catch((err) => console.error('Failed to fetch collections:', err));
  }, []);

  return (
    <div className="phone-frame">
      <div style={{ background: 'rgba(14,14,12,0.45)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ background: 'var(--paper)', borderRadius: '24px 24px 0 0', padding: '16px 20px 32px' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--hairline)', borderRadius: '2px', margin: '0 auto 18px' }}></div>

          {mode === null && <ModePicker onPick={setMode} onCancel={() => onNavigate('home')} />}
          {mode === 'link' && <LinkFlow collections={collections} onBack={() => setMode(null)} onNavigate={onNavigate} />}
          {mode === 'photos' && <PhotosFlow collections={collections} onBack={() => setMode(null)} onNavigate={onNavigate} />}
        </div>
      </div>
    </div>
  );
}

// ── Mode picker ───────────────────────────────────────────────────────────────
function ModePicker({ onPick, onCancel }) {
  return (
    <>
      <h2 className="display" style={{ fontSize: '21px', marginBottom: '4px' }}>Add a save</h2>
      <p style={{ fontSize: '14px', color: 'var(--slate)', marginBottom: '16px' }}>What are you saving?</p>

      <button onClick={() => onPick('link')} className="add-tile" style={tile}>
        <div style={tileIcon}>
          <i className="ti ti-link" style={{ fontSize: 21, color: 'var(--linen)' }}></i>
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <p style={{ fontSize: 16, fontWeight: 500 }}>Paste a link</p>
          <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 2 }}>Instagram, YouTube, TikTok, web</p>
        </div>
        <i className="ti ti-chevron-right" style={{ fontSize: 17, color: 'var(--mute)' }}></i>
      </button>

      <button onClick={() => onPick('photos')} className="add-tile" style={{ ...tile, marginTop: 8 }}>
        <div style={{ ...tileIcon, background: 'var(--paper)', border: '0.5px solid var(--hairline)' }}>
          <i className="ti ti-photo" style={{ fontSize: 21, color: 'var(--coral)' }}></i>
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <p style={{ fontSize: 16, fontWeight: 500 }}>Upload photos</p>
          <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 2 }}>Screenshots, recipe pics, menus — OCR + AI</p>
        </div>
        <i className="ti ti-chevron-right" style={{ fontSize: 17, color: 'var(--mute)' }}></i>
      </button>

      <button className="btn-secondary" style={{ marginTop: 20 }} onClick={onCancel}>Cancel</button>
    </>
  );
}

// ── Link flow (was the old AddSave) ───────────────────────────────────────────
function LinkFlow({ collections, onBack, onNavigate }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCollectionIds, setSelectedCollectionIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState(null);

  const toggleCollection = (id) =>
    setSelectedCollectionIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const PROCESSING_STEPS = [
    'Submitting your link...',
    'Submitted! Processing in background...',
  ];

  const handleSave = async () => {
    setError(null);
    if (!url.trim()) return setError('Paste a link to save.');

    setSaving(true);
    setProcessingStep(0);

    try {
      // Submit link for async processing
      const result = await api.submitLink(url.trim());

      // Show "submitted" state
      setProcessingStep(1);
      setTimeout(() => {
        setSaving(false);
        setUrl('');
        setProcessingStep(0);
        onNavigate('firstSaveSuccess', {
          jobId: result?.jobId || null,
          saveId: result?.saveIds?.[0] || result?.saveId || null,
          saveIds: result?.saveIds || [],
          batchCount: result?.count || result?.saveIds?.length || 0,
          isFirstSave: false,
          nextScreen: 'home',
        });
      }, 1200);
    } catch (err) {
      setSaving(false);
      setProcessingStep(0);
      setError(err.message || 'Save failed');
    }
  };

  const manualCollections = collections.filter((c) => !c.isAuto);

  return (
    <>
      {saving && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255,255,255,0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#E0F7EE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24
          }}>
            <span style={{ fontSize: 25 }}>
              {processingStep === 2 ? '✓' : '⟳'}
            </span>
          </div>
          <p style={{
            fontSize: 19,
            fontWeight: 500,
            textAlign: 'center',
            color: '#1A1A1A',
            margin: '0 0 8px',
            transition: 'opacity 0.3s'
          }}>
            {PROCESSING_STEPS[processingStep]}
          </p>
          <p style={{ fontSize: 14, color: '#888', textAlign: 'center' }}>
            {processingStep < 4 ? 'This takes just a few seconds' : 'Navigating...'}
          </p>
        </div>
      )}

      <FlowHeader title="Paste a link" onBack={onBack} />

      <p className="label">Link (Instagram, YouTube, any URL)</p>
      <input type="url" className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

      <p className="label">Title</p>
      <input type="text" className="input" placeholder="Optional if link supplied" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} disabled={saving} />

      <p className="label">Notes</p>
      <textarea className="input" placeholder="Why are you saving this?" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 80, marginBottom: 12, resize: 'vertical' }} disabled={saving} />

      <CollectionsPicker collections={manualCollections} selectedIds={selectedCollectionIds} onToggle={toggleCollection} disabled={saving} />

      {error && <p style={{ color: 'var(--error,#d33)', fontSize: 14, marginBottom: 8 }}>{error}</p>}
      <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save & Extract'}</button>
    </>
  );
}

// ── Photos flow ───────────────────────────────────────────────────────────────
function PhotosFlow({ collections, onBack, onNavigate }) {
  const MAX_BUNDLE_IMAGES = 3;
  const [files, setFiles] = useState([]); // [{ file, previewUrl }]
  const [photoMode, setPhotoMode] = useState('single');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const PROCESSING_STEPS = [
    {
      title: 'Uploading your photos',
      detail: 'Keeping the original quality so small handwriting stays readable.',
      icon: 'ti-cloud-upload',
    },
    {
      title: 'Reading every visible detail',
      detail: 'Extracting handwriting, labels, lists, numbers, and image context.',
      icon: 'ti-scan-eye',
    },
    {
      title: 'Building your summary document',
      detail: 'Organizing the messy notes into a clean summary, actions, and tags.',
      icon: 'ti-file-analytics',
    },
  ];

  useEffect(() => {
    return () => { files.forEach((f) => URL.revokeObjectURL(f.previewUrl)); };
  }, [files]);

  useEffect(() => {
    if (!uploading) return undefined;
    setElapsedSeconds(0);
    const tick = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        if (next >= 5) setProcessingStep(1);
        if (next >= 14) setProcessingStep(2);
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [uploading]);

  const addFiles = (incoming) => {
    setError(null);
    const next = [];
    for (const f of incoming) {
      if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) { setError(`${f.name}: unsupported type`); continue; }
      if (f.size > 10 * 1024 * 1024) { setError(`${f.name}: too large (max 10MB)`); continue; }
      next.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    setFiles((prev) => {
      const limit = photoMode === 'single' ? 1 : MAX_BUNDLE_IMAGES;
      const all = photoMode === 'single' ? next : [...prev, ...next];
      if (all.length > limit) setError(photoMode === 'single' ? 'Single image mode allows only 1 image.' : `You can summarize up to ${MAX_BUNDLE_IMAGES} images at once.`);
      const merged = all.slice(0, limit);
      prev.forEach((f) => {
        if (!merged.includes(f)) URL.revokeObjectURL(f.previewUrl);
      });
      return merged;
    });
  };

  const removeAt = (i) => setFiles((prev) => {
    URL.revokeObjectURL(prev[i].previewUrl);
    return prev.filter((_, idx) => idx !== i);
  });

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleUpload = async () => {
    if (!files.length) return setError('Pick at least one image.');

    setUploading(true);
    setProcessingStep(0);
    setElapsedSeconds(0);

    try {
      const fd = new FormData();
      files.forEach((x) => fd.append('files', x.file));
      if (title.trim()) fd.append('title', title.trim());
      if (notes.trim()) fd.append('notes', notes.trim());
      if (selectedCollectionId) fd.append('collectionId', selectedCollectionId);

      const result = await api.analyzeScreenshotBundle(fd);
      if (result?.status !== 'success') throw new Error(result?.error?.message || 'Analysis failed');

      setProcessingStep(2);
      const savedResult = await api.saveScreenshotBundle(result.sessionId, result.summary);
      const savedDoc = savedResult?.save || savedResult?.data || null;

      files.forEach((x) => URL.revokeObjectURL(x.previewUrl));
      setUploading(false);
      setFiles([]);
      setProcessingStep(0);
      setElapsedSeconds(0);
      onNavigate('screenshot-summary', {
        sessionId: result.sessionId,
        summary: result.summary,
        thumbnails: result.thumbnails || [],
        source: photoMode,
        saveId: savedDoc?._id || null,
        autoSaved: !!savedDoc?._id,
      });
    } catch (err) {
      setUploading(false);
      setProcessingStep(0);
      setElapsedSeconds(0);
      setError(err.message || 'Upload failed');
    }
  };


  const manualCollections = collections.filter((c) => !c.isAuto);

  return (
    <>
      {uploading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(250,247,240,0.97)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: 22,
        }}>
          <div style={{
            width: 'min(360px, 100%)',
            background: 'var(--paper)',
            border: '1px solid var(--hairline)',
            borderRadius: 18,
            padding: 20,
            boxShadow: '0 22px 60px rgba(35, 31, 26, 0.16)',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'var(--coral-faint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--coral)',
                flexShrink: 0,
              }}>
                <i className={`ti ${PROCESSING_STEPS[processingStep].icon}`} style={{ fontSize: 27 }}></i>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: 'var(--slate)', margin: '0 0 3px' }}>
                  {files.length} image{files.length === 1 ? '' : 's'} · {elapsedSeconds}s elapsed
                </p>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>
                  {PROCESSING_STEPS[processingStep].title}
                </p>
              </div>
            </div>

            <div style={{ height: 8, background: 'var(--linen)', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{
                width: `${Math.min(92, 18 + elapsedSeconds * 3 + processingStep * 18)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--coral), #E7A36D)',
                borderRadius: 999,
                transition: 'width 0.45s ease',
              }} />
            </div>

            <p style={{ fontSize: 13, color: 'var(--slate)', lineHeight: 1.45, margin: '0 0 14px' }}>
              {PROCESSING_STEPS[processingStep].detail}
            </p>

            <div style={{ display: 'grid', gap: 8 }}>
              {PROCESSING_STEPS.map((step, i) => {
                const done = i < processingStep;
                const active = i === processingStep;
                return (
                  <div key={step.title} style={{ display: 'flex', alignItems: 'center', gap: 8, color: done || active ? 'var(--ink)' : 'var(--slate)' }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `1px solid ${done || active ? 'var(--coral)' : 'var(--hairline)'}`,
                      background: done ? 'var(--coral)' : active ? 'var(--coral-faint)' : 'transparent',
                      color: done ? '#fff' : 'var(--coral)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                    }}>
                      {done ? <i className="ti ti-check" /> : active ? <i className="ti ti-loader-2" /> : i + 1}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{step.title}</span>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 12, color: 'var(--slate)', textAlign: 'center', margin: '16px 0 0' }}>
              Usually takes 15-30 seconds. Keep this screen open.
            </p>
          </div>
        </div>
      )}

      <FlowHeader title="Upload photos" onBack={onBack} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { id: 'single', label: 'Single image', hint: 'One focused summary' },
          { id: 'multiple', label: 'Multiple images', hint: 'One combined document' },
        ].map((m) => {
          const active = photoMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setPhotoMode(m.id);
                setFiles((prev) => { prev.forEach((f) => URL.revokeObjectURL(f.previewUrl)); return []; });
              }}
              disabled={uploading}
              style={{ textAlign: 'left', padding: '10px 11px', borderRadius: 10, border: active ? '1px solid var(--coral)' : '1px solid var(--hairline)', background: active ? 'var(--coral-faint)' : 'var(--paper)', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{m.label}</div>
              <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>{m.hint}</div>
            </button>
          );
        })}
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `1px dashed ${dragging ? 'var(--coral)' : 'var(--sand)'}`,
          background: dragging ? 'var(--coral-faint)' : 'var(--paper)',
          borderRadius: 12, padding: '24px 14px', textAlign: 'center', cursor: 'pointer', marginBottom: 12,
        }}
      >
        <i className="ti ti-upload" style={{ fontSize: 25, color: 'var(--coral)' }}></i>
        <p style={{ fontSize: 14, marginTop: 6 }}>{files.length === 0 ? (photoMode === 'single' ? 'Click or drop one image here' : `Click or drop up to ${MAX_BUNDLE_IMAGES} images here`) : `${files.length} image${files.length === 1 ? '' : 's'} selected${photoMode === 'multiple' && files.length < MAX_BUNDLE_IMAGES ? ' - add more' : ''}`}</p>
        <p style={{ fontSize: 12, color: 'var(--slate)', marginTop: 4 }}>PNG, JPG or WebP · 10 MB each · max 3 images</p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple={photoMode === 'multiple'} style={{ display: 'none' }} onChange={(e) => addFiles(Array.from(e.target.files || []))} disabled={uploading} />
      </div>

      {files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
          {files.map((f, i) => (
            <div key={f.previewUrl} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--hairline)', background: 'var(--linen)', padding: 4 }}>
              <img src={f.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff', borderRadius: 5 }} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                disabled={uploading}
                style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 15, cursor: 'pointer', fontWeight: 'bold' }}
              >×</button>
              <span style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 3, fontWeight: 500 }}>{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      <p className="label">Title <span style={{ color: 'var(--slate)', fontWeight: 400 }}>(optional)</span></p>
      <input type="text" className="input" placeholder="Auto-derived if blank" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} disabled={uploading} />

      <p className="label">Notes <span style={{ color: 'var(--slate)', fontWeight: 400 }}>(optional)</span></p>
      <textarea className="input" placeholder="Why are you saving these?" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 60, marginBottom: 12, resize: 'vertical' }} disabled={uploading} />

      {manualCollections.length > 0 && (
        <>
          <p className="label">Add to collection <span style={{ color: 'var(--slate)', fontWeight: 400 }}>(optional)</span></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {manualCollections.map((c) => {
              const selected = selectedCollectionId === c._id;
              return (
                <button key={c._id} type="button" onClick={() => setSelectedCollectionId(selected ? null : c._id)} disabled={uploading}
                  style={{
                    background: selected ? 'var(--coral)' : 'var(--linen)',
                    color: selected ? 'var(--linen)' : 'var(--coral)',
                    border: '0.5px solid var(--hairline)', borderRadius: 16, fontSize: 13, padding: '5px 11px', cursor: 'pointer',
                  }}>{c.icon ? `${c.icon} ` : ''}{c.name}</button>
              );
            })}
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>📅 Original images auto-purge after 2 working days. Thumbnails kept forever.</p>

      {error && <p style={{ color: 'var(--error,#d33)', fontSize: 14, marginBottom: 8 }}>{error}</p>}
      <button className="btn-primary" disabled={uploading || files.length === 0} onClick={handleUpload}>
        {uploading ? 'Analyzing...' : `Summarize${files.length ? ` (${files.length})` : ''}`}
      </button>
    </>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────
function FlowHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
      <button type="button" onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, marginRight: 8 }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 19 }}></i>
      </button>
      <h2 className="display" style={{ fontSize: 19 }}>{title}</h2>
    </div>
  );
}

function CollectionsPicker({ collections, selectedIds, onToggle, disabled }) {
  if (!collections.length) return null;
  return (
    <>
      <p className="label">Collections <span style={{ color: 'var(--slate)', fontWeight: 400 }}>(optional)</span></p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {collections.map((c) => {
          const selected = selectedIds.includes(c._id);
          return (
            <button key={c._id} type="button" onClick={() => onToggle(c._id)} disabled={disabled}
              style={{
                background: selected ? 'var(--coral)' : 'var(--linen)',
                color: selected ? 'var(--linen)' : 'var(--coral)',
                border: '0.5px solid var(--hairline)', borderRadius: 16, fontSize: 13, padding: '5px 11px', cursor: 'pointer',
              }}>{c.icon ? `${c.icon} ` : ''}{c.name}</button>
          );
        })}
      </div>
    </>
  );
}

// inline styles for the mode-picker tiles
const tile = {
  background: 'var(--linen)', borderRadius: 14, padding: 14, display: 'flex',
  alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%',
  border: 'none', textAlign: 'left',
};
const tileIcon = {
  width: 40, height: 40, borderRadius: 10, background: 'var(--coral)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
