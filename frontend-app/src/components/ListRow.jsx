import CategoryTile from './CategoryTile';

// The one list element: tile · title · meta · reason? · trailing. No thumbnails.
export default function ListRow({ category, title, meta, reason, trail, trailIcon, onClick, alignTop, tile }) {
  return (
    <button type="button" className={`wt-row${alignTop ? ' top' : ''}`} onClick={onClick}>
      {tile !== undefined ? tile : <CategoryTile category={category} />}
      <div className="wt-row-body">
        <span className="wt-row-title">{title}</span>
        {meta && <span className="wt-row-meta">{meta}</span>}
        {reason && <span className="wt-row-reason">{reason}</span>}
      </div>
      {(trail || trailIcon) && (
        <div className="wt-row-trail">
          {trail && <span>{trail}</span>}
          {trailIcon}
        </div>
      )}
    </button>
  );
}
