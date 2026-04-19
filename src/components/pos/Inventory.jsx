import { useState, useEffect } from 'react'
import { getProducts, getSuppliers, getPurchases, supabase } from "../../lib/supabase";
import { Package, Factory, Search, Edit2, Trash2, Save, X, ChevronLeft, AlertTriangle } from 'lucide-react'

function Inventory() {
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [purchases, setPurchases] = useState([])
  const [search, setSearch] = useState('')
  const [view, setView] = useState('products')
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const [p, s, pu] = await Promise.all([getProducts(), getSuppliers(), getPurchases()])
    setProducts(p)
    setSuppliers(s)
    setPurchases(pu)
  }

  function getSupplierProducts(supplierName) {
    const supplierPurchases = purchases.filter(p => p.supplier_name === supplierName)
    const result = []
    supplierPurchases.forEach(purchase => {
      purchase.items.forEach(item => {
        const liveProduct = products.find(p => p.barcode === item.barcode)
        result.push({
          ...item,
          stock: liveProduct ? liveProduct.stock : item.quantity,
          selling_price: liveProduct ? liveProduct.selling_price : item.selling_price,
          cost_price: liveProduct ? liveProduct.cost_price : item.cost_price,
          name: liveProduct ? liveProduct.name : item.name,
          live_id: liveProduct ? liveProduct.id : null,
          low_stock_alert: liveProduct ? liveProduct.low_stock_alert : 5,
          purchase_date: purchase.created_at,
          invoice_number: purchase.invoice_number,
          purchase_id: purchase.id,
        })
      })
    })
    return result
  }

  async function saveEdit(id) {
    const { error } = await supabase
      .from('products')
      .update({
        name: editData.name,
        barcode: editData.barcode,
        cost_price: parseFloat(editData.cost_price),
        selling_price: parseFloat(editData.selling_price),
        stock: parseInt(editData.stock),
        low_stock_alert: parseInt(editData.low_stock_alert || 5),
      })
      .eq('id', id)

    if (error) {
      setMessage('Error updating: ' + error.message)
      setMessageType('error')
    } else {
      setMessage('Product updated successfully!')
      setMessageType('success')
      setEditingId(null)
      fetchAll()
    }
  }

  async function deleteProduct(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      setMessage('Error deleting: ' + error.message)
      setMessageType('error')
    } else {
      setMessage(`"${name}" deleted successfully!`)
      setMessageType('success')
      fetchAll()
    }
  }

  async function deleteSupplier(id, name) {
    if (!window.confirm(`Delete supplier "${name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) {
      setMessage('Error deleting supplier: ' + error.message)
      setMessageType('error')
    } else {
      setMessage(`Supplier "${name}" deleted!`)
      setMessageType('success')
      setSelectedSupplier(null)
      fetchAll()
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  )

  const supplierProducts = selectedSupplier
    ? getSupplierProducts(selectedSupplier.name)
    : []

  return (
    <div className="panel">
      <h2>Inventory</h2>

      <div className="filter-tabs">
        <button
          className={view === 'products' ? 'active' : ''}
          onClick={() => { setView('products'); setSelectedSupplier(null) }}
        >
          <Package size={15} /> All Products ({products.length})
        </button>
        <button
          className={view === 'suppliers' ? 'active' : ''}
          onClick={() => { setView('suppliers'); setSelectedSupplier(null) }}
        >
          <Factory size={15} /> Suppliers ({suppliers.length})
        </button>
      </div>

      {message && <p className={`message ${messageType}`}>{message}</p>}

      {/* ALL PRODUCTS VIEW */}
      {view === 'products' && (
        <>
          <div className="section-header">
            <h3>All Products ({filtered.length})</h3>
            <div className="filters">
              <div className="search-wrap">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Name</th>
                <th>Cost</th>
                <th>Price</th>
                <th>Margin</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const m = p.selling_price > 0
                  ? (((p.selling_price - p.cost_price) / p.selling_price) * 100).toFixed(1)
                  : '0.0'
                const lowStock = p.stock <= p.low_stock_alert
                const isEditing = editingId === p.id

                return (
                  <tr key={p.id} className={lowStock && !isEditing ? 'low-stock-row' : ''}>
                    <td>
                      {isEditing ? (
                        <input className="edit-input" value={editData.barcode}
                          onChange={e => setEditData({ ...editData, barcode: e.target.value })} />
                      ) : p.barcode}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="edit-input" value={editData.name}
                          onChange={e => setEditData({ ...editData, name: e.target.value })} />
                      ) : p.name}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="edit-input small" type="number" value={editData.cost_price}
                          onChange={e => setEditData({ ...editData, cost_price: e.target.value })} />
                      ) : `P${parseFloat(p.cost_price).toFixed(2)}`}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="edit-input small" type="number" value={editData.selling_price}
                          onChange={e => setEditData({ ...editData, selling_price: e.target.value })} />
                      ) : `P${parseFloat(p.selling_price).toFixed(2)}`}
                    </td>
                    <td>
                      <span className={`margin-badge small ${m >= 30 ? 'good' : m >= 10 ? 'ok' : 'low'}`}>
                        {m}%
                      </span>
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="edit-input small" type="number" value={editData.stock}
                          onChange={e => setEditData({ ...editData, stock: e.target.value })} />
                      ) : (
                        <span className={lowStock ? 'low-stock-text' : ''}>
                          {p.stock} {lowStock ? <AlertTriangle size={13} style={{ display: 'inline' }} /> : ''}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn-primary btn-small" onClick={() => saveEdit(p.id)}>
                            <Save size={13} />
                          </button>
                          <button className="btn-secondary btn-small" onClick={() => setEditingId(null)}>
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn-small" onClick={() => {
                            setEditingId(p.id)
                            setEditData({
                              name: p.name, barcode: p.barcode,
                              cost_price: p.cost_price, selling_price: p.selling_price,
                              stock: p.stock, low_stock_alert: p.low_stock_alert,
                            })
                          }}>
                            <Edit2 size={13} />
                          </button>
                          <button className="remove-btn" onClick={() => deleteProduct(p.id, p.name)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {/* SUPPLIERS VIEW */}
      {view === 'suppliers' && !selectedSupplier && (
        <>
          <h3 style={{ margin: '16px 0 12px' }}>All Suppliers</h3>
          {suppliers.length === 0 ? (
            <p className="empty">No suppliers yet — add products via the Purchase section!</p>
          ) : (
            <div className="suppliers-grid">
              {suppliers.map(s => {
                const supplierPurchases = purchases.filter(p => p.supplier_name === s.name)
                const totalProducts = supplierPurchases.reduce((sum, p) => sum + p.items.length, 0)
                const totalSpent = supplierPurchases.reduce((sum, p) => sum + p.total_including_vat, 0)
                return (
                  <div key={s.id} className="supplier-card" onClick={() => setSelectedSupplier(s)}>
                    <div className="supplier-card-header">
                      <Factory size={22} className="supplier-icon" />
                      <h4>{s.name}</h4>
                    </div>
                    <div className="supplier-card-info">
                      {s.contact && <p>{s.contact}</p>}
                      {s.email && <p>{s.email}</p>}
                    </div>
                    <div className="supplier-card-stats">
                      <span>{supplierPurchases.length} invoice{supplierPurchases.length !== 1 ? 's' : ''}</span>
                      <span>{totalProducts} products</span>
                      <span>P{totalSpent.toFixed(2)} spent</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* SUPPLIER DETAIL VIEW */}
      {view === 'suppliers' && selectedSupplier && (
        <>
          <div className="supplier-detail-header">
            <button className="btn-secondary btn-small" onClick={() => setSelectedSupplier(null)}>
              <ChevronLeft size={14} /> Back
            </button>
            <div className="supplier-detail-title">
              <h3>{selectedSupplier.name}</h3>
              {selectedSupplier.contact && <span>{selectedSupplier.contact}</span>}
              {selectedSupplier.email && <span>{selectedSupplier.email}</span>}
            </div>
            <button className="remove-btn" onClick={() => deleteSupplier(selectedSupplier.id, selectedSupplier.name)}>
              <Trash2 size={14} /> Delete Supplier
            </button>
          </div>

          <h4 style={{ margin: '16px 0 8px' }}>
            Products from {selectedSupplier.name} ({supplierProducts.length})
          </h4>

          {supplierProducts.length === 0 ? (
            <p className="empty">No products found for this supplier.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Cost</th>
                  <th>Selling</th>
                  <th>Stock</th>
                  <th>VAT</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {supplierProducts.map((item, i) => {
                  const isEditing = editingId === `sup-${i}`
                  return (
                    <tr key={i}>
                      <td>{new Date(item.purchase_date).toLocaleDateString()}</td>
                      <td>{item.invoice_number || '—'}</td>
                      <td>
                        {isEditing ? (
                          <input className="edit-input" value={editData.name}
                            onChange={e => setEditData({ ...editData, name: e.target.value })} />
                        ) : (
                          <>
                            {item.name}
                            {item.has_serial && item.serial_number && (
                              <div style={{ fontSize: '0.75rem', color: '#888' }}>S/N: {item.serial_number}</div>
                            )}
                          </>
                        )}
                      </td>
                      <td>{item.barcode || '—'}</td>
                      <td>
                        {isEditing ? (
                          <input className="edit-input small" type="number" value={editData.cost_price}
                            onChange={e => setEditData({ ...editData, cost_price: e.target.value })} />
                        ) : `P${parseFloat(item.cost_price).toFixed(2)}`}
                      </td>
                      <td>
                        {isEditing ? (
                          <input className="edit-input small" type="number" value={editData.selling_price}
                            onChange={e => setEditData({ ...editData, selling_price: e.target.value })} />
                        ) : `P${parseFloat(item.selling_price).toFixed(2)}`}
                      </td>
                      <td>
                        {isEditing ? (
                          <input className="edit-input small" type="number" value={editData.stock}
                            onChange={e => setEditData({ ...editData, stock: e.target.value })} />
                        ) : (
                          <span className={item.stock <= item.low_stock_alert ? 'low-stock-text' : ''}>
                            {item.stock} {item.stock <= item.low_stock_alert ? <AlertTriangle size={13} style={{ display: 'inline' }} /> : ''}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${item.vat_included ? 'accepted' : 'pending'}`}>
                          {item.vat_included ? 'Included' : 'Excluded'}
                        </span>
                      </td>
                      <td>
                        {item.live_id && (
                          isEditing ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn-primary btn-small" onClick={() => saveEdit(item.live_id)}>
                                <Save size={13} />
                              </button>
                              <button className="btn-secondary btn-small" onClick={() => setEditingId(null)}>
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn-small" onClick={() => {
                                setEditingId(`sup-${i}`)
                                setEditData({
                                  name: item.name, barcode: item.barcode,
                                  cost_price: item.cost_price, selling_price: item.selling_price,
                                  stock: item.stock, low_stock_alert: item.low_stock_alert,
                                })
                              }}>
                                <Edit2 size={13} />
                              </button>
                              <button className="remove-btn" onClick={() => deleteProduct(item.live_id, item.name)}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

export default Inventory