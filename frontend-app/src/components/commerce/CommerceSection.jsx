import SectionLabel from '../SectionLabel';

// A commercial zone (MONETIZATION_ARCHITECTURE.md): titled, capped, disclosed.
// Renders nothing when it has nothing — the product stays clean by default.
export default function CommerceSection({ title, children, count, disclosure = 'Affiliate links · prices from partners', action, onAction, style }) {
  if (!count) return null;
  return (
    <section style={{ marginBottom: 22, ...style }}>
      <SectionLabel action={action} onAction={onAction}>{title}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>{children}</div>
      <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '8px 0 0' }}>{disclosure}</p>
    </section>
  );
}
