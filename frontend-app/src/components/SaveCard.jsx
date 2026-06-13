import { getCategoryMeta } from '../categoryMeta';
import SmartImage from './SmartImage';

const isVideoSave = (save) =>
  save.contentType === 'video' || save.source === 'instagram' || save.source === 'youtube';

// 2-col grid card: gradient/image header (+ play badge for video saves), title, category chip.
export default function SaveCard({ save, onNavigate }) {
  const meta = getCategoryMeta(save.category);
  const showPlay = isVideoSave(save);

  return (
    <div className="save-card" onClick={() => onNavigate('save-detail', { id: save._id })}>
      <div className={`save-card-img ${save.thumbnail ? '' : meta.gradientClass}`}>
        {save.thumbnail && (
          <SmartImage
            saveId={save._id}
            src={save.thumbnail}
            alt={save.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {showPlay && <div className="save-card-play">▶</div>}
        <div className="stamp stamp-tr">{meta.emoji}</div>
      </div>
      <div className="save-card-body">
        <div className="save-card-name">{save.title}</div>
        <span className={`chip ${meta.chipClass}`}>{meta.emoji} {meta.shortLabel}</span>
      </div>
    </div>
  );
}
