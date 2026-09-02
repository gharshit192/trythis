import Icon from './Icon';

export default function Button({ children, variant = 'primary', onDark, small, icon, disabled, onClick, type = 'button', style }) {
  const cls = ['wt-btn', variant !== 'primary' && variant, onDark && 'on-dark', small && 'sm', icon && !children && 'icon']
    .filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} style={style}>
      {icon && <Icon name={icon} size={17} stroke={2} />}
      {children}
    </button>
  );
}
