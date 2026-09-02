import Icon from './Icon';
import { getCategoryTile } from '../lib/categoryMeta';

// 44px tile that encodes exactly one thing: the save's category (ADR 0013).
export default function CategoryTile({ category, size = 44 }) {
  const { kind, icon } = getCategoryTile(category);
  return (
    <div className={`wt-tile ${kind}`} style={size !== 44 ? { width: size, height: size } : undefined}>
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </div>
  );
}
