import Icon from './Icon';

// Home · Explore · + · Saved · Me (ADR 0015). Explore's default chip is Nearby.
const TABS = [
  { key: 'home',    label: 'Home',    icon: 'home',     match: ['home', 'home-empty'] },
  { key: 'explore', label: 'Discover', icon: 'compass',  match: ['explore', 'nearby'] },
  null,
  { key: 'saved',   label: 'Wanna Try', icon: 'bookmark', match: ['saved', 'savedList', 'collections', 'collection-detail'] },
  { key: 'profile', label: 'Me',      icon: 'user',     match: ['profile'] },
];

export default function BottomNav({ currentScreen, onNavigate }) {
  return (
    <nav className="wt-tab-bar">
      {TABS.map((t, i) => t === null ? (
        <button key="fab" type="button" className="wt-fab" aria-label="Add" onClick={() => onNavigate('add-save')}>
          <Icon name="plus" size={24} stroke={2.4} />
        </button>
      ) : (
        <button key={t.key} type="button" className={`wt-tab${t.match.includes(currentScreen) ? ' is-on' : ''}`} onClick={() => onNavigate(t.key)}>
          <Icon name={t.icon} size={23} stroke={t.match.includes(currentScreen) ? 2 : 1.8}
                fill={t.key === 'saved' && t.match.includes(currentScreen) ? 'currentColor' : 'none'} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
