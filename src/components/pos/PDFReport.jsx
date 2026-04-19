import { useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getSales } from "../../lib/supabase";

function PDFReport() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [period, setPeriod] = useState('custom')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  function setQuickPeriod(type) {
    const now = new Date()
    let start, end

    if (type === 'today') {
      start = new Date(now.setHours(0,0,0,0))
      end = new Date()
    } else if (type === 'week') {
      start = new Date()
      start.setDate(start.getDate() - 7)
      end = new Date()
    } else if (type === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date()
    } else if (type === 'lastmonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end = new Date(now.getFullYear(), now.getMonth(), 0)
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    setPeriod(type)
  }

  async function generatePDF() {
    if (!startDate || !endDate) {
      setMessage('❌ Please select a date range first!')
      return
    }

    setGenerating(true)
    setMessage('')

    const allSales = await getSales()
    const start = new Date(startDate)
    start.setHours(0,0,0,0)
    const end = new Date(endDate)
    end.setHours(23,59,59,999)

    const filtered = allSales.filter(sale => {
      const date = new Date(sale.created_at)
      return date >= start && date <= end
    })

    if (filtered.length === 0) {
      setMessage('❌ No sales found for this period!')
      setGenerating(false)
      return
    }

    // Calculate summary
    const totalRevenue = filtered.reduce((sum, s) => sum + s.total, 0)
    const totalProfit = filtered.reduce((sum, s) => sum + s.profit, 0)
    const totalDiscount = filtered.reduce((sum, s) => sum + s.discount_amount, 0)
    const avgSale = totalRevenue / filtered.length
    const profitMargin = ((totalProfit / totalRevenue) * 100).toFixed(1)

    // Best sellers
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
      .slice(0, 10)

    // Create PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header
    doc.setFillColor(26, 26, 46)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('MY SHOP', pageWidth / 2, 15, { align: 'center' })
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Sales Report', pageWidth / 2, 23, { align: 'center' })
    doc.setFontSize(9)
    doc.text(`${startDate} to ${endDate}`, pageWidth / 2, 30, { align: 'center' })

    // Generated date
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 42, { align: 'right' })

    // Summary boxes
    doc.setTextColor(50, 50, 50)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', 14, 52)

    const summaryData = [
      ['Total Sales', filtered.length.toString()],
      ['Total Revenue', `P${totalRevenue.toFixed(2)}`],
      ['Total Profit', `P${totalProfit.toFixed(2)}`],
      ['Profit Margin', `${profitMargin}%`],
      ['Average Sale', `P${avgSale.toFixed(2)}`],
      ['Total Discounts Given', `P${totalDiscount.toFixed(2)}`],
    ]

    autoTable(doc, {
      startY: 56,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    })

    // Best sellers
    const afterSummary = doc.lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Best Selling Products', 14, afterSummary)

    autoTable(doc, {
      startY: afterSummary + 4,
      head: [['#', 'Product', 'Qty Sold', 'Revenue']],
      body: bestSellers.map(([name, data], i) => [
        i + 1,
        name,
        data.qty,
        `P${data.revenue.toFixed(2)}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })

    // All transactions
    const afterBest = doc.lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('All Transactions', 14, afterBest)

    autoTable(doc, {
      startY: afterBest + 4,
      head: [['Date & Time', 'Items', 'Subtotal', 'Discount', 'Total', 'Profit']],
      body: filtered.map(sale => [
        new Date(sale.created_at).toLocaleString(),
        sale.items.length,
        `P${parseFloat(sale.subtotal).toFixed(2)}`,
        sale.discount_amount > 0 ? `P${parseFloat(sale.discount_amount).toFixed(2)}` : '—',
        `P${parseFloat(sale.total).toFixed(2)}`,
        `P${parseFloat(sale.profit).toFixed(2)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    })

    // Footer on each page
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Page ${i} of ${pageCount} — MY SHOP Sales Report`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
    }

    // Save
    const filename = `sales-report-${startDate}-to-${endDate}.pdf`
    doc.save(filename)
    setMessage(`✅ Report downloaded: ${filename}`)
    setGenerating(false)
  }

  return (
    <div className="pdf-report">
      <h3>📄 Download Sales Report</h3>
      <p className="hint">Choose a period and download a full PDF report.</p>

      <div className="quick-periods">
        {[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'This Week' },
          { id: 'month', label: 'This Month' },
          { id: 'lastmonth', label: 'Last Month' },
        ].map(p => (
          <button
            key={p.id}
            className={period === p.id ? 'active' : ''}
            onClick={() => setQuickPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="date-range">
        <div className="form-group">
          <label>From</label>
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPeriod('custom') }}
          />
        </div>
        <div className="form-group">
          <label>To</label>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setPeriod('custom') }}
          />
        </div>
      </div>

      <button
        className="btn-primary full-width"
        onClick={generatePDF}
        disabled={generating}
      >
        {generating ? 'Generating...' : '⬇️ Download PDF Report'}
      </button>

      {message && (
        <p className={`message ${message.startsWith('❌') ? 'error' : 'success'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

export default PDFReport