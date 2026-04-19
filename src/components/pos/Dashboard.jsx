import { useState, useEffect } from 'react'
import { getSales, getProducts } from "../../lib/supabase";
import PDFReport from './PDFReport'

function Dashboard() {
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')

  useEffect(() => {
    async function load() {
      const [s, p] = await Promise.all([getSales(), getProducts()])
      setSales(s)
      setProducts(p)
      setLoading(false)
    }
    load()
  }, [])

  function filterSales() {
    const now = new Date()
    return sales.filter(sale => {
      const date = new Date(sale.created_at)
      if (period === 'today') return date.toDateString() === now.toDateString()
      if (period === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(now.getDate() - 7)
        return date >= weekAgo
      }
      if (period === 'month') {
        return date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
      }
      return true
    })
  }

  const filtered = filterSales()
  const totalRevenue = filtered.reduce((sum, s) => sum + s.total, 0)
  const totalProfit = filtered.reduce((sum, s) => sum + s.profit, 0)
  const totalSales = filtered.length
  const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0

  const productSales = {}
  filtered.forEach(sale => {
    sale.items.forEach(item => {
      if (!productSales[item.name]) productSales[item.name] = { qty: 0, revenue: 0 }
      productSales[item.name].qty += item.qty
      productSales[item.name].revenue += item.selling_price * item.qty
    })
  })
  const bestSellers = Object.entries(productSales)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5)

  const lowStock = products.filter(p => p.stock <= p.low_stock_alert)

  if (loading) return <div className="panel"><p className="empty">Loading dashboard...</p></div>

  return (
    <div className="panel">
      <h2>📊 Dashboard</h2>

      <div className="filter-tabs">
        {['today', 'week', 'month', 'all'].map(f => (
          <button
            key={f}
            className={period === f ? 'active' : ''}
            onClick={() => setPeriod(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Sales</span>
          <span className="stat-value">{totalSales}</span>
        </div>
        <div className="stat-card blue">
          <span className="stat-label">Revenue</span>
          <span className="stat-value">P{totalRevenue.toFixed(2)}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Profit</span>
          <span className="stat-value">P{totalProfit.toFixed(2)}</span>
        </div>
        <div className="stat-card purple">
          <span className="stat-label">Avg Sale</span>
          <span className="stat-value">P{avgSale.toFixed(2)}</span>
        </div>
        <div className="stat-card orange">
          <span className="stat-label">Profit Margin</span>
          <span className="stat-value">{profitMargin}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Products</span>
          <span className="stat-value">{products.length}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <h3>🏆 Best Sellers</h3>
          {bestSellers.length === 0 ? (
            <p className="empty">No sales yet</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Qty Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.map(([name, data], i) => (
                  <tr key={name}>
                    <td>{i + 1}</td>
                    <td>{name}</td>
                    <td>{data.qty}</td>
                    <td>P{data.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="dashboard-section">
          <h3>⚠️ Low Stock Alerts</h3>
          {lowStock.length === 0 ? (
            <p className="empty">All products well stocked!</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Alert At</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map(p => (
                  <tr key={p.id} className="low-stock-row">
                    <td>{p.name}</td>
                    <td className="low-stock-text">{p.stock} ⚠️</td>
                    <td>{p.low_stock_alert}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <PDFReport />
      </div>

    </div>
  )
}

export default Dashboard