import { useState, useEffect } from 'react'
import { savePurchase, saveProduct, saveSupplier, getProducts, getSuppliers, supabase } from "../../lib/supabase";
import { Printer, Save, Plus, Trash2, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useLogo } from "../../lib/useLogo";

const VAT_RATE = 0.14

function emptyRow() {
  return { code: '', description: '', quantity: '', price: '', selling_price: '', discount: '', vat_included: true }
}

function emptyPage(pageNum) {
  return { id: pageNum, rows: [emptyRow(), emptyRow(), emptyRow()] }
}

function Purchase({ editingInvoice, onClearEdit }) {
  const [supplierName, setSupplierName] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [supplierEmail, setSupplierEmail] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [pages, setPages] = useState([emptyPage(1)])
  const [pendingPayment, setPendingPayment] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [existingProducts, setExistingProducts] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuppliers, setFilteredSuppliers] = useState([])
  const [editingCell, setEditingCell] = useState(null)
  const [autoFillMessages, setAutoFillMessages] = useState({})

  // Added for invoice logo
  const { logoUrl: invoiceLogoUrl, logoShape: invoiceLogoShape } = useLogo('invoice')

  useEffect(() => {
    fetchSuppliers()
    fetchExistingProducts()
  }, [])

  useEffect(() => {
    if (editingInvoice) {
      setSupplierName(editingInvoice.supplier_name || '')
      setSupplierContact(editingInvoice.supplier_contact || '')
      setSupplierEmail(editingInvoice.supplier_email || '')
      setInvoiceNumber(editingInvoice.invoice_number || '')
      setNotes(editingInvoice.notes || '')
      setPendingPayment(editingInvoice.pending_payment || false)
      const loadedRows = editingInvoice.items.map(item => ({
        code: item.barcode || '',
        description: item.name || '',
        quantity: item.quantity || '',
        price: item.cost_price || '',
        selling_price: item.selling_price || '',
        discount: item.discount || '',
        vat_included: item.vat_included !== false,
      }))
      setPages([{ id: 1, rows: loadedRows.length > 0 ? loadedRows : [emptyRow()] }])
      setMessage('Editing existing invoice — make changes and click Update Invoice')
      setMessageType('success')
    }
  }, [editingInvoice])

  async function fetchSuppliers() {
    const data = await getSuppliers()
    setSuppliers(data)
  }

  async function fetchExistingProducts() {
    const data = await getProducts()
    setExistingProducts(data)
  }

  function handleSupplierInput(value) {
    setSupplierName(value)
    if (value.length > 0) {
      const matches = suppliers.filter(s => s.name.toLowerCase().includes(value.toLowerCase()))
      setFilteredSuppliers(matches)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
      setSupplierContact('')
      setSupplierEmail('')
    }
  }

  function selectSupplier(supplier) {
    setSupplierName(supplier.name)
    setSupplierContact(supplier.contact || '')
    setSupplierEmail(supplier.email || '')
    setShowSuggestions(false)
  }

  function updateRow(pageIndex, rowIndex, field, value) {
    const updatedPages = [...pages]
    updatedPages[pageIndex].rows[rowIndex] = { ...updatedPages[pageIndex].rows[rowIndex], [field]: value }

    if (field === 'description' || field === 'code') {
      const match = existingProducts.find(p =>
        (field === 'description' && p.name.toLowerCase() === value.toLowerCase()) ||
        (field === 'code' && p.barcode === value)
      )
      if (match) {
        updatedPages[pageIndex].rows[rowIndex] = {
          ...updatedPages[pageIndex].rows[rowIndex],
          [field]: value,
          code: match.barcode || updatedPages[pageIndex].rows[rowIndex].code,
          description: match.name,
          selling_price: match.selling_price,
          price: match.cost_price,
        }
        setAutoFillMessages({ ...autoFillMessages, [`${pageIndex}-${rowIndex}`]: `Auto-filled: ${match.name}` })
        setTimeout(() => {
          setAutoFillMessages(prev => { const u = { ...prev }; delete u[`${pageIndex}-${rowIndex}`]; return u })
        }, 3000)
      }
    }
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
    const price = parseFloat(row.price) || 0
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
    const activeRows = getAllRows().filter(r => r.description && r.price && r.quantity)
    const lineDiscountTotal = activeRows.reduce((sum, r) => {
      const gross = (parseFloat(r.price) || 0) * (parseFloat(r.quantity) || 0)
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
    if (!supplierName) { 
      setMessage('Please enter supplier name!'); 
      setMessageType('error'); 
      return 
    }
    const activeRows = getAllRows().filter(r => r.description && r.price && r.quantity)
    if (activeRows.length === 0) { 
      setMessage('Please add at least one product!'); 
      setMessageType('error'); 
      return 
    }

    setSaving(true)
    const { lineDiscountTotal, totalExclusive, totalVAT, total } = getSummary()

    await saveSupplier({ name: supplierName, contact: supplierContact, email: supplierEmail })

    const purchaseData = {
      supplier_name: supplierName,
      supplier_contact: supplierContact,
      supplier_email: supplierEmail,
      invoice_number: invoiceNumber,
      notes,
      pending_payment: pendingPayment,
      discount_total: lineDiscountTotal,
      items: activeRows.map(r => ({
        barcode: r.code,
        name: r.description,
        quantity: parseFloat(r.quantity) || 0,
        cost_price: parseFloat(r.price) || 0,
        selling_price: parseFloat(r.selling_price) || 0,
        vat_included: r.vat_included,
        discount: parseFloat(r.discount) || 0,
        line_total: getLineTotalWithVAT(r),
      })),
      total_excluding_vat: totalExclusive,
      total_vat: totalVAT,
      total_including_vat: total,
    }

    let error
    if (editingInvoice) {
      const { error: updateError } = await supabase.from('purchases').update(purchaseData).eq('id', editingInvoice.id)
      error = updateError
    } else {
      error = await savePurchase(purchaseData)
    }

    if (error) { 
      setMessage('Error saving: ' + error.message); 
      setMessageType('error'); 
      setSaving(false); 
      return 
    }

    // === FIXED INVENTORY UPDATE SECTION ===
    // Add/update products in inventory
    const currentProducts = await getProducts()
    for (const r of activeRows) {
      if (!r.description) continue

      const existing = currentProducts.find(e =>
        e.barcode === r.code || e.name.toLowerCase() === r.description.toLowerCase()
      )

      let newStock
      if (editingInvoice) {
        // Find the original quantity for this product in the old invoice
        const originalItem = editingInvoice.items.find(i =>
          i.barcode === r.code || i.name.toLowerCase() === r.description.toLowerCase()
        )
        const oldQty = originalItem ? parseFloat(originalItem.quantity) || 0 : 0
        const newQty = parseFloat(r.quantity) || 0
        const diff = newQty - oldQty
        // Only adjust by the difference when editing
        newStock = existing ? existing.stock + diff : newQty
      } else {
        // Normal behavior for new purchases
        newStock = existing
          ? existing.stock + (parseFloat(r.quantity) || 0)
          : parseFloat(r.quantity) || 0
      }

      await saveProduct({
        barcode: r.code || existing?.barcode || `GEN-${Date.now()}-${Math.random()}`,
        name: r.description,
        cost_price: parseFloat(r.price) || 0,
        selling_price: parseFloat(r.selling_price) || existing?.selling_price || parseFloat(r.price) * 1.3,
        stock: Math.max(0, newStock),
        low_stock_alert: existing?.low_stock_alert || 5,
      })
    }

    setMessage(editingInvoice ? 'Invoice updated successfully!' : 'Purchase invoice saved!')
    setMessageType('success')
    setSupplierName(''); setSupplierContact(''); setSupplierEmail('')
    setInvoiceNumber(''); setNotes(''); setPendingPayment(false)
    setPages([emptyPage(1)])
    if (onClearEdit) onClearEdit()
    fetchSuppliers(); fetchExistingProducts()
    setSaving(false)
  }

  function downloadPDF() {
    const { lineDiscountTotal, totalExclusive, totalVAT, total } = getSummary()
    const activeRows = getAllRows().filter(r => r.description && r.price && r.quantity)
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    doc.setFillColor(26, 26, 46)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('PURCHASE INVOICE', pageWidth / 2, 15, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice No: ${invoiceNumber || '—'}   Date: ${invoiceDate}`, pageWidth / 2, 25, { align: 'center' })

    doc.setTextColor(50, 50, 50)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(supplierName || 'Supplier Name', 14, 45)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    let yPos = 52
    if (supplierContact) { doc.text(supplierContact, 14, yPos); yPos += 7 }
    if (supplierEmail) { doc.text(supplierEmail, 14, yPos); yPos += 7 }
    if (notes) { doc.text(`Notes: ${notes}`, 14, yPos) }

    autoTable(doc, {
      startY: 72,
      head: [['Code', 'Description', 'Qty', 'Cost Price', 'Selling Price', 'Discount %', 'VAT', 'Total']],
      body: activeRows.map(r => [
        r.code || '—', r.description, r.quantity,
        `P${parseFloat(r.price || 0).toFixed(2)}`,
        `P${parseFloat(r.selling_price || 0).toFixed(2)}`,
        r.discount ? `${r.discount}%` : '0%',
        r.vat_included ? 'Incl.' : 'Excl.',
        `P${getLineTotalWithVAT(r).toFixed(2)}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    })

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

    doc.save(`purchase-invoice-${invoiceNumber || 'draft'}.pdf`)
  }

  const { lineDiscountTotal, totalExclusive, totalVAT, total } = getSummary()

  return (
    <div className="purchase-page">
      <div className="purchase-actions no-print">
        <div className="purchase-actions-left">
          <h2>{editingInvoice ? 'Edit Invoice' : 'Purchase Invoice'}</h2>
        </div>
        <div className="purchase-actions-right">
          {editingInvoice && (
            <button className="btn-secondary" onClick={() => { 
              if (onClearEdit) onClearEdit(); 
              setSupplierName(''); setSupplierContact(''); setSupplierEmail(''); 
              setInvoiceNumber(''); setNotes(''); setPendingPayment(false); 
              setPages([emptyPage(1)]); setMessage('') 
            }}>
              Cancel Edit
            </button>
          )}
          <label className="checkbox-label pending-checkbox">
            <input type="checkbox" checked={pendingPayment} onChange={e => setPendingPayment(e.target.checked)} />
            <span>Pending Payment</span>
          </label>
          <button className="btn-secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </button>
          <button className="btn-secondary" onClick={downloadPDF}>
            <Download size={15} /> Download PDF
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Save Invoice'}
          </button>
        </div>
      </div>

      {message && <p className={`message ${messageType} no-print`}>{message}</p>}

      {pages.map((page, pageIndex) => (
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
              <h1 className="invoice-title">PURCHASE INVOICE</h1>
              {pageIndex > 0 && <p style={{ color: '#888', fontSize: '0.85rem' }}>Continued — Page {pageIndex + 1}</p>}

              <div className="invoice-field" onDoubleClick={() => setEditingCell('supplierName')}>
                {editingCell === 'supplierName' ? (
                  <div style={{ position: 'relative' }}>
                    <input autoFocus className="invoice-input" placeholder="Supplier Name *"
                      value={supplierName}
                      onChange={e => handleSupplierInput(e.target.value)}
                      onBlur={() => setTimeout(() => { setShowSuggestions(false); setEditingCell(null) }, 150)} />
                    {showSuggestions && filteredSuppliers.length > 0 && (
                      <div className="autocomplete-dropdown">
                        {filteredSuppliers.map(s => (
                          <div key={s.id} className="autocomplete-item" onMouseDown={() => selectSupplier(s)}>
                            <span className="autocomplete-name">{s.name}</span>
                            {s.contact && <span className="autocomplete-sub">{s.contact}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={`invoice-value bold ${!supplierName ? 'placeholder' : ''}`}>
                    {supplierName || 'Double-click to enter supplier name'}
                  </span>
                )}
              </div>

              <div className="invoice-field" onDoubleClick={() => setEditingCell('supplierContact')}>
                {editingCell === 'supplierContact' ? (
                  <input autoFocus className="invoice-input" placeholder="Contact number"
                    value={supplierContact} onChange={e => setSupplierContact(e.target.value)}
                    onBlur={() => setEditingCell(null)} />
                ) : (
                  <span className={`invoice-value ${!supplierContact ? 'placeholder' : ''}`}>
                    {supplierContact || 'Double-click to enter contact'}
                  </span>
                )}
              </div>

              <div className="invoice-field" onDoubleClick={() => setEditingCell('supplierEmail')}>
                {editingCell === 'supplierEmail' ? (
                  <input autoFocus className="invoice-input" placeholder="Email address"
                    value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)}
                    onBlur={() => setEditingCell(null)} />
                ) : (
                  <span className={`invoice-value ${!supplierEmail ? 'placeholder' : ''}`}>
                    {supplierEmail || 'Double-click to enter email'}
                  </span>
                )}
              </div>
            </div>

            <div className="invoice-meta">
              <div className="invoice-meta-row">
                <span className="invoice-meta-label">Invoice No:</span>
                <div className="invoice-field" onDoubleClick={() => setEditingCell('invoiceNumber')}>
                  {editingCell === 'invoiceNumber' ? (
                    <input autoFocus className="invoice-input" placeholder="INV-001"
                      value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                      onBlur={() => setEditingCell(null)} />
                  ) : (
                    <span className={`invoice-value ${!invoiceNumber ? 'placeholder' : ''}`}>
                      {invoiceNumber || 'INV-001'}
                    </span>
                  )}
                </div>
              </div>
              <div className="invoice-meta-row">
                <span className="invoice-meta-label">Date:</span>
                <span className="invoice-value">{invoiceDate}</span>
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
                  <th>Code</th><th>Description</th><th>Qty</th>
                  <th>Cost Price</th><th>Selling Price</th><th>Discount %</th>
                  <th>VAT Incl.</th><th>Total</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, rowIndex) => (
                  <>
                    <tr key={rowIndex} className="invoice-row">
                      <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-code`)}>
                        {editingCell === `${pageIndex}-${rowIndex}-code` ? (
                          <input autoFocus className="invoice-cell-input" value={row.code}
                            onChange={e => updateRow(pageIndex, rowIndex, 'code', e.target.value)}
                            onBlur={() => setEditingCell(null)} />
                        ) : <span className={!row.code ? 'cell-placeholder' : ''}>{row.code || '—'}</span>}
                      </td>
                      <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-description`)}>
                        {editingCell === `${pageIndex}-${rowIndex}-description` ? (
                          <input autoFocus className="invoice-cell-input wide" value={row.description}
                            onChange={e => updateRow(pageIndex, rowIndex, 'description', e.target.value)}
                            onBlur={() => setEditingCell(null)} />
                        ) : <span className={!row.description ? 'cell-placeholder' : ''}>{row.description || 'Double-click to edit'}</span>}
                      </td>
                      <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-quantity`)}>
                        {editingCell === `${pageIndex}-${rowIndex}-quantity` ? (
                          <input autoFocus className="invoice-cell-input narrow" type="number" value={row.quantity}
                            onChange={e => updateRow(pageIndex, rowIndex, 'quantity', e.target.value)}
                            onBlur={() => setEditingCell(null)} />
                        ) : <span className={!row.quantity ? 'cell-placeholder' : ''}>{row.quantity || '0'}</span>}
                      </td>
                      <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-price`)}>
                        {editingCell === `${pageIndex}-${rowIndex}-price` ? (
                          <input autoFocus className="invoice-cell-input narrow" type="number" value={row.price}
                            onChange={e => updateRow(pageIndex, rowIndex, 'price', e.target.value)}
                            onBlur={() => setEditingCell(null)} />
                        ) : <span className={!row.price ? 'cell-placeholder' : ''}>{row.price ? `P${parseFloat(row.price).toFixed(2)}` : '0.00'}</span>}
                      </td>
                      <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-selling_price`)}>
                        {editingCell === `${pageIndex}-${rowIndex}-selling_price` ? (
                          <input autoFocus className="invoice-cell-input narrow" type="number" value={row.selling_price}
                            onChange={e => updateRow(pageIndex, rowIndex, 'selling_price', e.target.value)}
                            onBlur={() => setEditingCell(null)} />
                        ) : <span className={!row.selling_price ? 'cell-placeholder' : ''}>{row.selling_price ? `P${parseFloat(row.selling_price).toFixed(2)}` : '0.00'}</span>}
                      </td>
                      <td onDoubleClick={() => setEditingCell(`${pageIndex}-${rowIndex}-discount`)}>
                        {editingCell === `${pageIndex}-${rowIndex}-discount` ? (
                          <input autoFocus className="invoice-cell-input narrow" type="number" value={row.discount}
                            onChange={e => updateRow(pageIndex, rowIndex, 'discount', e.target.value)}
                            onBlur={() => setEditingCell(null)} />
                        ) : <span>{row.discount ? `${row.discount}%` : '0%'}</span>}
                      </td>
                      <td className="vat-cell">
                        <input type="checkbox" checked={row.vat_included}
                          onChange={e => updateRow(pageIndex, rowIndex, 'vat_included', e.target.checked)} />
                      </td>
                      <td className="total-cell">
                        {row.description && row.price && row.quantity ? `P${getLineTotalWithVAT(row).toFixed(2)}` : '—'}
                      </td>
                      <td className="row-action no-print">
                        <button className="remove-btn" onClick={() => removeRow(pageIndex, rowIndex)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                    {autoFillMessages[`${pageIndex}-${rowIndex}`] && (
                      <tr key={`${rowIndex}-msg`} className="no-print">
                        <td colSpan="9">
                          <p style={{ color: '#2d8a4e', fontSize: '0.78rem', padding: '2px 8px', background: '#f0fff4', borderRadius: '4px' }}>
                            ✓ {autoFillMessages[`${pageIndex}-${rowIndex}`]}
                          </p>
                        </td>
                      </tr>
                    )}
                  </>
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

      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
        <button className="add-row-btn" style={{ maxWidth: '300px' }} onClick={addPage}>
          <Plus size={16} /> Add Another Page
        </button>
      </div>
    </div>
  )
}

export default Purchase