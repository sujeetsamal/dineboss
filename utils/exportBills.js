// Root-level exportBills implementation

function createdAtToDate(v) {
  if (!v) return null
  try {
    if (typeof v.toDate === 'function') return v.toDate()
    if (v instanceof Date) return v
    return new Date(v)
  } catch {
    return null
  }
}

function safeValue(v) {
  if (v == null) return ''
  return String(v).replace(/,/g, ';')
}

export function ordersToCSV(orders) {
  const header = ['Order ID', 'Table', 'Items', 'Subtotal', 'Discount', 'GST', 'Service Charge', 'Total', 'Payment Method', 'Payment Status', 'Date'].join(',')
  const rows = orders.map((o) => {
    const id = o.id || ''
    const table = o.tableNumber != null ? o.tableNumber : ''
    const created = createdAtToDate(o.createdAt)
    const createdStr = created ? created.toLocaleString() : ''
    
    // Calculate totals
    const subtotal = Number(o.total || 0)
    const discount = Number(o.discount || 0)
    const gstPercent = Number(o.gstPercent || 0)
    const gstAmount = Math.round(subtotal * (gstPercent / 100))
    const serviceChargePercent = Number(o.serviceChargePercent || 0)
    const serviceChargeAmount = Math.round(subtotal * (serviceChargePercent / 100))
    const finalTotal = subtotal + gstAmount + serviceChargeAmount - discount
    
    const items = Array.isArray(o.items) && o.items.length > 0
      ? o.items.map((it) => `${it.quantity}x ${it.name || ''}`).join('; ')
      : ''
    const paymentMethod = o.paymentMethod || 'Cash'
    const paymentStatus = o.paymentStatus || 'unpaid'
    
    return [id, table, items, subtotal.toFixed(0), discount.toFixed(0), gstAmount.toFixed(0), serviceChargeAmount.toFixed(0), finalTotal.toFixed(0), paymentMethod, paymentStatus, createdStr].map(safeValue).join(',')
  })
  return [header, ...rows].join('\n')
}

export function ordersToHTMLForPDF(orders) {
  const header = `<tr><th>OrderID</th><th>CreatedAt</th><th>Table</th><th>Total</th><th>Status</th><th>Items</th></tr>`
  const rows = orders.map((o) => {
    const id = o.id || ''
    const created = createdAtToDate(o.createdAt)
    const createdStr = created ? created.toLocaleString() : ''
    const table = o.tableNumber != null ? o.tableNumber : ''
    const total = o.total != null ? o.total : ''
    const status = o.status || ''
    const items = Array.isArray(o.items) && o.items.length > 0
      ? o.items.map((i) => i.name || (typeof i === 'string' ? i : '')).join('; ')
      : ''
    return `<tr><td>${escapeHTML(id)}</td><td>${escapeHTML(createdStr)}</td><td>${escapeHTML(table)}</td><td>${escapeHTML(String(total))}</td><td>${escapeHTML(status)}</td><td>${escapeHTML(items)}</td></tr>`
  }).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Bill History</title><style>table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-family: Arial, sans-serif;font-size:12px}th{background:#f5f5f5}</style></head><body><h2>Bill History</h2><table>${header}${rows}</table></body></html>`
}

function escapeHTML(s) {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
