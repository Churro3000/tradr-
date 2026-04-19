import { useState } from 'react'
import { ShoppingCart, Package, FileText, ClipboardList, TrendingUp, LayoutDashboard, Factory, Settings as SettingsIcon, LogOut } from 'lucide-react'
import Checkout from './Checkout'
import Inventory from './Inventory'
import Dashboard from './Dashboard'
import Sales from './Sales'
import Purchase from './Purchase'
import Quotation from './Quotation'
import Suppliers from './Suppliers'
import Settings from './Settings'
import '../../../src/pos.css'

export default function POSApp({ onLock }) {
  const [mode, setMode] = useState('checkout')
  const [editingInvoice, setEditingInvoice] = useState(null)

  function handleEditInvoice(purchase) {
    setEditingInvoice(purchase)
    setMode('purchase')
  }

  function handleLock() {
    sessionStorage.removeItem('pos_unlocked')
    onLock()
  }

  const tabs = [
    { id: 'checkout', label: 'Checkout', icon: <ShoppingCart size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'purchase', label: 'Purchase', icon: <FileText size={16} /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Factory size={16} /> },
    { id: 'quotation', label: 'Quotation', icon: <ClipboardList size={16} /> },
    { id: 'sales', label: 'Sales', icon: <TrendingUp size={16} /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
  ]

  return (
    <div className="app">
      <header>
        <div className="logo">
          <ShoppingCart size={22} />
          <h1>POS System</h1>
        </div>
        <nav className="mode-toggle">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={mode === tab.id ? 'active' : ''}
              onClick={() => { setMode(tab.id); if (tab.id !== 'purchase') setEditingInvoice(null) }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
          <button onClick={handleLock} style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>
            <LogOut size={16} />
            <span>Lock</span>
          </button>
        </nav>
      </header>
      <main>
        {mode === 'inventory' && <Inventory />}
        {mode === 'checkout' && <Checkout />}
        {mode === 'purchase' && <Purchase editingInvoice={editingInvoice} onClearEdit={() => setEditingInvoice(null)} />}
        {mode === 'suppliers' && <Suppliers onEditInvoice={handleEditInvoice} />}
        {mode === 'quotation' && <Quotation />}
        {mode === 'sales' && <Sales />}
        {mode === 'dashboard' && <Dashboard />}
        {mode === 'settings' && <Settings />}
      </main>
    </div>
  )
}