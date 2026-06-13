import { useState, useEffect } from 'react';
import api from '../api';

const CATEGORY_META = {
  travel:     { bg: 'linear-gradient(135deg,#2d5c45,#1b3a2f)', icon: 'ti-map-2' },
  food:       { bg: 'linear-gradient(135deg,#9a3c14,#7a2e0e)', icon: 'ti-tools-kitchen-2' },
  experience: { bg: 'linear-gradient(135deg,#7a1f4a,#5a1535)', icon: 'ti-ticket' },
  shopping:   { bg: 'linear-gradient(135deg,#9a6800,#7a5200)', icon: 'ti-shopping-bag' },
};

const REMINDER_HINT = {
  travel:  "We'll remind you before the next long weekend",
  food:    "We'll remind you when you're nearby",
  recipe:  "We'll remind you next time you're home on a weekday evening",
};

const getCategoryEmoji = (cat) => {
  if (!cat) return '📌';
  if (cat === 'travel') return '🏖';
  if (cat === 'food' || cat === 'cafes' || cat === 'restaurants') return '☕';
  if (cat === 'shopping') return '🛍';
  return '📌';
};

const catMeta = (cat) => CATEGORY_META[cat] || { bg: 'linear-gradient(135deg,#4a3db0,#2d1f8a)', icon: 'ti-bookmark' };

// Pre-auth dark intro carousel (matches mockup S1)
const INTRO_SLIDES = [
  { emoji: ['📱', '🔖'], head: 'See it on Instagram', sub: 'Scroll past something you love? Save it in one tap.' },
  { emoji: ['🤖', '✨'], head: 'AI figures it out', sub: 'We read the reel and pull out the place, recipe, or product — no typing needed.' },
  { emoji: ['🔔', '📍'], head: 'Get reminded at the right time', sub: "Nearby a saved spot, or a free weekend coming up — we'll nudge you." },
];

function ProgressDots({ active }) {
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 'auto', paddingBottom: 16 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: i === active ? 16 : 6,
          height: 6,
          borderRadius: i === active ? 3 : '50%',
          background: i === active ? 'var(--coral)' : 'var(--hairline)',
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  );
}

export default function Onboarding({ onNavigate }) {
  const isAuthed = !!localStorage.getItem('auth_token');
  const [step, setStep] = useState(isAuthed ? 1 : 0);
  const [slide, setSlide] = useState(0);
  const [savedItem, setSavedItem] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [copyingId, setCopyingId] = useState(null);

  useEffect(() => {
    if (step === 2) {
      api.getTemplateSaves().then(res => {
        if (res.status === 'success') setTemplates(res.data.slice(0, 2));
      }).catch(() => {});
    }
  }, [step]);

  const handleLinkSave = async () => {
    if (!linkUrl.trim()) return;
    setLinkLoading(true);
    setLinkError('');
    try {
      const res = await api.createSave({ url: linkUrl.trim() });
      if (res.status === 'success') {
        setSavedItem(res.data);
      } else if (res.error?.message?.toLowerCase().includes('unauthorized')) {
        onNavigate('signup');
      } else {
        setLinkError(res.error?.message || 'Failed to save link');
      }
    } catch {
      setLinkError('Connection error. Please try again.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleTemplateCopy = async (template) => {
    if (copyingId) return;
    setCopyingId(template._id);
    try {
      const res = await api.copyTemplateSave(template._id);
      if (res.status === 'success') {
        setSavedItem(res.data);
      } else if (res.error?.message?.toLowerCase().includes('unauthorized')) {
        onNavigate('signup');
      }
    } catch {}
    setCopyingId(null);
  };

  const handleComplete = async () => {
    try {
      await api.updateOnboarding({ completed: true, firstSaveAt: new Date().toISOString() });
    } catch {}
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        u.onboarding = { ...(u.onboarding || {}), completed: true };
        localStorage.setItem('user', JSON.stringify(u));
      }
    } catch {}
    onNavigate('home');
  };

  // ── Confirmation screen ──────────────────────────────────────────────────────
  if (savedItem) {
    const cat = savedItem.category || 'other';
    const meta = catMeta(cat);
    const hint = REMINDER_HINT[cat] || "We'll surface this at the right moment";
    const sd = savedItem.aiAnalysis?.structuredData;
    const location = sd?.itinerary?.destination || sd?.place?.city || null;
    const duration = sd?.itinerary?.duration || null;

    return (
      <div style={{ padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--linen)', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, background: 'var(--coral-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
            <i className="ti ti-check" style={{ color: 'var(--coral)', fontSize: 21 }} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>Saved!</div>
          <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 3 }}>Here's what we extracted</div>
        </div>

        <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: 80, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`ti ${meta.icon}`} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }} />
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--coral-soft)', color: 'var(--coral)', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
              {(location || duration) && (
                <span style={{ fontSize: 11, color: 'var(--mute)' }}>
                  {[location, duration].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{savedItem.title}</div>
            <div style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {savedItem.aiAnalysis?.summary || savedItem.description || ''}
            </div>
            <div style={{ background: 'var(--coral)', color: '#fff', fontSize: 11, borderRadius: 8, padding: '6px 8px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-sparkles" style={{ fontSize: 12 }} />
              {hint}
            </div>
          </div>
        </div>

        <button
          onClick={handleComplete}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 6 }}
        >
          Go to my saves
        </button>
        <button
          onClick={() => { setSavedItem(null); setStep(2); }}
          style={{ width: '100%', padding: '9px 14px', borderRadius: 10, background: 'none', border: '0.5px solid var(--hairline)', fontSize: 13, fontWeight: 500, color: 'var(--slate)', cursor: 'pointer' }}
        >
          Save another
        </button>
      </div>
    );
  }

  // ── Pre-auth: dark intro carousel (mockup S1) ────────────────────────────────
  if (!isAuthed) {
    const isLast = slide === INTRO_SLIDES.length - 1;
    const s = INTRO_SLIDES[slide];
    return (
      <div className="ob-screen">
        {!isLast && (
          <button className="ob-skip" onClick={() => setSlide(INTRO_SLIDES.length - 1)}>Skip</button>
        )}
        <div className="ob-emo">{s.emoji[0]}<br />{s.emoji[1]}</div>
        <div className="ob-head">{s.head}</div>
        <div className="ob-sub">{s.sub}</div>
        <div className="ob-dots">
          {INTRO_SLIDES.map((_, i) => (
            <div key={i} className={`ob-dot ${i === slide ? 'ob-dot-a' : ''}`} />
          ))}
        </div>
        {isLast ? (
          <>
            <button className="ob-btn" onClick={() => onNavigate('signup')}>Get started</button>
            <button className="ob-btn-outline" onClick={() => onNavigate('login')}>I already have an account</button>
          </>
        ) : (
          <button className="ob-btn" onClick={() => setSlide(slide + 1)}>Next →</button>
        )}
      </div>
    );
  }

  // ── Step 1: How it works ─────────────────────────────────────────────────────
  if (step === 1) {
    const howSteps = [
      {
        title: 'Save anything',
        sub: 'Share a reel, link or screenshot. AI extracts the details automatically.',
      },
      {
        title: 'Get reminded',
        sub: "Smart alerts when you're nearby, it's the right season, or you almost forgot.",
      },
      {
        title: 'Actually do it',
        sub: 'One tap to maps, booking, or recipe mode. No more saving and forgetting.',
      },
    ];
    return (
      <div style={{ padding: '20px 14px 16px', display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--linen)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
          Here's how it works
        </div>
        <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 16 }}>3 simple steps</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {howSteps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 1.5 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setStep(2)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 16 }}
        >
          Sounds good
        </button>
        <ProgressDots active={1} />
      </div>
    );
  }

  // ── Step 2: First save ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 14px 16px', display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--linen)', overflowY: 'auto' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
        Try a quick example
      </div>
      <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 14 }}>See how Wanna Try works in one tap</div>

      {/* Template saves */}
      {templates.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(t => (
            <div
              key={t._id}
              onClick={() => handleTemplateCopy(t)}
              style={{
                background: 'var(--paper)',
                border: '0.5px solid var(--hairline)',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: copyingId ? 'wait' : 'pointer',
              }}
            >
              <span style={{ fontSize: 19, flexShrink: 0 }}>{getCategoryEmoji(t.category)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                  {t.category ? t.category.charAt(0).toUpperCase() + t.category.slice(1) : 'Save'} · Sample save
                </div>
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--coral-soft)',
                color: 'var(--coral)',
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 20,
                minWidth: 36,
                flexShrink: 0,
                opacity: copyingId === t._id ? 0.6 : 1,
              }}>
                {copyingId === t._id ? '…' : 'Try'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', fontSize: 13 }}>
          Loading examples…
        </div>
      )}

      <button
        onClick={handleComplete}
        style={{
          width: '100%',
          padding: '9px 14px',
          borderRadius: 10,
          background: 'none',
          border: 'none',
          fontSize: 13,
          color: 'var(--mute)',
          cursor: 'pointer',
          marginTop: 'auto',
          paddingTop: 16,
        }}
      >
        Skip for now
      </button>

      <ProgressDots active={2} />
    </div>
  );
}
