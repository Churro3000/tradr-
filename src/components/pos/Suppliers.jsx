import { useState, useEffect } from 'react'
import { getSuppliers, getPurchases, supabase } from "../../lib/supabase";
import { Factory, ChevronDown, ChevronUp, Clock, CheckCircle, Download, Edit2, Trash2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useLogo } from "../../lib/useLogo";

function Suppliers({ onEditInvoice }) {
  const [suppliers, setSuppliers] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [expandedInvoice, setExpandedInvoice] = useState(null)
  const [message, setMessage] = useState('')

  // Added for invoice logo
  const { logoUrl: invoiceLogoUrl, logoShape: invoiceLogoShape } = useLogo('invoice')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [s, p] = await Promise.all([getSuppliers(), getPurchases()])
    setSuppliers(s)
    setPurchases(p)
    setLoading(false)
  }

  function getSupplierPurchases(supplierName) {
    return purchases.filter(p => p.supplier_name === supplierName)
  }

  async function deletePurchase(id) {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return
    const { error } = await supabase.from('purchases').delete().eq('id', id)
    if (error) {
      setMessage('Error deleting invoice')
    } else {
      setMessage('Invoice deleted!')
      setExpandedInvoice(null)
      fetchAll()
    }
  }

  // FIXED & IMPROVED: Now properly waits for the logo before printing PDF
  async function downloadInvoicePDF(purchase) {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Header background
    doc.setFillColor(26, 26, 46)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('PURCHASE INVOICE', pageWidth / 2, 15, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice No: ${purchase.invoice_number || '—'}   Date: ${new Date(purchase.created_at).toLocaleDateString()}`, pageWidth / 2, 25, { align: 'center' })

    // Supplier Information
    doc.setTextColor(50, 50, 50)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(purchase.supplier_name, 14, 45)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    let yPos = 52
    if (purchase.supplier_contact) { doc.text(purchase.supplier_contact, 14, yPos); yPos += 7 }
    if (purchase.supplier_email) { doc.text(purchase.supplier_email, 14, yPos); yPos += 7 }
    if (purchase.notes) { doc.text(`Notes: ${purchase.notes}`, 14, yPos) }

    // Add logo to PDF (Properly handled with async loading)
    if (invoiceLogoUrl) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = invoiceLogoUrl

        await new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve // continue even if logo fails to load
        })

        const logoWidth = invoiceLogoShape === 'rectangle' ? 45 : 30
        const logoHeight = invoiceLogoShape === 'rectangle' ? 22 : 30

        // Place logo at top right
        doc.addImage(img, 'PNG', pageWidth - 14 - logoWidth, 8, logoWidth, logoHeight)
      } catch (e) {
        console.log('Logo could not be added to PDF')
      }
    }

    // Items Table
    autoTable(doc, {
      startY: 72,
      head: [['Code', 'Description', 'Qty', 'Cost Price', 'Selling Price', 'Discount %', 'VAT', 'Total']],
      body: purchase.items.map(item => [
        item.barcode || '—',
        item.name,
        item.quantity,
        `P${parseFloat(item.cost_price).toFixed(2)}`,
        `P${parseFloat(item.selling_price || 0).toFixed(2)}`,
        item.discount ? `${item.discount}%` : '0%',
        item.vat_included ? 'Incl.' : 'Excl.',
        `P${parseFloat(item.line_total || 0).toFixed(2)}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    })

    // Summary at bottom
    const summaryHeight = 4 * 14 + 10
    const summaryY = pageHeight - summaryHeight - 20

    autoTable(doc, {
      startY: summaryY,
      body: [
        ['Line Discount Total', `P${parseFloat(purchase.discount_total || 0).toFixed(2)}`],
        ['Total Exclusive', `P${parseFloat(purchase.total_excluding_vat).toFixed(2)}`],
        ['VAT (14%)', `P${parseFloat(purchase.total_vat).toFixed(2)}`],
        ['TOTAL', `P${parseFloat(purchase.total_including_vat).toFixed(2)}`],
      ],
      theme: 'grid',
      columnStyles: { 0: { halign: 'right', fontStyle: 'bold' }, 1: { halign: 'right' } },
      bodyStyles: { fontSize: 9 },
      didParseCell: (data) => {
        if (data.row.index === 3) {
          data.cell.styles.fillColor = [26, 26, 46]
          data.cell.styles.textColor = [255, 255, 255]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: pageWidth / 2, right: 14 },
    })

    doc.save(`invoice-${purchase.invoice_number || purchase.id}.pdf`)
  }

  if (loading) return <div className="panel"><p className="empty">Loading suppliers...</p></div>

  if (!selectedSupplier) {
    return (
      <div className="panel">
        <h2>Suppliers</h2>
        <p className="hint">Click a supplier to view their invoices.</p>
        {message && <p className="message success">{message}</p>}
        {suppliers.length === 0 ? (
          <p className="empty">No suppliers yet — add products via the Purchase section!</p>
        ) : (
          <div className="suppliers-grid">
            {suppliers.map(s => {
              const supplierPurchases = getSupplierPurchases(s.name)
              const totalSpent = supplierPurchases.reduce((sum, p) => sum + p.total_including_vat, 0)
              const pendingCount = supplierPurchases.filter(p => p.pending_payment).length
              return (
                <div key={s.id} className="supplier-card" onClick={() => setSelectedSupplier(s)}>
                  <div className="supplier-card-header">
                    <Factory size={22} />
                    <h4>{s.name}</h4>
                  </div>
                  <div className="supplier-card-info">
                    {s.contact && <p>{s.contact}</p>}
                    {s.email && <p>{s.email}</p>}
                  </div>
                  <div className="supplier-card-stats">
                    <span>{supplierPurchases.length} invoice{supplierPurchases.length !== 1 ? 's' : ''}</span>
                    <span>P{totalSpent.toFixed(2)} total</span>
                    {pendingCount > 0 && <span className="pending-stat">{pendingCount} pending</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const supplierPurchases = getSupplierPurchases(selectedSupplier.name)
  const totalSpent = supplierPurchases.reduce((sum, p) => sum + p.total_including_vat, 0)
  const pendingTotal = supplierPurchases.filter(p => p.pending_payment).reduce((sum, p) => sum + p.total_including_vat, 0)

  return (
    <div className="panel">
      <div className="supplier-detail-header">
        <button className="btn-secondary btn-small" onClick={() => { setSelectedSupplier(null); setExpandedInvoice(null) }}>
          ← Back
        </button>
        <div className="supplier-detail-title">
          <h3>{selectedSupplier.name}</h3>
          {selectedSupplier.contact && <span>{selectedSupplier.contact}</span>}
          {selectedSupplier.email && <span>{selectedSupplier.email}</span>}
        </div>
      </div>

      {message && <p className="message success">{message}</p>}

      <div className="stats-row" style={{ marginTop: '16px' }}>
        <div className="stat-card blue">
          <span className="stat-label">Total Invoices</span>
          <span className="stat-value">{supplierPurchases.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Spent</span>
          <span className="stat-value">P{totalSpent.toFixed(2)}</span>
        </div>
        {pendingTotal > 0 && (
          <div className="stat-card orange">
            <span className="stat-label">Pending Payment</span>
            <span className="stat-value">P{pendingTotal.toFixed(2)}</span>
          </div>
        )}
      </div>

      <h3 style={{ margin: '20px 0 12px' }}>Invoices</h3>

      {supplierPurchases.length === 0 ? (
        <p className="empty">No invoices yet for this supplier.</p>
      ) : (
        <div className="invoice-list">
          {supplierPurchases.map((purchase, i) => (
            <div key={purchase.id} className="invoice-bar">
              <div className="invoice-bar-header"
                onClick={() => setExpandedInvoice(expandedInvoice === purchase.id ? null : purchase.id)}>
                <div className="invoice-bar-left">
                  <span className="invoice-bar-number">{purchase.invoice_number || `Invoice ${i + 1}`}</span>
                  <span className="invoice-bar-date">{new Date(purchase.created_at).toLocaleDateString()}</span>
                  <span className="invoice-bar-items">{purchase.items.length} item{purchase.items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="invoice-bar-right">
                  <span className="invoice-bar-total">P{parseFloat(purchase.total_including_vat).toFixed(2)}</span>
                  {purchase.pending_payment ? (
                    <span className="invoice-status pending"><Clock size={12} /> Pending Payment</span>
                  ) : (
                    <span className="invoice-status paid"><CheckCircle size={12} /> Paid</span>
                  )}
                  {expandedInvoice === purchase.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expandedInvoice === purchase.id && (
                <div className="invoice-bar-detail">
                  <div className="a4-invoice-preview">
                    <div className="invoice-top">
                      <div className="invoice-supplier">
                        {invoiceLogoUrl && (
                          <img
                            src={invoiceLogoUrl}
                            alt="Company Logo"
                            className={`invoice-logo ${invoiceLogoShape === 'rectangle' ? 'logo-rect' : 'logo-square'}`}
                          />
                        )}
                        <h1 className="invoice-title">PURCHASE INVOICE</h1>
                        <div className="invoice-value bold">{purchase.supplier_name}</div>
                        {purchase.supplier_contact && <div className="invoice-value">{purchase.supplier_contact}</div>}
                        {purchase.supplier_email && <div className="invoice-value">{purchase.supplier_email}</div>}
                      </div>
                      <div className="invoice-meta">
                        <div className="invoice-meta-row">
                          <span className="invoice-meta-label">Invoice No:</span>
                          <span className="invoice-value">{purchase.invoice_number || '—'}</span>
                        </div>
                        <div className="invoice-meta-row">
                          <span className="invoice-meta-label">Date:</span>
                          <span className="invoice-value">{new Date(purchase.created_at).toLocaleDateString()}</span>
                        </div>
                        {purchase.notes && (
                          <div className="invoice-meta-row">
                            <span className="invoice-meta-label">Notes:</span>
                            <span className="invoice-value">{purchase.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="invoice-body">
                      <table className="invoice-table">
                        <thead>
                          <tr>
                            <th>Code</th><th>Description</th><th>Qty</th>
                            <th>Cost Price</th><th>Selling Price</th><th>Discount %</th><th>VAT</th><th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchase.items.map((item, j) => (
                            <tr key={j}>
                              <td>{item.barcode || '—'}</td>
                              <td>{item.name}</td>
                              <td>{item.quantity}</td>
                              <td>P{parseFloat(item.cost_price).toFixed(2)}</td>
                              <td>P{parseFloat(item.selling_price || 0).toFixed(2)}</td>
                              <td>{item.discount ? `${item.discount}%` : '0%'}</td>
                              <td><span className={`status-badge ${item.vat_included ? 'accepted' : 'pending'}`}>{item.vat_included ? 'Incl.' : 'Excl.'}</span></td>
                              <td>P{parseFloat(item.line_total || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="invoice-summary">
                      <div className="invoice-summary-box">
                        <div className="summary-row"><span>Line Discount Total</span><span>P{parseFloat(purchase.discount_total || 0).toFixed(2)}</span></div>
                        <div className="summary-row"><span>Total Exclusive</span><span>P{parseFloat(purchase.total_excluding_vat).toFixed(2)}</span></div>
                        <div className="summary-row"><span>VAT (14%)</span><span>P{parseFloat(purchase.total_vat).toFixed(2)}</span></div>
                        <div className="summary-row total-row"><span>TOTAL</span><span>P{parseFloat(purchase.total_including_vat).toFixed(2)}</span></div>
                      </div>
                    </div>

                    <div className="invoice-bar-print no-print">
                      <button className="btn-secondary" onClick={() => downloadInvoicePDF(purchase)}>
                        <Download size={14} /> Download PDF
                      </button>
                      <button className="btn-primary" onClick={() => onEditInvoice && onEditInvoice(purchase)}>
                        <Edit2 size={14} /> Edit Invoice
                      </button>
                      <button className="btn-danger" onClick={() => deletePurchase(purchase.id)}>
                        <Trash2 size={14} /> Delete Invoice
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Suppliers