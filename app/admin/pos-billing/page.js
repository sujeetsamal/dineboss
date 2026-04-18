"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { subscribeToMenu, subscribeToOrders, subscribeToTables, subscribeToRestaurant, placeOrder, updateOrderStatus, updateOrderPaymentStatus, updateOrderBillDetails } from '@/lib/firestore'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { toast } from 'react-hot-toast'

// Debounce utility for Firestore writes
function useDebounce(callback, delay) {
  const timeoutRef = useRef(null)
  return (args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => callback(args), delay)
  }
}

// Print bill function
function printBill(order, restaurantInfo) {
  if (!order) return

  const items = order.items || []
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  const gstPercent = Number(order.gstPercent || 5)
  const gstAmount = Math.round(subtotal * (gstPercent / 100))
  const serviceChargePercent = Number(order.serviceChargePercent || 0)
  const serviceChargeAmount = Math.round(subtotal * (serviceChargePercent / 100))
  const discountType = order.discountType || 'flat'
  const discountValue = Number(order.discount || 0)
  const discount = discountType === 'percentage' ? Math.round(subtotal * (discountValue / 100)) : discountValue
  const finalTotal = subtotal + gstAmount + serviceChargeAmount - discount

  const billHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Bill - Table ${order.tableNumber}</title>
      <style>
        @media print {
          * { margin: 0; padding: 0; }
          body { margin: 0; padding: 0; }
          .invoice { margin: 0; }
        }
        body {
          font-family: Arial, sans-serif;
          max-width: 80mm;
          margin: 0;
          padding: 10px;
          background: white;
          color: black;
        }
        .invoice {
          border: 1px solid #000;
          padding: 15px;
          text-align: center;
        }
        .header {
          margin-bottom: 15px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .restaurant-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .restaurant-info {
          font-size: 10px;
          line-height: 1.4;
        }
        .bill-info {
          text-align: left;
          font-size: 11px;
          margin: 10px 0;
          border-bottom: 1px solid #000;
          padding-bottom: 10px;
        }
        .bill-info p {
          margin: 2px 0;
        }
        .items {
          text-align: left;
          margin: 10px 0;
          border-bottom: 1px solid #000;
          padding: 10px 0;
          font-size: 11px;
        }
        .item-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #000;
          padding-bottom: 5px;
          margin-bottom: 5px;
          font-weight: bold;
          font-size: 10px;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        .item-name {
          flex: 1;
        }
        .item-qty {
          width: 25px;
          text-align: center;
        }
        .item-price {
          width: 40px;
          text-align: right;
        }
        .totals {
          text-align: left;
          font-size: 11px;
          margin: 10px 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        .total-label {
          flex: 1;
        }
        .total-value {
          width: 50px;
          text-align: right;
        }
        .grand-total {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 8px 0;
          margin: 10px 0;
          font-weight: bold;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
        }
        .footer {
          text-align: center;
          font-size: 10px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #000;
        }
        .divider { border-bottom: 1px solid #000; margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="invoice">
        <div class="header">
          <div class="restaurant-name">${restaurantInfo?.name || "Restaurant"}</div>
          ${restaurantInfo?.address ? `<div class="restaurant-info">${restaurantInfo.address}</div>` : ''}
          ${restaurantInfo?.gstNumber ? `<div class="restaurant-info">GST: ${restaurantInfo.gstNumber}</div>` : ''}
          <p style="margin: 5px 0 0 0; font-size: 10px;">INVOICE</p>
        </div>

        <div class="bill-info">
          <p><strong>Table:</strong> ${order.tableNumber}</p>
          <p><strong>Order ID:</strong> ${String(order.id).substring(0, 8).toUpperCase()}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
        </div>

        <div class="items">
          <div class="item-header">
            <span class="item-name">Item</span>
            <span class="item-qty">Qty</span>
            <span class="item-price">Amount</span>
          </div>
          ${items.map((it) => `
            <div class="item-row">
              <div class="item-name">${it.name}</div>
              <div class="item-qty">${it.quantity}</div>
              <div class="item-price">₹${(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(0)}</div>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">₹${subtotal.toFixed(0)}</span>
          </div>
          ${gstAmount > 0 ? `
          <div class="total-row">
            <span class="total-label">GST (${gstPercent}%):</span>
            <span class="total-value">₹${gstAmount.toFixed(0)}</span>
          </div>
          ` : ''}
          ${serviceChargeAmount > 0 ? `
          <div class="total-row">
            <span class="total-label">Service:</span>
            <span class="total-value">₹${serviceChargeAmount.toFixed(0)}</span>
          </div>
          ` : ''}
          ${discount > 0 ? `
          <div class="total-row">
            <span class="total-label">Discount:</span>
            <span class="total-value">-₹${discount.toFixed(0)}</span>
          </div>
          ` : ''}
        </div>

        <div class="grand-total">
          <span>TOTAL:</span>
          <span>₹${finalTotal.toFixed(0)}</span>
        </div>

        <div class="bill-info">
          <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Cash'}</p>
          <p><strong>Payment Status:</strong> ${order.paymentStatus === 'paid' ? '✓ PAID' : 'UNPAID'}</p>
        </div>

        <div class="footer">
          <p>Thank you for your visit!</p>
          <p style="margin: 5px 0 0 0; font-size: 9px;">Powered by DineBoss</p>
        </div>
      </div>
    </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  printWindow.document.write(billHTML)
  printWindow.document.close()
  printWindow.print()
}

// BillCalculations Component
function BillCalculations({ order, restaurantId, orderId, onUpdate }) {
  const [gstPercent, setGstPercent] = useState(Number(order.gstPercent || 5))
  const [serviceChargePercent, setServiceChargePercent] = useState(Number(order.serviceChargePercent || 0))
  const [discountType, setDiscountType] = useState(order.discountType || 'flat')
  const [discountValue, setDiscountValue] = useState(Number(order.discount || 0))
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || 'cash')

  const items = order.items || []
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  const gstAmount = Math.round(subtotal * (gstPercent / 100))
  const serviceChargeAmount = Math.round(subtotal * (serviceChargePercent / 100))
  const discount = discountType === 'percentage' ? Math.round(subtotal * (discountValue / 100)) : discountValue
  const grandTotal = subtotal + gstAmount + serviceChargeAmount - discount

  // Debounce Firestore updates
  const debounceUpdate = useRef(null)
  const saveChanges = (updates) => {
    clearTimeout(debounceUpdate.current)
    debounceUpdate.current = setTimeout(() => {
      onUpdate(updates)
    }, 500)
  }

  useEffect(() => {
    setGstPercent(Number(order.gstPercent || 5))
    setServiceChargePercent(Number(order.serviceChargePercent || 0))
    setDiscountType(order.discountType || 'flat')
    setDiscountValue(Number(order.discount || 0))
    setPaymentMethod(order.paymentMethod || 'cash')
  }, [order.id])

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-1">
      {/* Subtotal */}
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-gray-300">Subtotal</span>
        <span className="text-white font-medium">₹{subtotal.toFixed(0)}</span>
      </div>

      {/* GST - EDITABLE */}
      <div className="flex items-center gap-3 py-2">
        <span className="text-sm text-gray-300 w-32 flex-shrink-0">GST</span>
        <input
          type="number"
          min="0"
          max="100"
          value={gstPercent}
          onChange={(e) => {
            setGstPercent(Number(e.target.value))
            saveChanges({ gstPercent: Number(e.target.value) })
          }}
          className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-white text-sm text-right focus:border-amber-500 focus:outline-none"
        />
        <span className="text-gray-400 text-sm flex-shrink-0">%</span>
        <span className="ml-auto text-amber-400 font-medium text-sm whitespace-nowrap">₹{gstAmount.toFixed(0)}</span>
      </div>

      {/* Service Charge - EDITABLE */}
      <div className="flex items-center gap-3 py-2">
        <span className="text-sm text-gray-300 w-32 flex-shrink-0">Service Charge</span>
        <input
          type="number"
          min="0"
          max="100"
          value={serviceChargePercent}
          onChange={(e) => {
            setServiceChargePercent(Number(e.target.value))
            saveChanges({ serviceChargePercent: Number(e.target.value) })
          }}
          className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-white text-sm text-right focus:border-amber-500 focus:outline-none"
        />
        <span className="text-gray-400 text-sm flex-shrink-0">%</span>
        <span className="ml-auto text-amber-400 font-medium text-sm whitespace-nowrap">₹{serviceChargeAmount.toFixed(0)}</span>
      </div>

      {/* Discount - EDITABLE with TYPE TOGGLE */}
      <div className="flex items-center gap-3 py-2">
        <span className="text-sm text-gray-300 w-32 flex-shrink-0">Discount</span>
        <div className="flex gap-1 h-7">
          <button
            onClick={() => {
              setDiscountType('flat')
              saveChanges({ discountType: 'flat' })
            }}
            className={`px-2 py-1 text-xs rounded transition flex-shrink-0 ${
              discountType === 'flat'
                ? 'bg-amber-500 text-black font-semibold'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            ₹
          </button>
          <button
            onClick={() => {
              setDiscountType('percentage')
              saveChanges({ discountType: 'percentage' })
            }}
            className={`px-2 py-1 text-xs rounded transition flex-shrink-0 ${
              discountType === 'percentage'
                ? 'bg-amber-500 text-black font-semibold'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            %
          </button>
        </div>
        <input
          type="number"
          min="0"
          value={discountValue}
          onChange={(e) => {
            setDiscountValue(Number(e.target.value))
            saveChanges({ discount: Number(e.target.value), discountType })
          }}
          className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-white text-sm text-right focus:border-amber-500 focus:outline-none"
        />
        <span className="ml-auto text-red-400 font-medium text-sm whitespace-nowrap">−₹{discount.toFixed(0)}</span>
      </div>

      {/* Grand Total */}
      <div className="flex items-center justify-between py-3 border-t border-gray-600 mt-2">
        <span className="text-base font-bold text-amber-400">Grand Total</span>
        <span className="text-xl font-bold text-amber-400">₹{grandTotal.toFixed(0)}</span>
      </div>
    </div>
  )
}

export default function PosBillingPage() {
  const { restaurantId } = useCurrentUser({ allowedRoles: ['admin', 'waiter', 'staff'] })
  
  // Orders data
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [restaurant, setRestaurant] = useState(null)
  
  // Menu data for Create Bill modal
  const [menu, setMenu] = useState([])
  const [tables, setTables] = useState([])
  const [createBillModalOpen, setCreateBillModalOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [menuSearchQuery, setMenuSearchQuery] = useState('')
  
  // Add Item modal
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [addItemSearch, setAddItemSearch] = useState('')
  const [addItemQuantity, setAddItemQuantity] = useState(1)

  // Subscribe to orders
  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeToOrders(restaurantId, setOrders, (e) => {
      console.error('Failed to load orders:', e)
      toast.error('Failed to load orders')
    })
    return () => unsub?.()
  }, [restaurantId])

  // Subscribe to menu
  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeToMenu(restaurantId, setMenu, (e) => {
      console.error('Failed to load menu:', e)
    })
    return () => unsub?.()
  }, [restaurantId])

  // Subscribe to tables
  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeToTables(restaurantId, setTables, (e) => {
      console.error('Failed to load tables:', e)
    })
    return () => unsub?.()
  }, [restaurantId])

  // Subscribe to restaurant
  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeToRestaurant(restaurantId, setRestaurant, (e) => {
      console.error('Failed to load restaurant:', e)
    })
    return () => unsub?.()
  }, [restaurantId])

  // Filter orders based on status and payment filters
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const statusMatch = statusFilter === 'all' || order.status === statusFilter
      const paymentMatch = paymentFilter === 'all' || order.paymentStatus === paymentFilter
      return statusMatch && paymentMatch
    })
  }, [orders, statusFilter, paymentFilter])

  // Get selected order
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId)
  }, [orders, selectedOrderId])

  // Filter menu items by search
  const filteredMenuItems = useMemo(() => {
    if (!menuSearchQuery) return menu
    const q = menuSearchQuery.toLowerCase()
    return menu.filter(m => (m.name || '').toLowerCase().includes(q))
  }, [menu, menuSearchQuery])

  // Calculate total for selected items in create bill modal
  const createBillTotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0)
  }, [selectedItems])

  // Handle adding item to create bill modal
  const handleAddItemToBill = (menuItem) => {
    const existingItem = selectedItems.find(i => i.id === menuItem.id)
    if (existingItem) {
      setSelectedItems(selectedItems.map(i => 
        i.id === menuItem.id ? { ...i, qty: (i.qty || 1) + 1 } : i
      ))
    } else {
      setSelectedItems([...selectedItems, {
        id: menuItem.id,
        name: menuItem.name,
        price: Number(menuItem.price || 0),
        qty: 1
      }])
    }
  }

  // Handle removing item from create bill modal
  const handleRemoveItemFromBill = (itemId) => {
    setSelectedItems(selectedItems.filter(i => i.id !== itemId))
  }

  // Handle changing item quantity in create bill modal
  const handleChangeItemQty = (itemId, qty) => {
    if (qty <= 0) {
      handleRemoveItemFromBill(itemId)
    } else {
      setSelectedItems(selectedItems.map(i =>
        i.id === itemId ? { ...i, qty } : i
      ))
    }
  }

  // Handle generating bill from modal
  const handleGenerateBill = async () => {
    if (!restaurantId) return
    if (!selectedItems.length) {
      toast.error('No items selected')
      return
    }
    if (!selectedTable) {
      toast.error('Please select a table')
      return
    }

    try {
      const items = selectedItems.map(it => ({
        name: it.name,
        price: it.price,
        quantity: it.qty
      }))
      
      // Use placeOrder to create the order (not createManualBill)
      // This properly tracks table occupancy and allows status changes
      await placeOrder(restaurantId, {
        tableNumber: selectedTable.tableNumber,
        tableId: selectedTable.id,
        items,
        total: createBillTotal,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: 'cash',
        createdBy: 'Admin'
      })
      
      toast.success('Order created successfully')
      setCreateBillModalOpen(false)
      setSelectedItems([])
      setSelectedTable(null)
      setMenuSearchQuery('')
    } catch (e) {
      console.error('Failed to create order:', e)
      toast.error('Failed to create order')
    }
  }

  // Handle order status update
  const handleUpdateOrderStatus = async (newStatus) => {
    if (!restaurantId || !selectedOrderId) return
    try {
      await updateOrderStatus(restaurantId, selectedOrderId, newStatus)
      toast.success(`Order moved to ${newStatus}`)
    } catch (e) {
      console.error('Failed to update order status:', e)
      toast.error('Failed to update order status')
    }
  }

  // Handle payment status update
  const handleUpdatePaymentStatus = async (newStatus) => {
    if (!restaurantId || !selectedOrderId || !selectedOrder) return
    try {
      await updateOrderPaymentStatus(restaurantId, selectedOrderId, newStatus, selectedOrder)
      toast.success(`Payment marked as ${newStatus}`)
    } catch (e) {
      console.error('Failed to update payment status:', e)
      toast.error('Failed to update payment status')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-900/30 text-amber-200'
      case 'preparing': return 'bg-blue-900/30 text-blue-200'
      case 'served': return 'bg-cyan-900/30 text-cyan-200'
      case 'completed': return 'bg-green-900/30 text-green-200'
      default: return 'bg-gray-900/30 text-gray-200'
    }
  }

  const getPaymentColor = (status) => {
    if (status === 'paid') return 'bg-green-900/30 text-green-200'
    return 'bg-red-900/30 text-red-200'
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-amber-500">POS Billing</h1>
          <button
            onClick={() => setCreateBillModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-lg transition text-sm md:text-base"
          >
            + Create Bill
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row md:h-[calc(100vh-73px)] gap-0 md:gap-4 p-4 md:p-6">
        {/* Left Panel: Orders List */}
        <div className={`md:w-[35%] flex-shrink-0 ${selectedOrderId ? "hidden md:flex" : "flex"} flex-col`}>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col h-full">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white mb-3">Active Orders</h2>

              {/* Filters */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none transition"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="preparing">Preparing</option>
                    <option value="served">Served</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Payment</label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none transition"
                  >
                    <option value="all">All</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredOrders.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <p>No orders</p>
                </div>
              ) : (
                filteredOrders.map(order => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-4 rounded-xl cursor-pointer transition border-2 ${
                      selectedOrderId === order.id
                        ? "bg-amber-500/20 border-amber-500"
                        : "bg-gray-800 border-gray-800 hover:border-amber-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-amber-500">#{order.id?.slice(-6).toUpperCase()}</span>
                      <span className="text-xs text-gray-400">T{order.tableNumber}</span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">{order.items?.length || 0} items</div>
                    <div className="flex gap-2 flex-wrap mb-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getPaymentColor(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </span>
                    </div>
                    <div className="text-right text-amber-500 font-bold">₹{Number(order.total || 0).toFixed(0)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Order Details */}
        <div className={`md:w-[65%] flex flex-col ${!selectedOrderId ? "hidden md:flex" : "flex"}`}>
          {selectedOrder ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 md:p-6 flex flex-col h-full overflow-y-auto">
              {/* Back Button on Mobile */}
              <button
                onClick={() => setSelectedOrderId(null)}
                className="md:hidden mb-4 flex items-center gap-2 text-gray-400 hover:text-white text-sm"
              >
                ← Back to Orders
              </button>

              {/* Order Header */}
              <div className="border-b border-gray-800 pb-4 mb-4">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-2xl font-bold font-mono text-amber-500">#{selectedOrder.id?.slice(-6).toUpperCase()}</h2>
                  <span className="text-sm text-gray-400">Table {selectedOrder.tableNumber}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {selectedOrder.createdAt
                    ? new Date(
                        selectedOrder.createdAt.toDate?.() ||
                        new Date(selectedOrder.createdAt.seconds * 1000)
                      ).toLocaleString()
                    : "N/A"}
                </p>
              </div>

              {/* Bill Items Section */}
              <div className="border-b border-gray-800 pb-4 mb-4">
                <h3 className="text-lg font-semibold text-white mb-3">Items</h3>
                <div className="space-y-2 max-h-[180px] overflow-y-auto mb-3">
                  {selectedOrder.items?.length > 0 ? (
                    selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-800 rounded-lg p-3 text-sm">
                        <div className="flex-1">
                          <p className="text-white font-medium">{item.name}</p>
                          <p className="text-xs text-gray-500">₹{Number(item.price || 0).toFixed(0)} each</p>
                        </div>
                        <div className="flex items-center gap-1 mr-3">
                          <button
                            onClick={() => {
                              const updatedItems = [...selectedOrder.items]
                              if (updatedItems[idx].quantity > 1) {
                                updatedItems[idx].quantity -= 1
                                updateOrderBillDetails(restaurantId, selectedOrderId, { items: updatedItems })
                              }
                            }}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium transition"
                          >
                            −
                          </button>
                          <span className="w-7 text-center font-semibold text-white">{item.quantity || 1}</span>
                          <button
                            onClick={() => {
                              const updatedItems = [...selectedOrder.items]
                              updatedItems[idx].quantity += 1
                              updateOrderBillDetails(restaurantId, selectedOrderId, { items: updatedItems })
                            }}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium transition"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-amber-500 font-semibold w-20 text-right">₹{Number((item.price || 0) * (item.quantity || 1)).toFixed(0)}</span>
                        <button
                          onClick={() => {
                            const updatedItems = selectedOrder.items.filter((_, i) => i !== idx)
                            updateOrderBillDetails(restaurantId, selectedOrderId, { items: updatedItems })
                            toast.success('Item removed')
                          }}
                          className="text-red-400 hover:text-red-300 ml-2 transition"
                        >
                          🗑️
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No items</p>
                  )}
                </div>

                <button
                  onClick={() => setAddItemModalOpen(true)}
                  className="w-full border-2 border-dashed border-gray-700 hover:border-amber-500/50 rounded-lg py-2 text-sm text-gray-400 hover:text-gray-300 font-medium transition"
                >
                  + Add Item
                </button>
              </div>

              {/* Calculations Section */}
              <div className="border-b border-gray-800 pb-4 mb-4">
                <BillCalculations 
                  order={selectedOrder}
                  restaurantId={restaurantId}
                  orderId={selectedOrderId}
                  onUpdate={(updates) => updateOrderBillDetails(restaurantId, selectedOrderId, updates)}
                />
              </div>

              {/* Payment Section */}
              <div className="border-b border-gray-800 pb-4 mb-4">
                <h3 className="text-lg font-semibold text-white mb-3">Payment</h3>
                
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-2">Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['Cash', 'Card', 'UPI'].map(method => (
                      <button
                        key={method}
                        onClick={() => updateOrderBillDetails(restaurantId, selectedOrderId, { paymentMethod: method })}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                          selectedOrder.paymentMethod === method
                            ? 'bg-amber-500 border-amber-500 text-black'
                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-400'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {selectedOrder.paymentStatus === 'unpaid' ? (
                    <button
                      onClick={() => handleUpdatePaymentStatus('paid')}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg text-sm transition"
                    >
                      ✓ Mark Paid
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdatePaymentStatus('unpaid')}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm transition"
                    >
                      Mark Unpaid
                    </button>
                  )}
                  <p className="text-xs text-gray-500 col-span-2">
                    Status: <span className="text-white capitalize">{selectedOrder.paymentStatus}</span>
                  </p>
                </div>
              </div>

              {/* Order Status Section */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-3">Order Status</h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {selectedOrder.status !== 'pending' && (
                    <button
                      onClick={() => handleUpdateOrderStatus('pending')}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg text-sm transition"
                    >
                      Pending
                    </button>
                  )}
                  {selectedOrder.status !== 'preparing' && (
                    <button
                      onClick={() => handleUpdateOrderStatus('preparing')}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition"
                    >
                      Preparing
                    </button>
                  )}
                  {selectedOrder.status !== 'served' && (
                    <button
                      onClick={() => handleUpdateOrderStatus('served')}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 rounded-lg text-sm transition"
                    >
                      Served
                    </button>
                  )}
                  {selectedOrder.status !== 'completed' && (
                    <button
                      onClick={() => handleUpdateOrderStatus('completed')}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg text-sm transition"
                    >
                      Complete
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Current: <span className="text-white capitalize font-medium">{selectedOrder.status}</span>
                </p>
              </div>

              {/* Print Button */}
              <button
                onClick={() => printBill(selectedOrder, restaurant || { name: "Restaurant" })}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm md:text-base"
              >
                🖨️ Print Bill (80mm)
              </button>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-center h-full hidden md:flex">
              <p className="text-gray-500">Select an order to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Bill Modal */}
      {createBillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 text-white rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Create Manual Bill</h3>
              <button
                onClick={() => {
                  setCreateBillModalOpen(false)
                  setSelectedItems([])
                  setSelectedTable(null)
                  setMenuSearchQuery('')
                }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Table Selection */}
              <div>
                <label className="block text-sm font-semibold mb-2">Select Table</label>
                <select
                  value={selectedTable?.id || ''}
                  onChange={(e) => {
                    const table = tables.find(t => t.id === e.target.value)
                    setSelectedTable(table || null)
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="">-- Select Table --</option>
                  {tables.map(table => (
                    <option key={table.id} value={table.id}>
                      Table {table.tableNumber} ({table.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Menu Search */}
              <div>
                <label className="block text-sm font-semibold mb-2">Search Menu Items</label>
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>

              {/* Menu Items Grid */}
              <div>
                <label className="block text-sm font-semibold mb-2">Menu Items</label>
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                  {filteredMenuItems.length === 0 ? (
                    <p className="text-gray-500 col-span-2">No items found</p>
                  ) : (
                    filteredMenuItems.map(item => (
                      <div
                        key={item.id}
                        className="bg-gray-800 border border-gray-700 rounded p-2"
                      >
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400 mb-2">₹{Number(item.price || 0).toFixed(0)}</p>
                        <button
                          onClick={() => handleAddItemToBill(item)}
                          className="w-full bg-gold hover:bg-gold/80 text-black font-semibold py-1 rounded text-xs transition"
                        >
                          Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="bg-gray-800 rounded p-3 border border-gray-700">
                  <h4 className="font-semibold mb-2 text-sm">Selected Items</h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto mb-2">
                    {selectedItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleChangeItemQty(item.id, (item.qty || 1) - 1)}
                              className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                            >
                              -
                            </button>
                            <span className="w-6 text-center">{item.qty || 1}</span>
                            <button
                              onClick={() => handleChangeItemQty(item.id, (item.qty || 1) + 1)}
                              className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-gold font-semibold w-16 text-right">
                            ₹{Number(item.price * (item.qty || 1)).toFixed(0)}
                          </span>
                          <button
                            onClick={() => handleRemoveItemFromBill(item.id)}
                            className="text-red-400 hover:text-red-200 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-700 pt-2 flex items-center justify-between font-bold">
                    <span>Total:</span>
                    <span className="text-gold">₹{createBillTotal.toFixed(0)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex gap-2">
              <button
                onClick={() => {
                  setCreateBillModalOpen(false)
                  setSelectedItems([])
                  setSelectedTable(null)
                  setMenuSearchQuery('')
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateBill}
                disabled={!selectedTable || selectedItems.length === 0}
                className="flex-1 bg-gold hover:bg-gold/80 disabled:bg-gray-600 text-black font-semibold px-4 py-2 rounded-lg transition disabled:cursor-not-allowed"
              >
                Generate Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {addItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 text-white rounded-lg border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Add Item to Bill</h3>
              <button
                onClick={() => {
                  setAddItemModalOpen(false)
                  setAddItemSearch('')
                  setAddItemQuantity(1)
                }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-semibold mb-2">Search Menu Items</label>
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={addItemSearch}
                  onChange={(e) => setAddItemSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>

              {/* Menu Items Grid */}
              <div>
                <label className="block text-sm font-semibold mb-2">Menu Items</label>
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {menu
                    .filter(item => !addItemSearch || (item.name || '').toLowerCase().includes(addItemSearch.toLowerCase()))
                    .map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          const updatedItems = [...(selectedOrder.items || []), {
                            id: item.id,
                            name: item.name,
                            price: Number(item.price || 0),
                            quantity: addItemQuantity
                          }]
                          updateOrderBillDetails(restaurantId, selectedOrderId, { items: updatedItems })
                          toast.success('Item added to bill')
                          setAddItemModalOpen(false)
                          setAddItemSearch('')
                          setAddItemQuantity(1)
                        }}
                        className="bg-gray-800 border border-gray-700 rounded p-3 cursor-pointer hover:border-gold/50 transition"
                      >
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400 mb-2">₹{Number(item.price || 0).toFixed(0)}</p>
                        <button className="w-full bg-gold hover:bg-gold/80 text-black font-semibold py-1 rounded text-xs transition">
                          Add
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Quantity Selector */}
              <div>
                <label className="block text-sm font-semibold mb-2">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddItemQuantity(Math.max(1, addItemQuantity - 1))}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm"
                  >
                    −
                  </button>
                  <span className="w-12 text-center font-semibold">{addItemQuantity}</span>
                  <button
                    onClick={() => setAddItemQuantity(addItemQuantity + 1)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex gap-2">
              <button
                onClick={() => {
                  setAddItemModalOpen(false)
                  setAddItemSearch('')
                  setAddItemQuantity(1)
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

