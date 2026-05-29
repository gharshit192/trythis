export default function BottomNav({ currentScreen, onNavigate }) {
  return (
    <div className="tab-bar">
      <div className={`tab ${currentScreen === 'home' || currentScreen === 'home-empty' ? 'active' : ''}`} onClick={() => onNavigate('home')}>
        <i className="ti ti-home tab-icon"></i>
        <span className="tab-label">Home</span>
      </div>
      <div className={`tab ${currentScreen === 'search' ? 'active' : ''}`} onClick={() => onNavigate('search')}>
        <i className="ti ti-search tab-icon"></i>
        <span className="tab-label">Search</span>
      </div>
      <div className="fab" onClick={() => onNavigate('add-save')}>
        <i className="ti ti-plus"></i>
      </div>
      <div className={`tab ${currentScreen === 'collections' ? 'active' : ''}`} onClick={() => onNavigate('collections')}>
        <i className="ti ti-folder tab-icon"></i>
        <span className="tab-label">Collections</span>
      </div>
      <div className={`tab ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => onNavigate('profile')}>
        <i className="ti ti-user tab-icon"></i>
        <span className="tab-label">Profile</span>
      </div>
    </div>
  );
}
