import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'

export default function POSLogin({ onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  // In production this PIN comes from the user's Tradr account settings
  // For now it is stored in localStorage set during Tradr dashboard settings
  const savedPin = localStorage.getItem('tradr_pos_pin') || '1234'

  function handleSubmit(e) {
    e.preventDefault()
    if (pin === savedPin) {
      sessionStorage.setItem('pos_unlocked', 'true')
      onSuccess()
    } else {
      setError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0F172A', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Open Sans, sans-serif'
    }}>
      <div style={{
        background: '#1E293B', border: '1px solid rgba(37,99,235,0.25)',
        borderRadius: '20px', padding: '2.5rem', width: '100%', maxWidth: '360px',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, #2563EB, #F59E0B)'
        }} />
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '52px', height: '52px', background: '#2563EB', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <ShoppingCart size={24} color="white" />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>POS System</div>
          <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '0.3rem' }}>
            Enter your POS PIN to continue
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter PIN"
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            autoFocus
            style={{
              width: '100%', background: '#0F172A', border: '1.5px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '12px', color: '#fff', fontFamily: 'Open Sans, sans-serif',
              fontSize: '1.2rem', outline: 'none', textAlign: 'center', letterSpacing: '8px',
              marginBottom: '0.8rem'
            }}
          />
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '7px', padding: '8px 12px', color: '#F87171',
              fontSize: '0.82rem', textAlign: 'center', marginBottom: '0.8rem'
            }}>
              {error}
            </div>
          )}
          <button type="submit" style={{
            width: '100%', background: '#F59E0B', color: '#0F172A', border: 'none',
            borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif',
            fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
          }}>
            Unlock POS
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.78rem', color: '#94A3B8' }}>
          Default PIN is 1234. Change it in your Tradr dashboard settings.
        </div>
      </div>
    </div>
  )
}