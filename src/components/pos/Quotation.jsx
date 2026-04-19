import { useState, useEffect } from 'react'
import { saveQuotation, getQuotations } from "../../lib/supabase";
import { Printer, Save, Plus, Trash2, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useLogo } from "../../lib/useLogo";

const VAT_RATE = 0.14

function emptyRow() {
  return { description: '', quantity: '', unit_price: '', discount: '', vat_included: true }
}

function emptyPage(pageNum) {
  return { id: pageNum, rows: [emptyRow(), emptyRow(), emptyRow()] }
}

function Quotation() {
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [quoteDate] = useState(new Date().toISOString().split('T')[0])
  const [quoteNumber, setQuoteNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [pages, setPages] = useState([emptyPage(1)])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('new')
  const [quotations, setQuotations] = useState([])
  const [expandedQuote, setExpandedQuote] = useState(null)
  const [editingCell, setEditingCell] = useState(null)

  // Added for invoice logo
  const { logoUrl: invoiceLogoUrl, logoShape: invoiceLogoShape } = useLogo('invoice')

  useEffect(() => { fetchQuotations() }, [])

  async function fetchQuotations() {
    const data = await getQuotations()
    setQuotations(data)
  }

  function updateRow(pageIndex, rowIndex, field, value) {
    const updatedPages = [...pages]
    updatedPages[pageIndex].rows[rowIndex] = { ...updatedPages[pageIndex].rows[rowIndex], [field]: value }
    setPages(updatedPages)
  }

  function addRow(pageIndex) {
    const updatedPages = [...pages]
    updatedPages[pageIndex].rows.push(emptyRow())
    setPages(updatedPages)
  }

  function removeRow(pageIndex, rowIndex) {
    const updatedPages = [...pages]
    if (updatedPages[pageIndex].rows.length === 1) return
    updatedPages[pageIndex].rows = updatedPages[pageIndex].rows.filter((_, i) => i !== rowIndex)
    setPages(updatedPages)
  }

  function addPage() { setPages([...pages, emptyPage(pages.length + 1)]) }

  function removePage(pageIndex) {
    if (pages.length === 1) return
    setPages(pages.filter((_, i) => i !== pageIndex))
  }

  function getLineTotal(row) {
    const price = parseFloat(row.unit_price) || 0
    const qty = parseFloat(row.quantity) || 0
    const discount = parseFloat(row.discount) || 0
    const gross = price * qty
    return gross - (gross * discount / 100)
  }

  function getLineVAT(row) {
    const total = getLineTotal(row)
    return row.vat_included ? (total * VAT_RATE) / (1 + VAT_RATE) : total * VAT_RATE
  }

  function getLineTotalWithVAT(row) {
    const total = getLineTotal(row)
    return row.vat_included ? total : total * (1 + VAT_RATE)
  }

  function getAllRows() { return pages.flatMap(p => p.rows) }

  function getSummary() {
    const activeRows = getAllRows().filter(r => r.description && r.unit_price && r.quantity)
    const lineDiscountTotal = activeRows.reduce((sum, r) => {
      const gross = (parseFloat(r.unit_price) || 0) * (parseFloat(r.quantity) || 0)
      return sum + (gross * (parseFloat(r.discount) || 0) / 100)
    }, 0)
    const totalExclusive = activeRows.reduce((sum, r) => {
      const total = getLineTotal(r)
      return sum + (r.vat_included ? total / (1 + VAT_RATE) : total)
    }, 0)
    const totalVAT = activeRows.reduce((sum, r) => sum + getLineVAT(r), 0)
    const total = totalExclusive + totalVAT
    return { lineDiscountTotal, totalExclusive, totalVAT, total }
  }

  async function handleSave() {
    if (!customerName) {
      setMessage('Please enter customer name!')
      setMessageType('error')
      return
    }
    const activeRows = getAllRows().filter(r => r.description && r.unit_price && r.quantity)
    if (activeRows.length === 0) {
      setMessage('Please add at least one item!')
      setMessageType('error')
      return
    }

    setSaving(true)
    const { lineDiscountTotal, totalExclusive, totalVAT, total } = getSummary()

    const error = await saveQuotation({
      customer_name: customerName,
      customer_contact: customerContact,
      valid_until: validUntil || null,
      items: activeRows.map(r => ({
        name: r.description,
        quantity: parseFloat(r.quantity) || 0,
        unit_price: parseFloat(r.unit_price) || 0,
        discount: parseFloat(r.discount) || 0,
        vat_included: r.vat_included,
        line_total: getLineTotalWithVAT(r),
      })),
      subtotal: totalExclusive,
      vat_amount: totalVAT,
      total,
      status: 'pending',
    })

    if (error) {
      setMessage('Error saving: ' + error.message)
      setMessageType('error')
    } else {
      setMessage('Quotation saved!')
      setMessageType('success')
      setCustomerName('')
      setCustomerContact('')
      setValidUntil('')
      setQuoteNumber('')
      setNotes('')
      setPages([emptyPage(1)])
      fetchQuotations()
    }
    setSaving(false)
  }

  function downloadPDF() {
  const { lineDiscountTotal, totalExclusive, totalVAT, total } = getSummary()
  const activeRows = getAllRows().filter(r => r.description && r.unit_price && r.quantity)
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(26, 26, 46)
  doc.rect(0, 0, pageWidth, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('QUOTATION', pageWidth / 2, 15, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Quote No: ${quoteNumber || '—'}   Date: ${quoteDate}`, pageWidth / 2, 25, { align: 'center' })

  // Customer info
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(customerName || 'Customer Name', 14, 45)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let yPos = 52
  if (customerContact) { doc.text(customerContact, 14, yPos); yPos += 7 }
  if (validUntil) { doc.text(`Valid Until: ${validUntil}`, 14, yPos); yPos += 7 }
  if (notes) { doc.text(`Notes: ${notes}`, 14, yPos) }

  // Items table
  autoTable(doc, {
    startY: 72,
    head: [['Description', 'Qty', 'Unit Price', 'Discount %', 'VAT', 'Total']],
    body: activeRows.map(r => [
      r.description,
      r.quantity,
      `P${parseFloat(r.unit_price || 0).toFixed(2)}`,
      r.discount ? `${r.discount}%` : '0%',
      r.vat_included ? 'Incl.' : 'Excl.',
      `P${getLineTotalWithVAT(r).toFixed(2)}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  })

  // Summary box pinned to bottom
  const summaryHeight = 4 * 14 + 10
  const summaryY = pageHeight - summaryHeight - 20

  autoTable(doc, {
    startY: summaryY,
    body: [
      ['Line Discount Total', `P${lineDiscountTotal.toFixed(2)}`],
      ['Total Exclusive', `P${totalExclusive.toFixed(2)}`],
      ['VAT (14%)', `P${totalVAT.toFixed(2)}`],
      ['TOTAL', `P${total.toFixed(2)}`],
    ],
    theme: 'grid',
    columnStyles: {
      0: { halign: 'right', fontStyle: 'bold' },
      1: { halign: 'right' },
    },
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

  doc.save(`quotation-${quoteNumber || 'draft'}.pdf`)
}

  function printQuote(q) {
    const printWindow = window.open('', '_blank')
    const rowsHtml = q.items.map(item => `
      <tr>
        <td>${item.name}</td><td>${item.quantity}</td>
        <td>P${parseFloat(item.unit_price).toFixed(2)}</td>
        <td>${item.discount ? item.discount + '%' : '0%'}</td>
        <td>${item.vat_included ? 'Included' : 'Excluded'}</td>
        <td>P${parseFloat(item.line_total || 0).toFixed(2)}</td>
      </tr>
    `).join('')

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Quotation</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;margin:20mm;color:#333}
      h1{font-size:1.6rem;letter-spacing:2px;color:#1a1a2e}
      .top{display:flex;justify-content:space-between;margin:24px 0 32px}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      th{background:#1a1a2e;color:white;padding:10px 12px;text-align:left;font-size:.78rem;text-transform:uppercase}
      td{padding:8px 12px;border-bottom:1px solid #eee;font-size:.88rem}
      .summary{display:flex;justify-content:flex-end}
      .summary-box{min-width:280px;border:1px solid #ddd;border-radius:8px;overflow:hidden}
      .srow{display:flex;justify-content:space-between;padding:8px 16px;font-size:.9rem;border-bottom:1px solid #f0f0f0}
      .total-row{background:#1a1a2e;color:white;font-weight:700}
    </style></head><body>
    <h1>QUOTATION</h1>
    <div class="top">
      <div><strong style="font-size:1.1rem">${q.customer_name}</strong><br>${q.customer_contact || ''}
      ${q.valid_until ? `<br><span style="color:#2d8a4e">Valid Until: ${q.valid_until}</span>` : ''}</div>
      <div><span style="color:#888;font-size:.75rem">DATE</span><br>${new Date(q.created_at).toLocaleDateString()}</div>
    </div>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Discount %</th><th>VAT</th><th>Total</th></tr></thead>
    <tbody>${rowsHtml}</tbody></table>
    <div class="summary"><div class="summary-box">
      <div class="srow"><span>Total Exclusive</span><span>P${parseFloat(q.subtotal).toFixed(2)}</span></div>
      <div class="srow"><span>VAT (14%)</span><span>P${parseFloat(q.vat_amount).toFixed(2)}</span></div>
      <div class="srow total-row"><span>TOTAL</span><span>P${parseFloat(q.total).toFixed(2)}</span></div>
    </div></div>
    </body></html>`)
    printWindow.document.close()
    printWindow.print()
  }

  const { lineDiscountTotal, totalExclusive, totalVAT, total } = getSummary()

  return (
    <div className="purchase-page">

      <div className="purchase-actions no-print">
        <h2>Quotation</h2>
        <div className="purchase-actions-right">
          <button
            className={`btn-secondary ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView(view === 'list' ? 'new' : 'list')}
          >
            <FileText size={15} />
            {view === 'list' ? 'New Quotation' : `All Quotations (${quotations.length})`}
          </button>
          {view === 'new' && (
            <>
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={15} /> Print
              </button>
              <button className="btn-secondary" onClick={downloadPDF}>
                <Download size={15} /> Download PDF
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={15} /> {saving ? 'Saving...' : 'Save Quotation'}
              </button>
            </>
          )}
        </div>
      </div>

      {message && <p className={`message ${messageType} no-print`}>{message}</p>}

      {view === 'new' && pages.map((page, pageIndex) => (
        <div key={page.id} className="a4-invoice">
          <div className="invoice-top">
            <div className="invoice-supplier">
              {invoiceLogoUrl && (
                <img
                  src={invoiceLogoUrl}
                  alt="Company Logo"
                  className={`invoice-logo ${invoiceLogoShape === 'rectangle' ? 'logo-rect' : 'logo-square'}`}
                />
              )}
              <h1 className="invoice-title">QUOTATION</h1>
              {pageIndex > 0 && <p style={{ color: '#888', fontSize: '0.85rem' }}>Continued — Page {pageIndex + 1}</p>}

              <div className="invoice-field" onDoubleClick={() => setEditingCell('customerName')}>
                {editingCell === 'customerName' ? (
                  <input autoFocus className="invoice-input" placeholder="Customer Name *"
                    value={customerName} onChange={e => setCustomerName(e.target.value)}
                    onBlur={() => setEditingCell(null)} />
                ) : (
                  <span className={`invoice-value bold ${!customerName ? 'placeholder' : ''}`}>
                    {customerName || 'Double-click to enter customer name'}
                  </span>
                )}
              </div>
              <div className="invoice-field" onDoubleClick={() => setEditingCell('customerContact')}>
                {editingCell === 'customerContact' ? (
                  <input autoFocus className="invoice-input" placeholder="Contact number"
                    value={customerContact} onChange={e => setCustomerContact(e.target.value)}
                    onBlur={() => setEditingCell(null)} />
                ) : (
                  <span className={`invoice-value ${!customerContact ? 'placeholder' : ''}`}>
                    {customerContact || 'Double-click to enter contact'}
                  </span>
                )}
              </div>
            </div>

            <div className="invoice-meta">
              <div className="invoice-meta-row">
                <span className="invoice-meta-label">Quote No:</span>
                <div className="invoice-field" onDoubleClick={() => setEditingCell('quoteNumber')}>
                  {editingCell === 'quoteNumber' ? (
                    <input autoFocus className="invoice-input" placeholder="QUO-001"
                      value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)}
                      onBlur={() => setEditingCell(null)} />
                  ) : (
                    <span className={`invoice-value ${!quoteNumber ? 'placeholder' : ''}`}>
                      {quoteNumber || 'QUO-001'}
                    </span>
                  )}
                </div>
              </div>
              <div className="invoice-meta-row">
                <span className="invoice-meta-label">Date:</span>
                <span className="invoice-value">{quoteDate}</span>
              </div>
              <div className="invoice-meta-row">
                <span className="invoice-meta-label">Valid Until:</span>
                <div className="invoice-field" onDoubleClick={() => setEditingCell('validUntil')}>
                  {editingCell === 'validUntil' ? (
                    <input autoFocus className="invoice-input" type="date"
                      value={validUntil} onChange={e => setValidUntil(e.target.value)}
                      onBlur={() => setEditingCell(null)} />
                  ) : (
                    <span className={`invoice-value ${!validUntil ? 'placeholder' : ''}`}>
                      {validUntil || 'Double-click to set date'}
                    </span>
                  )}
                </div>
              </div>
              <div className="invoice-meta-row">
                <span className="invoice-meta-label">Notes:</span>
                <div className="invoice-field" onDoubleClick={() => setEditingCell('notes')}>
                  {editingCell === 'notes' ? (
                    <input autoFocus className="invoice-input" placeholder="Any notes..."
                      value={notes} onChange={e => setNotes(e.target.value)}
                      onBlur={() => setEditingCell(null)} />
                  ) : (
                    <span className={`invoice-value ${!notes ? 'placeholder' : ''}`}>
                      {notes || 'Double-click to add notes'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="invoice-body">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Discount %</th>
                  <th>VAT Incl.</th>
                  <th>Total</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="invoice-row">
                    <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-description`)}>
                      {editingCell === `${pageIndex}-${rowIndex}-description` ? (
                        <input autoFocus className="invoice-cell-input wide" value={row.description}
                          onChange={e => updateRow(pageIndex, rowIndex, 'description', e.target.value)}
                          onBlur={() => setEditingCell(null)} />
                      ) : (
                        <span className={!row.description ? 'cell-placeholder' : ''}>
                          {row.description || 'Double-click to edit'}
                        </span>
                      )}
                    </td>
                    <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-quantity`)}>
                      {editingCell === `${pageIndex}-${rowIndex}-quantity` ? (
                        <input autoFocus className="invoice-cell-input narrow" type="number"
                          value={row.quantity}
                          onChange={e => updateRow(pageIndex, rowIndex, 'quantity', e.target.value)}
                          onBlur={() => setEditingCell(null)} />
                      ) : (
                        <span className={!row.quantity ? 'cell-placeholder' : ''}>{row.quantity || '0'}</span>
                      )}
                    </td>
                    <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-unit_price`)}>
                      {editingCell === `${pageIndex}-${rowIndex}-unit_price` ? (
                        <input autoFocus className="invoice-cell-input narrow" type="number"
                          value={row.unit_price}
                          onChange={e => updateRow(pageIndex, rowIndex, 'unit_price', e.target.value)}
                          onBlur={() => setEditingCell(null)} />
                      ) : (
                        <span className={!row.unit_price ? 'cell-placeholder' : ''}>
                          {row.unit_price ? `P${parseFloat(row.unit_price).toFixed(2)}` : '0.00'}
                        </span>
                      )}
                    </td>
                    <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-discount`)}>
                      {editingCell === `${pageIndex}-${rowIndex}-discount` ? (
                        <input autoFocus className="invoice-cell-input narrow" type="number"
                          value={row.discount}
                          onChange={e => updateRow(pageIndex, rowIndex, 'discount', e.target.value)}
                          onBlur={() => setEditingCell(null)} />
                      ) : (
                        <span>{row.discount ? `${row.discount}%` : '0%'}</span>
                      )}
                    </td>
                    <td className="vat-cell">
                      <input type="checkbox" checked={row.vat_included}
                        onChange={e => updateRow(pageIndex, rowIndex, 'vat_included', e.target.checked)} />
                    </td>
                    <td className="total-cell">
                      {row.description && row.unit_price && row.quantity
                        ? `P${getLineTotalWithVAT(row).toFixed(2)}` : '—'}
                    </td>
                    <td className="row-action no-print">
                      <button className="remove-btn" onClick={() => removeRow(pageIndex, rowIndex)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="add-row-wrap no-print">
              <button className="add-row-btn" onClick={() => addRow(pageIndex)}>
                <Plus size={14} /> Add Row
              </button>
            </div>
          </div>

          <div className="invoice-summary">
            <div className="invoice-summary-box">
              <div className="summary-row"><span>Line Discount Total</span><span>P{lineDiscountTotal.toFixed(2)}</span></div>
              <div className="summary-row"><span>Total Exclusive</span><span>P{totalExclusive.toFixed(2)}</span></div>
              <div className="summary-row"><span>VAT (14%)</span><span>P{totalVAT.toFixed(2)}</span></div>
              <div className="summary-row total-row"><span>TOTAL</span><span>P{total.toFixed(2)}</span></div>
            </div>
          </div>

          {pages.length > 1 && (
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn-danger btn-small" onClick={() => removePage(pageIndex)}>
                <Trash2 size={13} /> Remove Page
              </button>
            </div>
          )}
        </div>
      ))}

      {view === 'new' && (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
          <button className="add-row-btn" style={{ maxWidth: '300px' }} onClick={addPage}>
            <Plus size={16} /> Add Another Page
          </button>
        </div>
      )}

      {view === 'list' && (
        <div className="panel" style={{ marginTop: '16px' }}>
          {quotations.length === 0 ? (
            <p className="empty">No quotations yet.</p>
          ) : (
            <div className="invoice-list">
              {quotations.map((q) => (
                <div key={q.id} className="invoice-bar">
                  <div className="invoice-bar-header"
                    onClick={() => setExpandedQuote(expandedQuote === q.id ? null : q.id)}>
                    <div className="invoice-bar-left">
                      <span className="invoice-bar-number">{q.customer_name}</span>
                      <span className="invoice-bar-date">{new Date(q.created_at).toLocaleDateString()}</span>
                      <span className="invoice-bar-items">{q.items.length} item{q.items.length !== 1 ? 's' : ''}</span>
                      {q.valid_until && <span className="invoice-bar-items">Valid until: {q.valid_until}</span>}
                    </div>
                    <div className="invoice-bar-right">
                      <span className="invoice-bar-total">P{parseFloat(q.total).toFixed(2)}</span>
                      <span className={`status-badge ${q.status}`}>{q.status}</span>
                      {expandedQuote === q.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {expandedQuote === q.id && (
                    <div className="invoice-bar-detail">
                      <div className="a4-invoice-preview">
                        <div className="invoice-top">
                          <div className="invoice-supplier">
                            <h1 className="invoice-title">QUOTATION</h1>
                            <div className="invoice-value bold">{q.customer_name}</div>
                            {q.customer_contact && <div className="invoice-value">{q.customer_contact}</div>}
                            {q.valid_until && <div className="invoice-value" style={{ color: '#2d8a4e' }}>Valid Until: {q.valid_until}</div>}
                          </div>
                          <div className="invoice-meta">
                            <div className="invoice-meta-row">
                              <span className="invoice-meta-label">Date:</span>
                              <span className="invoice-value">{new Date(q.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="invoice-body">
                          <table className="invoice-table">
                            <thead>
                              <tr>
                                <th>Description</th><th>Qty</th><th>Unit Price</th>
                                <th>Discount %</th><th>VAT</th><th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {q.items.map((item, j) => (
                                <tr key={j}>
                                  <td>{item.name}</td>
                                  <td>{item.quantity}</td>
                                  <td>P{parseFloat(item.unit_price).toFixed(2)}</td>
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
                            <div className="summary-row"><span>Total Exclusive</span><span>P{parseFloat(q.subtotal).toFixed(2)}</span></div>
                            <div className="summary-row"><span>VAT (14%)</span><span>P{parseFloat(q.vat_amount).toFixed(2)}</span></div>
                            <div className="summary-row total-row"><span>TOTAL</span><span>P{parseFloat(q.total).toFixed(2)}</span></div>
                          </div>
                        </div>

                        <div className="invoice-bar-print no-print">
                          <button className="btn-primary" onClick={() => printQuote(q)}>Print Quotation</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Quotation