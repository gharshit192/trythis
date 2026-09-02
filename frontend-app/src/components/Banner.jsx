import Icon from './Icon';

export default function Banner({ icon, label, children, warm, onClick, trailing }) {
  return (
    <div className={`wt-banner${warm ? ' warm' : ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {icon && <Icon name={icon} size={18} style={{ flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && <span className="label">{label}</span>}
        {children}
      </div>
      {trailing}
    </div>
  );
}
