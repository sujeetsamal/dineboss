"use client";

import { useEffect, useMemo, useState } from 'react'
import { subscribeToBills } from '@/lib/firestore'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ordersToCSV, ordersToHTMLForPDF } from '@/utils/exportBills'

function dateStartEnd(range) {
  const now = new Date()
  let start, end
  switch (range) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999)
      break
    }
    case '7d': {
      start = new Date(now)
      start.setDate(now.getDate()-7)
      start.setHours(0,0,0,0)
      end = new Date(now)
      end.setHours(23,59,59,999)
      break
    }
    case '30d': {
      start = new Date(now)
      start.setDate(now.getDate()-30)
      start.setHours(0,0,0,0)
      end = new Date(now)
      end.setHours(23,59,59,999)
      break
    }
    case 'all': {
      start = new Date(0)
      end = new Date()
      end.setHours(23,59,59,999)
      break
    }
  }
  return { start, end }
}

export default function BillHistoryPage() {
  const { restaurantId } = useCurrentUser({ allowedRoles: ['admin'] })
  const [bills, setBills] = useState([])
  const [range, setRange] = useState('today')
  const [format, setFormat] = useState('CSV')

  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeToBills(restaurantId, setBills, (e) => console.error(e))
    return () => unsub()
  }, [restaurantId])

  const { start, end } = dateStartEnd(range)

  const mappedBills = useMemo(() => bills.map((b) => ({
    id: b.id,
    createdAt: b.createdAt,
    tableNumber: b.tableNumber ?? 0,
    total: Number(b.totalAmount ?? b.total ?? 0),
    items: b.items ?? [],
    status: b.status ?? 'paid'
  })), [bills])

  const onExport = () => {
    const dataForExport = mappedBills.filter((bb) => {
      const d = bb.createdAt ? new Date(bb.createdAt) : null
      if (!start || !end || !d) return true
      return d >= start && d <= end
    })
    if (format === 'CSV') {
      const csv = ordersToCSV(dataForExport)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bill_history.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      const html = ordersToHTMLForPDF(dataForExport)
      const w = window.open('', '_blank')
      w.document.write(html)
      w.document.close()
      w.print()
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900">
        <select className="bg-black border border-gray-700 rounded px-2 py-1" value={range} onChange={(e)=>setRange(e.target.value)}>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 1 month</option>
          <option value="all">All time</option>
        </select>
        <select className="bg-black border border-gray-700 rounded px-2 py-1" value={format} onChange={(e)=>setFormat(e.target.value)}>
          <option>CSV</option>
          <option>PDF</option>
        </select>
        <button className="btn-gold" onClick={onExport}>Export</button>
      </div>
      <div className="p-4">
        <table className="w-full text-left text-sm" style={{ color: 'white', borderCollapse: 'collapse' }}>
          <thead><tr><th className="p-2 border-b border-gray-700">Bill</th><th className="p-2 border-b border-gray-700">Table</th><th className="p-2 border-b border-gray-700">Total</th><th className="p-2 border-b border-gray-700">Created</th></tr></thead>
          <tbody>
            {mappedBills.map((b) => (
              <tr key={b.id}>
                <td className="p-2 border-b border-gray-700">{b.id ?? '-'}</td>
                <td className="p-2 border-b border-gray-700">{b.tableNumber}</td>
                <td className="p-2 border-b border-gray-700">₹{Number(b.total).toFixed(0)}</td>
                <td className="p-2 border-b border-gray-700">{new Date(b.createdAt?.toDate?.() || b.createdAt || Date.now()).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
