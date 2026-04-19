import { useState, useEffect } from 'react'
import { getSales } from "../../lib/supabase";
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'

function Sales() {
  const [sales, setSales] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('today')

  useEffect(() => { fetchSales() }, [])

  async function fetchSales() {
    setLoading(true)
    const data = await getSales()
    setSales(data)
    setLoading(false)
  }

  function filterSales() {
    const now = new Date()
    return sales.filter(sale => {
      const date = new Date(sale.created_at)
      if (filter === 'today') return date.toDateString() === now.toDateString()
      if (filter === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(now.getDate() - 7)
        return date >= weekAgo
      }
      if (filter === 'month') {
        return date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
      }
      return true
    })
  }

  const filtered = filterSales()
  const totalRevenue = filtered.reduce((sum, s) => sum + s.total, 0)
  const totalProfit = filtered.reduce((sum, s) => sum + s.profit, 0)
  const totalVAT = filtered.reduce((sum, s) => sum + (s.vat_amount || 0), 0)

  return (
    <div className="panel">
      <h2>Sales History</h2>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Sales</span>
          <span className="stat-value">{filtered.length}</span>
        </div>
        <div className="stat-card blue">
          <span className="stat-label">Revenue</span>
          <span className="stat-value">P{totalRevenue.toFixed(2)}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Profit</span>
          <span className="stat-value">P{totalProfit.toFixed(2)}</span>
        </div>
        <div className="stat-card orange">
          <span className="stat-label">VAT Collected</span>
          <span className="stat-value">P{totalVAT.toFixed(2)}</span>
        </div>
      </div>

      <div className="filter-tabs">
        {['today', 'week', 'month', 'all'].map(f => (
          <button
            key={f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty">Loading sales...</p>
      ) : filtered.length === 0 ? (
        <p className="empty">No sales found for this period.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Items</th>
              <th>Subtotal</th>
              <th>VAT</th>
              <th>Discount</th>
              <th>Total</th>
              <th>Profit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(sale => (
              <>
                <tr key={sale.id}>
                  <td>{new Date(sale.created_at).toLocaleString()}</td>
                  <td>{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</td>
                  <td>P{parseFloat(sale.subtotal).toFixed(2)}</td>
                  <td style={{ color: '#e67e00' }}>P{parseFloat(sale.vat_amount || 0).toFixed(2)}</td>
                  <td>{sale.discount_amount > 0 ? `- P${parseFloat(sale.discount_amount).toFixed(2)}` : '—'}</td>
                  <td><strong>P{parseFloat(sale.total).toFixed(2)}</strong></td>
                  <td className="profit-text">P{parseFloat(sale.profit).toFixed(2)}</td>
                  <td>
                    <button
                      className="btn-small"
                      onClick={() => setSelected(selected === sale.id ? null : sale.id)}
                    >
                      {selected === sale.id
                        ? <ChevronUp size={14} />
                        : <ChevronDown size={14} />}
                    </button>
                  </td>
                </tr>
                {selected === sale.id && (
                  <tr key={sale.id + '-detail'}>
                    <td colSpan="8" className="sale-detail">
                      <table className="inner-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items.map((item, i) => (
                            <tr key={i}>
                              <td>
                                {item.name}
                                {item.serial_number && (
                                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                    S/N: {item.serial_number}
                                  </div>
                                )}
                              </td>
                              <td>{item.qty}</td>
                              <td>P{parseFloat(item.selling_price).toFixed(2)}</td>
                              <td>P{(item.selling_price * item.qty).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Sales