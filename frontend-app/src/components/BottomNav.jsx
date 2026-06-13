export default function BottomNav({ currentScreen, onNavigate }) {
  return (
    <div className="tab-bar">
      <div className={`tab ${currentScreen === 'home' || currentScreen === 'home-empty' ? 'active' : ''}`} onClick={() => onNavigate('home')}>
        <i className="ti ti-home tab-icon"></i>
        <span className="tab-label">Home</span>
      </div>
      <div className={`tab ${currentScreen === 'nearby' ? 'active' : ''}`} onClick={() => onNavigate('nearby')}>
        <i className="ti ti-map-pin tab-icon"></i>
        <span className="tab-label">Nearby</span>
      </div>
      <div className="fab" onClick={() => onNavigate('add-save')}>
        <i className="ti ti-plus"></i>
      </div>
      <div className={`tab ${currentScreen === 'collections' || currentScreen === 'saved-list' ? 'active' : ''}`} onClick={() => onNavigate('collections')}>
        <i className="ti ti-folder tab-icon"></i>
        <span className="tab-label">Saves</span>
      </div>
      <div className={`tab ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => onNavigate('profile')}>
        <i className="ti ti-user tab-icon"></i>
        <span className="tab-label">Me</span>
      </div>
    </div>
  );
}
