import { useState } from 'react'
import POSLogin from '../components/pos/POSLogin'
import POSApp from '../components/pos/POSApp'

export default function TradrDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [posUnlocked, setPosUnlocked] = useState(
    sessionStorage.getItem('pos_unlocked') === 'true'
  )

  const tabs = [
    { id: 'overview', label: 'Dashboard', icon: '◼' },
    { id: 'products', label: 'Products', icon: '▦' },
    { id: 'appearance', label: 'Appearance', icon: '◐' },
    { id: 'settings', label: 'Settings', icon: '⊙' },
    { id: 'link', label: 'My Store Link', icon: '⊞' },
    { id: 'account', label: 'Account', icon: '◯' },
    { id: 'pos', label: 'POS System', icon: '🛒' },
  ]

  // If on POS tab, show POS with its own login gate
  if (activeTab === 'pos') {
    if (!posUnlocked) {
      return (
        <div>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            background: '#0D1526', borderBottom: '1px solid rgba(255,255,255,0.05)',
            padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem'
          }}>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                background: 'none', border: 'none', color: '#94A3B8',
                fontFamily: 'Open Sans, sans-serif', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              ← Back to Dashboard
            </button>
          </div>
          <div style={{ paddingTop: '60px' }}>
            <POSLogin onSuccess={() => setPosUnlocked(true)} />
          </div>
        </div>
      )
    }
    return <POSApp onLock={() => { setPosUnlocked(false); setActiveTab('overview') }} />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0F172A', fontFamily: 'Open Sans, sans-serif', color: '#fff' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px', background: '#0D1526', borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh'
      }}>
        <div style={{ padding: '1.3rem 1.1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '30px', height: '30px', background: '#2563EB', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>T</div>
          <span style={{ fontWeight: 800, fontSize: '17px' }}>Tradr</span>
        </div>
        <nav style={{ padding: '0.6rem 0', flex: 1 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 1.1rem',
                color: activeTab === tab.id ? '#fff' : '#94A3B8',
                background: activeTab === tab.id ? 'rgba(37,99,235,0.12)' : 'none',
                borderLeft: activeTab === tab.id ? '3px solid #2563EB' : '3px solid transparent',
                border: 'none', borderRight: 'none', width: '100%', fontFamily: 'Open Sans, sans-serif',
                fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                ...(tab.id === 'pos' ? { marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' } : {})
              }}
            >
              <span>{tab.icon}</span> {tab.label}
              {tab.id === 'pos' && (
                <span style={{
                  marginLeft: 'auto', background: '#F59E0B', color: '#0F172A',
                  fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '50px'
                }}>NEW</span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '0.5rem 0' }}>
          <a href="/store" target="_blank" style={{
            display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 1.1rem',
            color: '#94A3B8', textDecoration: 'none', fontSize: '0.85rem'
          }}>▷ View My Store</a>
          <a href="/login" style={{
            display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 1.1rem',
            color: '#94A3B8', textDecoration: 'none', fontSize: '0.85rem'
          }}>← Log Out</a>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: '220px', flex: 1, padding: '1.8rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          {tabs.find(t => t.id === activeTab)?.label}
        </div>
        {activeTab === 'overview' && <div style={{ color: '#94A3B8' }}>Overview content goes here</div>}
        {activeTab === 'products' && <div style={{ color: '#94A3B8' }}>Products tab goes here</div>}
        {activeTab === 'settings' && (
          <div>
            <div style={{ background: '#1E293B', borderRadius: '12px', padding: '1.5rem', maxWidth: '500px', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '1rem' }}>POS PIN</div>
              <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '1rem' }}>
                Set the PIN your staff use to access the POS system. Keep it separate from your Tradr login password.
              </p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Set new POS PIN"
                id="posPin"
                style={{
                  width: '100%', background: '#0F172A', border: '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '10px 12px', color: '#fff',
                  fontFamily: 'Open Sans, sans-serif', fontSize: '0.9rem', outline: 'none', marginBottom: '0.8rem'
                }}
              />
              <button
                onClick={() => {
                  const pin = document.getElementById('posPin').value
                  if (pin.length >= 4) {
                    localStorage.setItem('tradr_pos_pin', pin)
                    alert('POS PIN saved.')
                  } else {
                    alert('PIN must be at least 4 digits.')
                  }
                }}
                style={{
                  background: '#2563EB', color: '#fff', border: 'none', borderRadius: '7px',
                  padding: '9px 18px', fontFamily: 'Open Sans, sans-serif', fontWeight: 600,
                  fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                Save PIN
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}