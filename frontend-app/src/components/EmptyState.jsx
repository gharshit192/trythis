import Button from './Button';

// Title · one line · one action. Never an illustration-only screen.
export default function EmptyState({ title, text, action, onAction }) {
  return (
    <div className="wt-empty">
      <span className="t">{title}</span>
      {text && <span className="s">{text}</span>}
      {action && <div style={{ marginTop: 10, width: '100%', maxWidth: 260 }}><Button small onClick={onAction}>{action}</Button></div>}
    </div>
  );
}
