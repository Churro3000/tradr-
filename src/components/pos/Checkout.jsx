import { useState, useEffect, useRef } from 'react'
import { supabase, saveSale, updateStock } from "../../lib/supabase";
import ReceiptPreview from './ReceiptPreview'
import { Scan, Trash2, Plus, Minus, Tag, RotateCcw, Receipt } from 'lucide-react'

const VAT_RATE = 0.14

function Checkout() {
  const [barcode, setBarcode] = useState('')
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [discountInput, setDiscountInput] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const barcodeRef = useRef(null)

  useEffect(() => { barcodeRef.current.focus() }, [])

  async function handleBarcodeScan(e) {
    if (e.key === 'Enter') {
      const scannedCode = barcode.trim()
      if (!scannedCode) return

      const { data, error } = await supabase
        .from('products').select('*').eq('barcode', scannedCode).single()

      if (error || !data) {
        setMessage(`Barcode "${scannedCode}" not found!`)
        setMessageType('error')
      } else if (data.stock <= 0) {
        setMessage(`"${data.name}" is out of stock!`)
        setMessageType('error')
      } else {
        const existing = items.find(i => i.barcode === scannedCode)
        if (existing) {
          setItems(items.map(i => i.barcode === scannedCode ? { ...i, qty: i.qty + 1 } : i))
        } else {
          setItems([...items, { ...data, qty: 1 }])
        }
        setMessage(`Added: ${data.name}`)
        setMessageType('success')
      }
      setBarcode('')
      barcodeRef.current.focus()
    }
  }

  function removeItem(barcode) { setItems(items.filter(i => i.barcode !== barcode)) }

  function updateQty(barcode, qty) {
    if (qty < 1) return
    setItems(items.map(i => i.barcode === barcode ? { ...i, qty } : i))
  }

  function getSubtotal() { return items.reduce((sum, i) => sum + (i.selling_price * i.qty), 0) }
  function getVATAmount() { return getSubtotal() * VAT_RATE }
  function getDiscountAmount() { return (getSubtotal() + getVATAmount()) * (discountPercent / 100) }
  function getTotal() { return getSubtotal() + getVATAmount() - getDiscountAmount() }

  function applyDiscount() {
    const val = parseFloat(discountInput)
    if (isNaN(val) || val < 0 || val > 100) {
      setMessage('Please enter a valid discount between 0 and 100')
      setMessageType('error')
      return
    }
    setDiscountPercent(val)
    setMessage(`${val}% discount applied!`)
    setMessageType('success')
  }

  async function handleConfirmSale(editedItems) {
    const subtotal = editedItems.reduce((sum, i) => sum + (i.selling_price * i.qty), 0)
    const vatAmount = subtotal * VAT_RATE
    const subtotalWithVAT = subtotal + vatAmount
    const discountAmount = subtotalWithVAT * (discountPercent / 100)
    const total = subtotalWithVAT - discountAmount
    const profit = editedItems.reduce((sum, i) => sum + ((i.selling_price - i.cost_price) * i.qty), 0) - discountAmount

    const sale = {
      items: editedItems.map(i => ({
        barcode: i.barcode, name: i.name, qty: i.qty,
        cost_price: i.cost_price, selling_price: i.selling_price,
        serial_number: i.serial_number || null,
      })),
      subtotal, vat_amount: vatAmount,
      discount_amount: discountAmount, total, profit,
    }

    const error = await saveSale(sale)
    if (error) { setMessage('Error saving sale: ' + error.message); setMessageType('error'); return }

    for (const item of editedItems) {
      const original = items.find(i => i.barcode === item.barcode)
      if (original) await updateStock(original.id, original.stock - item.qty)
    }

    setItems([])
    setDiscountPercent(0)
    setDiscountInput('')
    setShowPreview(false)
    setMessage('Sale completed successfully!')
    setMessageType('success')
    barcodeRef.current.focus()
  }

  const subtotal = getSubtotal()
  const vatAmount = getVATAmount()
  const discountAmount = getDiscountAmount()
  const total = getTotal()

  return (
    <div className="panel">
      <h2>Checkout</h2>
      <p className="hint">Scan items to add them to the receipt.</p>

      <div className="scan-wrap">
        <Scan size={18} className="scan-icon" />
        <input
          ref={barcodeRef}
          type="text"
          placeholder="Scan barcode here..."
          value={barcode}
          onChange={e => setBarcode(e.target.value)}
          onKeyDown={handleBarcodeScan}
          className="scan-input"
        />
      </div>

      {message && <p className={`message ${messageType}`}>{message}</p>}

      {items.length === 0 ? (
        <p className="empty">No items yet — start scanning!</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.barcode}>
                  <td>
                    {item.name}
                    {item.serial_number && <div style={{ fontSize: '0.75rem', color: '#888' }}>S/N: {item.serial_number}</div>}
                  </td>
                  <td>
                    <div className="qty-control">
                      <button onClick={() => updateQty(item.barcode, item.qty - 1)}><Minus size={12} /></button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(item.barcode, item.qty + 1)}><Plus size={12} /></button>
                    </div>
                  </td>
                  <td>P{parseFloat(item.selling_price).toFixed(2)}</td>
                  <td>P{(item.selling_price * item.qty).toFixed(2)}</td>
                  <td><button className="remove-btn" onClick={() => removeItem(item.barcode)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals-summary">
            <div className="totals-row">
              <span>Subtotal (excl. VAT):</span>
              <span>P{subtotal.toFixed(2)}</span>
            </div>
            <div className="totals-row" style={{ color: '#e67e00' }}>
              <span>VAT (14%):</span>
              <span>P{vatAmount.toFixed(2)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="totals-row discount">
                <span>Discount ({discountPercent}%):</span>
                <span>- P{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="totals-row total">
              <strong>TOTAL (incl. VAT):</strong>
              <strong>P{total.toFixed(2)}</strong>
            </div>
          </div>

          <div className="discount-row">
            <Tag size={16} style={{ color: '#888', flexShrink: 0 }} />
            <input
              type="number"
              placeholder="Discount % (e.g. 5)"
              value={discountInput}
              min="0"
              max="100"
              onChange={e => setDiscountInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyDiscount()}
            />
            <button onClick={applyDiscount}>Apply</button>
            {discountPercent > 0 && (
              <button className="btn-danger" onClick={() => { setDiscountPercent(0); setDiscountInput('') }}>
                Clear
              </button>
            )}
          </div>

          <div className="actions">
            <button className="btn-primary" onClick={() => setShowPreview(true)}>
              <Receipt size={16} /> Review & Print Receipt
            </button>
            <button className="btn-secondary" onClick={() => {
              setItems([]); setDiscountPercent(0); setDiscountInput(''); setMessage(''); barcodeRef.current.focus()
            }}>
              <RotateCcw size={16} /> New Sale
            </button>
          </div>
        </>
      )}

      {showPreview && (
        <ReceiptPreview
          items={items}
          subtotal={subtotal}
          vatAmount={vatAmount}
          discountAmount={discountAmount}
          discountPercent={discountPercent}
          total={total}
          onClose={() => setShowPreview(false)}
          onConfirm={handleConfirmSale}
        />
      )}
    </div>
  )
}

export default Checkout