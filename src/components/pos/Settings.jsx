import { useState, useEffect, useRef } from 'react'
import { supabase } from "../../lib/supabase";
import { Upload, Trash2, Image, Store } from 'lucide-react'

function Settings() {
  const [receiptLogo, setReceiptLogo] = useState(null)
  const [receiptLogoShape, setReceiptLogoShape] = useState('square')
  const [invoiceLogo, setInvoiceLogo] = useState(null)
  const [invoiceLogoShape, setInvoiceLogoShape] = useState('square')
  const [uploading, setUploading] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const [storeName, setStoreName] = useState(localStorage.getItem('storeName') || 'MY SHOP')
  const [storeAddress, setStoreAddress] = useState(localStorage.getItem('storeAddress') || '123 Main Street, City')
  const [vatRegNo, setVatRegNo] = useState(localStorage.getItem('vatRegNo') || '00000000')

  const receiptInputRef = useRef(null)
  const invoiceInputRef = useRef(null)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const { data: files } = await supabase.storage.from('logos').list('')

      // Receipt logo
      const receiptFile = files?.find(f => f.name.startsWith('receipt-logo'))
      if (receiptFile) {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(receiptFile.name)
        setReceiptLogo(urlData.publicUrl)
      } else {
        setReceiptLogo(null)
      }

      // Invoice logo
      const invoiceFile = files?.find(f => f.name.startsWith('invoice-logo'))
      if (invoiceFile) {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(invoiceFile.name)
        setInvoiceLogo(urlData.publicUrl)
      } else {
        setInvoiceLogo(null)
      }
    } catch (e) {
      console.error('Error loading logos:', e)
    }

    // Load shapes
    setReceiptLogoShape(localStorage.getItem('receiptLogoShape') || 'square')
    setInvoiceLogoShape(localStorage.getItem('invoiceLogoShape') || 'square')
  }

  async function uploadLogo(file, type) {
    if (!file) return

    setUploading(type)
    const timestamp = Date.now()
    const ext = file.name.split('.').pop().toLowerCase()
    const filename = `${type}-logo-${timestamp}.${ext}`   // ← This fixes the caching problem

    try {
      // 1. Delete any old logo for this type
      const { data: existing } = await supabase.storage.from('logos').list('')
      const oldFiles = existing?.filter(f => f.name.startsWith(`${type}-logo`)) || []
      if (oldFiles.length > 0) {
        await supabase.storage.from('logos').remove(oldFiles.map(f => f.name))
      }

      // 2. Upload new file with timestamp
      const { error } = await supabase.storage
        .from('logos')
        .upload(filename, file, { 
          upsert: true,
          contentType: file.type 
        })

      if (error) throw error

      // 3. Get the new public URL
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filename)

      if (type === 'receipt') {
        setReceiptLogo(urlData.publicUrl)
      } else {
        setInvoiceLogo(urlData.publicUrl)
      }

      setMessage(`${type === 'receipt' ? 'Receipt' : 'Invoice'} logo updated successfully!`)
      setMessageType('success')

      // Notify other components
      window.dispatchEvent(new CustomEvent('logoUpdated', { 
        detail: { type, url: urlData.publicUrl } 
      }))

      // Refresh the list so we see the new file
      await loadSettings()

    } catch (error) {
      console.error(error)
      setMessage('Upload failed: ' + (error.message || 'Unknown error'))
      setMessageType('error')
    }

    setUploading(null)
  }

  async function removeLogo(type) {
    if (!window.confirm('Remove this logo?')) return

    try {
      const { data: existing } = await supabase.storage.from('logos').list('')
      const oldFiles = existing?.filter(f => f.name.startsWith(`${type}-logo`)) || []

      if (oldFiles.length > 0) {
        await supabase.storage.from('logos').remove(oldFiles.map(f => f.name))
      }

      if (type === 'receipt') setReceiptLogo(null)
      else setInvoiceLogo(null)

      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { type, url: null } }))

      setMessage('Logo removed successfully!')
      setMessageType('success')

      await loadSettings()
    } catch (e) {
      setMessage('Error removing logo')
      setMessageType('error')
    }
  }

  function handleShapeChange(type, shape) {
    if (type === 'receipt') {
      setReceiptLogoShape(shape)
      localStorage.setItem('receiptLogoShape', shape)
    } else {
      setInvoiceLogoShape(shape)
      localStorage.setItem('invoiceLogoShape', shape)
    }
    window.dispatchEvent(new CustomEvent('logoShapeUpdated', { detail: { type, shape } }))
  }

  function saveStoreInfo() {
    localStorage.setItem('storeName', storeName)
    localStorage.setItem('storeAddress', storeAddress)
    localStorage.setItem('vatRegNo', vatRegNo)

    window.dispatchEvent(new CustomEvent('storeInfoUpdated', { 
      detail: { storeName, storeAddress, vatRegNo } 
    }))

    setMessage('Store information saved!')
    setMessageType('success')
  }

  return (
    <div className="panel">
      <h2>Settings</h2>
      <p className="hint">Configure your store details and logos.</p>

      {message && <p className={`message ${messageType}`}>{message}</p>}

      {/* Store Information section remains the same */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Store size={18} />
          <h3>Store Information</h3>
        </div>
        <p className="hint">This info appears on every printed receipt.</p>

        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div className="form-group full">
            <label>Store Name</label>
            <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="e.g. MY SHOP" />
          </div>
          <div className="form-group full">
            <label>Store Address</label>
            <input type="text" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} placeholder="e.g. 123 Main Street, Gaborone" />
          </div>
          <div className="form-group">
            <label>VAT Registration Number</label>
            <input type="text" value={vatRegNo} onChange={e => setVatRegNo(e.target.value)} placeholder="e.g. P03456789" />
          </div>
        </div>

        <button className="btn-primary" style={{ marginTop: '12px' }} onClick={saveStoreInfo}>
          Save Store Info
        </button>
      </div>

      {/* Receipt Logo */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Image size={18} />
          <h3>Receipt Logo</h3>
        </div>
        <p className="hint">Appears at the top of printed receipts.</p>

        <div className="logo-upload-area">
          {receiptLogo ? (
            <div className="logo-preview-wrap">
              <img src={receiptLogo} alt="Receipt Logo" className={`logo-preview ${receiptLogoShape === 'rectangle' ? 'logo-rect' : 'logo-square'}`} />
              <div className="logo-preview-actions">
                <button className="btn-secondary btn-small" onClick={() => receiptInputRef.current.click()}>
                  <Upload size={13} /> Replace
                </button>
                <button className="remove-btn" onClick={() => removeLogo('receipt')}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="logo-upload-placeholder" onClick={() => receiptInputRef.current.click()}>
              <Upload size={28} />
              <p>Click to upload receipt logo</p>
              <span>PNG, JPG recommended</span>
            </div>
          )}
          <input 
            ref={receiptInputRef} 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={e => uploadLogo(e.target.files[0], 'receipt')} 
          />
          {uploading === 'receipt' && <p className="hint">Uploading...</p>}
        </div>

        <div className="settings-toggle-row">
          <span>Shape:</span>
          <div className="shape-toggle">
            <button className={receiptLogoShape === 'square' ? 'active' : ''} onClick={() => handleShapeChange('receipt', 'square')}>Square</button>
            <button className={receiptLogoShape === 'rectangle' ? 'active' : ''} onClick={() => handleShapeChange('receipt', 'rectangle')}>Rectangle</button>
          </div>
        </div>
      </div>

      {/* Invoice Logo - same structure */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Image size={18} />
          <h3>Invoice & Quotation Logo</h3>
        </div>
        <p className="hint">Appears on Purchase invoices and Quotations.</p>

        <div className="logo-upload-area">
          {invoiceLogo ? (
            <div className="logo-preview-wrap">
              <img src={invoiceLogo} alt="Invoice Logo" className={`logo-preview ${invoiceLogoShape === 'rectangle' ? 'logo-rect' : 'logo-square'}`} />
              <div className="logo-preview-actions">
                <button className="btn-secondary btn-small" onClick={() => invoiceInputRef.current.click()}>
                  <Upload size={13} /> Replace
                </button>
                <button className="remove-btn" onClick={() => removeLogo('invoice')}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="logo-upload-placeholder" onClick={() => invoiceInputRef.current.click()}>
              <Upload size={28} />
              <p>Click to upload invoice/quotation logo</p>
              <span>PNG, JPG recommended</span>
            </div>
          )}
          <input 
            ref={invoiceInputRef} 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={e => uploadLogo(e.target.files[0], 'invoice')} 
          />
          {uploading === 'invoice' && <p className="hint">Uploading...</p>}
        </div>

        <div className="settings-toggle-row">
          <span>Shape:</span>
          <div className="shape-toggle">
            <button className={invoiceLogoShape === 'square' ? 'active' : ''} onClick={() => handleShapeChange('invoice', 'square')}>Square</button>
            <button className={invoiceLogoShape === 'rectangle' ? 'active' : ''} onClick={() => handleShapeChange('invoice', 'rectangle')}>Rectangle</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings