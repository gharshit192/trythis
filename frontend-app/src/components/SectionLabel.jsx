export default function SectionLabel({ children, action, onAction }) {
  return (
    <div className="wt-section-label">
      <span>{children}</span>
      {action && <span className="action" onClick={onAction}>{action}</span>}
    </div>
  );
}
