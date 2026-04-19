import { useState, useEffect } from 'react'
import { useLogo } from "../../lib/useLogo";

const VAT_RATE = 0.14

function ReceiptPreview({ items, subtotal, vatAmount, discountAmount, discountPercent, total, onClose, onConfirm }) {
  const [editableItems, setEditableItems] = useState(items.map(i => ({ ...i })))
  const [storeName, setStoreName] = useState(localStorage.getItem('storeName') || 'MY SHOP')
  const [storeAddress, setStoreAddress] = useState(localStorage.getItem('storeAddress') || '123 Main Street, City')
  const [vatRegNo, setVatRegNo] = useState(localStorage.getItem('vatRegNo') || '00000000')
  const [editingField, setEditingField] = useState(null)
  const [printed, setPrinted] = useState(false)
  const { logoUrl: receiptLogoUrl, logoShape: receiptLogoShape } = useLogo('receipt')

  function updateItem(index, field, value) {
    const updated = [...editableItems]
    updated[index] = { ...updated[index], [field]: value }
    setEditableItems(updated)
  }

  function removeItem(index) { setEditableItems(editableItems.filter((_, i) => i !== index)) }

  function getEditableSubtotal() { return editableItems.reduce((sum, i) => sum + (parseFloat(i.selling_price) * parseInt(i.qty)), 0) }
  function getEditableVAT() { return getEditableSubtotal() * VAT_RATE }
  function getEditableDiscount() { return (getEditableSubtotal() + getEditableVAT()) * ((discountPercent || 0) / 100) }
  function getEditableTotal() { return getEditableSubtotal() + getEditableVAT() - getEditableDiscount() }

  function handlePrint() {
    // Build a new window with just the receipt content
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    const logoHtml = receiptLogoUrl
      ? `<img src="${receiptLogoUrl}" style="width:${receiptLogoShape === 'rectangle' ? '120px' : '70px'};height:${receiptLogoShape === 'rectangle' ? '45px' : '70px'};object-fit:contain;margin-bottom:6px;" />`
      : ''

    const itemsHtml = editableItems.map(item => `
      <tr>
        <td style="padding:4px 2px">${item.qty}</td>
        <td style="padding:4px 2px">${item.name}${item.serial_number ? `<br><small style="color:#888">S/N: ${item.serial_number}</small>` : ''}</td>
        <td style="padding:4px 2px;text-align:right">P${parseFloat(item.selling_price).toFixed(2)}</td>
        <td style="padding:4px 2px;text-align:right">P${(parseFloat(item.selling_price) * parseInt(item.qty)).toFixed(2)}</td>
      </tr>
    `).join('')

    const sub = getEditableSubtotal()
    const vat = getEditableVAT()
    const disc = getEditableDiscount()
    const tot = getEditableTotal()
    const now = new Date()

    const discountHtml = disc > 0 ? `
      <tr><td colspan="2" style="padding:2px 0;color:#2d8a4e">Discount (${discountPercent}%):</td><td colspan="2" style="text-align:right;color:#2d8a4e">- P${disc.toFixed(2)}</td></tr>
    ` : ''

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            width: 80mm;
            margin: 0 auto;
            padding: 4mm;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .store-name { font-size: 14px; font-weight: bold; letter-spacing: 2px; margin: 4px 0; }
          .store-address { font-size: 10px; color: #555; }
          .date { font-size: 9px; color: #888; margin-top: 3px; }
          .divider { border-top: 1px dashed #999; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding: 3px 2px; text-align: left; }
          th:last-child, td:last-child { text-align: right; }
          th:nth-child(3), td:nth-child(3) { text-align: right; }
          .totals { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #999; }
          .totals-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 10px; }
          .totals-row.vat { color: #c47000; }
          .totals-row.total { font-size: 13px; font-weight: bold; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
          .footer { text-align: center; margin-top: 10px; font-size: 9px; color: #666; }
          @media print {
            body { width: 80mm; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoHtml}
          <div class="store-name">${storeName}</div>
          <div class="store-address">${storeAddress}</div>
          <div class="date">${now.toLocaleDateString()} | ${now.toLocaleTimeString()}</div>
        </div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th>Qty</th><th>Item</th><th>Price</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Subtotal (excl. VAT):</span><span>P${sub.toFixed(2)}</span></div>
          <div class="totals-row vat"><span>VAT (14%):</span><span>P${vat.toFixed(2)}</span></div>
          ${disc > 0 ? `<div class="totals-row" style="color:#2d8a4e"><span>Discount (${discountPercent}%):</span><span>- P${disc.toFixed(2)}</span></div>` : ''}
          <div class="totals-row total"><span>TOTAL (incl. VAT):</span><span>P${tot.toFixed(2)}</span></div>
        </div>
        <div class="divider"></div>
        <div class="footer">
          <p>VAT Reg No: ${vatRegNo}</p>
          <p>Thank you for your purchase!</p>
          <p>Please come again</p>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 500)
    setPrinted(true)
  }

  const now = new Date()
  const editableSubtotal = getEditableSubtotal()
  const editableVAT = getEditableVAT()
  const editableDiscount = getEditableDiscount()
  const editableTotal = getEditableTotal()

  return (
    <div className="receipt-overlay">
      <div className="receipt-preview-container">
        <div className="receipt-actions">
          <h2>Receipt Preview</h2>
          <p className="hint">
            {!printed
              ? 'Review and edit, then print. Complete Sale appears after printing.'
              : 'Receipt printed! Click Complete Sale to finalize.'}
          </p>
          <div className="receipt-action-buttons">
            <button className="btn-primary" onClick={handlePrint}>
              {printed ? 'Print Again' : 'Print Receipt'}
            </button>
            {printed && (
              <button
                className="btn-secondary"
                style={{ background: '#f0fff4', color: '#2d8a4e', border: '2px solid #2d8a4e' }}
                onClick={() => onConfirm(editableItems)}
              >
                Complete Sale
              </button>
            )}
            <button className="btn-danger" onClick={onClose}>Cancel</button>
          </div>
          {!printed && (
            <p style={{ fontSize: '0.8rem', color: '#e67e00', marginTop: '8px' }}>
              Print the receipt first before completing the sale.
            </p>
          )}
        </div>

        <div className="receipt-paper">
          <div className="receipt-header">
            {receiptLogoUrl && (
              <img
                src={receiptLogoUrl}
                alt="Store Logo"
                className={`store-logo ${receiptLogoShape === 'rectangle' ? 'logo-rect' : 'logo-square'}`}
              />
            )}
            {editingField === 'storeName' ? (
              <input autoFocus value={storeName} onChange={e => setStoreName(e.target.value)}
                onBlur={() => setEditingField(null)} className="edit-input centered" />
            ) : (
              <h3 className="store-name">
                {storeName}
                <button className="pencil-btn" onClick={() => setEditingField('storeName')}>✏️</button>
              </h3>
            )}
            {editingField === 'storeAddress' ? (
              <input autoFocus value={storeAddress} onChange={e => setStoreAddress(e.target.value)}
                onBlur={() => setEditingField(null)} className="edit-input centered" />
            ) : (
              <p className="store-address">
                {storeAddress}
                <button className="pencil-btn" onClick={() => setEditingField('storeAddress')}>✏️</button>
              </p>
            )}
            <p className="receipt-date">{now.toLocaleDateString()} | {now.toLocaleTimeString()}</p>
            <hr />
          </div>

          <table className="receipt-table">
            <thead>
              <tr><th>Qty</th><th>Product</th><th>Price</th><th>Total</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {editableItems.map((item, index) => (
                <tr key={index}>
                  <td>
                    {editingField === `qty-${index}` ? (
                      <input autoFocus type="number" value={item.qty}
                        onChange={e => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                        onBlur={() => setEditingField(null)} className="edit-input small" />
                    ) : (
                      <span>{item.qty}<button className="pencil-btn" onClick={() => setEditingField(`qty-${index}`)}>✏️</button></span>
                    )}
                  </td>
                  <td>
                    {editingField === `name-${index}` ? (
                      <input autoFocus type="text" value={item.name}
                        onChange={e => updateItem(index, 'name', e.target.value)}
                        onBlur={() => setEditingField(null)} className="edit-input" />
                    ) : (
                      <span>
                        {item.name}
                        {item.serial_number && <div style={{ fontSize: '0.7rem', color: '#888' }}>S/N: {item.serial_number}</div>}
                        <button className="pencil-btn" onClick={() => setEditingField(`name-${index}`)}>✏️</button>
                      </span>
                    )}
                  </td>
                  <td>
                    {editingField === `price-${index}` ? (
                      <input autoFocus type="number" value={item.selling_price}
                        onChange={e => updateItem(index, 'selling_price', parseFloat(e.target.value) || 0)}
                        onBlur={() => setEditingField(null)} className="edit-input small" />
                    ) : (
                      <span>P{parseFloat(item.selling_price).toFixed(2)}<button className="pencil-btn" onClick={() => setEditingField(`price-${index}`)}>✏️</button></span>
                    )}
                  </td>
                  <td>P{(parseFloat(item.selling_price) * parseInt(item.qty)).toFixed(2)}</td>
                  <td><button className="remove-btn" onClick={() => removeItem(index)}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-totals">
            <div className="totals-row"><span>Subtotal (excl. VAT):</span><span>P{editableSubtotal.toFixed(2)}</span></div>
            <div className="totals-row" style={{ color: '#e67e00' }}><span>VAT (14%):</span><span>P{editableVAT.toFixed(2)}</span></div>
            {editableDiscount > 0 && (
              <div className="totals-row discount">
                <span>Discount ({discountPercent}%):</span>
                <span>- P{editableDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="totals-row total">
              <strong>TOTAL (incl. VAT):</strong>
              <strong>P{editableTotal.toFixed(2)}</strong>
            </div>
          </div>

          <div className="receipt-footer">
            <hr />
            {editingField === 'vatRegNo' ? (
              <input autoFocus value={vatRegNo} onChange={e => setVatRegNo(e.target.value)}
                onBlur={() => setEditingField(null)} className="edit-input centered" />
            ) : (
              <p>VAT Reg No: {vatRegNo} <button className="pencil-btn" onClick={() => setEditingField('vatRegNo')}>✏️</button></p>
            )}
            <p>Thank you for your purchase!</p>
            <p>Please come again</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReceiptPreview