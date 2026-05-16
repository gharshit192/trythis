export default function AddSave({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'rgba(14,14,12,0.45)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ background: 'var(--paper)', borderRadius: '24px 24px 0 0', padding: '16px 20px 32px' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--hairline)', borderRadius: '2px', margin: '0 auto 18px' }}></div>

          <h2 className="display" style={{ fontSize: '20px', marginBottom: '4px' }}>Add a save</h2>
          <p style={{ fontSize: '13px', color: 'var(--slate)', marginBottom: '20px' }}>Paste it, snap it, or share from any app.</p>

          <div style={{ background: 'var(--linen)', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', cursor: 'pointer' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-link" style={{ color: 'var(--linen)', fontSize: '18px' }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: '500' }}>Paste a link</p>
              <p style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '2px' }}>Instagram, YouTube, or any URL</p>
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize: '16px', color: 'var(--mute)' }}></i>
          </div>

          <div style={{ background: 'var(--linen)', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', cursor: 'pointer' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--paper)', border: '0.5px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-photo" style={{ color: 'var(--forest)', fontSize: '18px' }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: '500' }}>Upload screenshots</p>
              <p style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '2px' }}>We'll categorize and summarize them</p>
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize: '16px', color: 'var(--mute)' }}></i>
          </div>

          <div style={{ background: 'var(--linen)', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', cursor: 'pointer' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--paper)', border: '0.5px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-camera" style={{ color: 'var(--forest)', fontSize: '18px' }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: '500' }}>Snap a photo</p>
              <p style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '2px' }}>Menu, signboard, anything</p>
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize: '16px', color: 'var(--mute)' }}></i>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px dashed var(--sand)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ti ti-clipboard" style={{ fontSize: '16px', color: 'var(--forest)' }}></i>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', color: 'var(--slate)' }}>We found a link on your clipboard</p>
              <p style={{ fontSize: '12px', color: 'var(--forest)', fontWeight: '500', marginTop: '2px' }}>instagram.com/reel/C8x…</p>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--forest)', fontWeight: '500', cursor: 'pointer' }}>Save</span>
          </div>

          <button className="btn-primary" style={{ marginTop: '20px' }} onClick={() => onNavigate('home')}>Done</button>
        </div>
      </div>
    </div>
  );
}
