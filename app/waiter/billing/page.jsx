"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, CreditCard, Eye, LogOut, Printer, QrCode, X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  subscribeToOrders,
  subscribeToRestaurant,
  updateOrderStatus,
  updateOrderPaymentStatus,
  updateOrderBillDetails,
} from "@/lib/firestore";
import { getMinutesAgo } from "@/lib/dateUtils";

const STATUS_COLORS = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  preparing: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  served: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  paid: "bg-green-500/20 text-green-300 border-green-500/30",
  unpaid: "bg-red-500/20 text-red-300 border-red-500/30",
};

// ============ ORDER CARD COMPONENT ============
function OrderCard({ order, isSelected, onClick }) {
  const itemCount = (order.items || []).length;
  const totalAmount = Number(order.totalAmount || order.total || 0);
  const minutesAgo = getMinutesAgo(order.createdAt);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ x: -8, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
        isSelected
          ? "border-gold bg-gold/10 ring-2 ring-gold/50"
          : "border-border-theme bg-bg-card hover:border-gold/50"
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-text-muted">#{String(order.id || "").substring(0, 8).toUpperCase()}</p>
          <p className="mt-1 font-bold text-lg">Table {order.tableNumber}</p>
        </div>
        <span className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_COLORS[order.paymentStatus]}`}>
          {order.paymentStatus === "paid" ? "✓ Paid" : "💳 Unpaid"}
        </span>
      </div>

      <div className="text-xs text-text-secondary mb-2">
        <p>📦 {itemCount} item{itemCount !== 1 ? "s" : ""} • ⏱️ {minutesAgo}</p>
      </div>

      <div className="flex items-center justify-between border-t border-border-theme pt-2">
        <span className={`inline-block rounded-md border px-2 py-1 text-xs font-semibold capitalize ${STATUS_COLORS[order.status]}`}>
          {order.status.replace(/_/g, " ")}
        </span>
        <span className="font-display font-bold text-gold">₹{totalAmount.toFixed(0)}</span>
      </div>
    </motion.button>
  );
}

// ============ WAITER BILLING VIEW ============
function WaiterBillingView({ order, restaurant, onStatusChange, onPaymentChange, onClose, onUpdateOrder }) {
  const items = order.items || [];
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [itemsToRemove, setItemsToRemove] = useState(new Set());
  const [printSize, setPrintSize] = useState("80mm");

  const subtotal = items
    .filter((_, idx) => !itemsToRemove.has(idx))
    .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const gstPercent = Number(order.gstPercent || restaurant?.defaultGstPercent || 5);
  const gstAmount = Math.round(subtotal * (gstPercent / 100));
  const serviceChargePercent = Number(order.serviceChargePercent || 0);
  const serviceChargeAmount = Math.round(subtotal * (serviceChargePercent / 100));
  const discount = Number(order.discount || 0);
  const finalTotal = subtotal + gstAmount + serviceChargeAmount - discount;

  const handleUpdateItemQuantity = (idx, newQuantity) => {
    const updatedItems = [...items];
    updatedItems[idx].quantity = Math.max(1, newQuantity);
    onUpdateOrder?.(order.id, { items: updatedItems });
    setEditingItemId(null);
    toast.success("Item quantity updated!");
  };

  const handleRemoveItem = (idx) => {
    const newSet = new Set(itemsToRemove);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setItemsToRemove(newSet);
  };

  const handleApplyRemovals = async () => {
    try {
      const updatedItems = items.filter((_, idx) => !itemsToRemove.has(idx));
      await onUpdateOrder?.(order.id, { items: updatedItems });
      setItemsToRemove(new Set());
      toast.success("Items removed from order!");
    } catch (err) {
      toast.error(err.message || "Failed to remove items");
    }
  };

  const handlePaymentUpdate = async (status) => {
    setIsProcessing(true);
    try {
      await onPaymentChange?.(order.id, status);
      toast.success(`Payment marked as ${status}`);
    } catch (err) {
      toast.error(err.message || "Failed to update payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusUpdate = async (status) => {
    setIsProcessing(true);
    try {
      await onStatusChange?.(order.id, status);
      toast.success(`Order: ${status}`);
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl">Table {order.tableNumber}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 hover:bg-bg-card"
        >
          <X size={20} />
        </button>
      </div>

      {/* Items List */}
      <div className="rounded-lg border border-border-theme bg-bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Items</h3>
          {itemsToRemove.size > 0 && (
            <button
              type="button"
              onClick={handleApplyRemovals}
              className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
            >
              Remove {itemsToRemove.size}
            </button>
          )}
        </div>
        <div className="space-y-1">
          {items.length > 0 ? (
            items.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between text-sm p-2 rounded transition ${
                  itemsToRemove.has(idx) ? "opacity-50 line-through bg-red-500/10" : "hover:bg-bg-primary"
                }`}
              >
                {editingItemId === idx ? (
                  <>
                    <input
                      type="number"
                      min="1"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-12 rounded border border-border-theme bg-bg-primary px-2 py-1 text-xs text-white text-center"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateItemQuantity(idx, editQuantity)}
                      className="px-2 rounded text-xs bg-gold text-bg-primary hover:opacity-90 font-semibold transition"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingItemId(null)}
                      className="px-2 rounded text-xs bg-gray-600 text-white hover:opacity-90 transition"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="text-gold hover:opacity-70 cursor-pointer transition" onClick={() => {
                        setEditingItemId(idx);
                        setEditQuantity(item.quantity);
                      }}>
                        {item.quantity}x {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gold">₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(0)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className={`px-1.5 py-0.5 rounded text-xs transition ${
                          itemsToRemove.has(idx)
                            ? "bg-red-500/40 text-red-200"
                            : "bg-red-500/20 text-red-300 hover:bg-red-500/40"
                        }`}
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted">No items</p>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-border-theme bg-bg-card p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Subtotal</span>
          <span>₹{subtotal.toFixed(0)}</span>
        </div>
        {gstAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">GST ({gstPercent}%)</span>
            <span className="text-gold">₹{gstAmount.toFixed(0)}</span>
          </div>
        )}
        {serviceChargeAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Service</span>
            <span className="text-gold">₹{serviceChargeAmount.toFixed(0)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Discount</span>
            <span className="text-red-400">-₹{discount.toFixed(0)}</span>
          </div>
        )}
        <div className="border-t border-border-theme pt-2 flex justify-between">
          <span className="font-semibold">Total</span>
          <span className="font-display text-lg text-gold">₹{finalTotal.toFixed(0)}</span>
        </div>
      </div>

      {/* Payment QR */}
      {restaurant?.paymentQR && (
        <button
          type="button"
          onClick={() => setShowQR(!showQR)}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-gold/50 bg-gold/10 p-3 text-sm font-semibold text-gold transition hover:bg-gold/20"
        >
          <QrCode size={16} />
          {showQR ? "Hide QR" : "Show Payment QR"}
        </button>
      )}

      {showQR && restaurant?.paymentQR && (
        <div className="flex justify-center p-4 bg-bg-card rounded-lg border border-border-theme">
          <img src={restaurant.paymentQR} alt="Payment QR" className="h-40 w-40 rounded-lg" />
        </div>
      )}

      {/* Payment Status */}
      <div className={`rounded-lg border p-3 ${STATUS_COLORS[order.paymentStatus]}`}>
        <p className="text-xs font-semibold">
          {order.paymentStatus === "paid" ? "✓ Payment Received" : "⚠️ Payment Pending"}
        </p>
      </div>

      {/* Payment Buttons */}
      {order.paymentStatus !== "paid" ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handlePaymentUpdate("unpaid")}
            disabled={isProcessing}
            className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-50"
          >
            💭 Pending
          </button>
          <button
            type="button"
            onClick={() => handlePaymentUpdate("paid")}
            disabled={isProcessing}
            className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-xs font-semibold text-green-300 hover:bg-green-500/20 disabled:opacity-50"
          >
            ✓ Mark Paid
          </button>
        </div>
      ) : null}

      {/* Order Status */}
      <div className="space-y-2 border-t border-border-theme pt-3">
        <p className="text-xs text-text-secondary font-semibold">Order Status</p>
        <div className="grid grid-cols-2 gap-2">
          {order.status !== "served" && (
            <button
              type="button"
              onClick={() => handleStatusUpdate("served")}
              disabled={isProcessing}
              className="rounded-lg border border-purple-500/50 bg-purple-500/10 p-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 disabled:opacity-50"
            >
              🍽️ Served
            </button>
          )}
          {order.status !== "completed" && (
            <button
              type="button"
              onClick={() => handleStatusUpdate("completed")}
              disabled={isProcessing}
              className="rounded-lg border border-green-500/50 bg-green-500/10 p-2 text-xs font-semibold text-green-300 hover:bg-green-500/20 disabled:opacity-50"
            >
              ✓ Complete
            </button>
          )}
        </div>
      </div>

      {/* Print Size Selector */}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs font-semibold text-text-secondary">Print:</label>
        <select
          value={printSize}
          onChange={(e) => setPrintSize(e.target.value)}
          className="flex-1 rounded border border-border-theme bg-bg-primary px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-gold/50"
        >
          <option value="58mm">58mm</option>
          <option value="80mm">80mm</option>
          <option value="210mm">A4</option>
        </select>
      </div>

      {/* Print Button */}
      <button
        type="button"
        onClick={() => handlePrintBill(order, restaurant, printSize)}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-gold p-3 text-sm font-semibold text-bg-primary transition hover:bg-gold/90"
      >
        <Printer size={16} />
        Print Bill
      </button>
    </div>
  );

  const handlePrintBill = (order, restaurantInfo, printSize = "80mm") => {
    if (!order) return;

    const items = order.items || [];
    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const gstPercent = Number(order.gstPercent || 5);
    const gstAmount = Math.round(subtotal * (gstPercent / 100));
    const serviceChargePercent = Number(order.serviceChargePercent || 0);
    const serviceChargeAmount = Math.round(subtotal * (serviceChargePercent / 100));
    const discount = Number(order.discount || 0);
    const finalTotal = subtotal + gstAmount + serviceChargeAmount - discount;

    // Set max-width based on print size
    const maxWidth = printSize === "58mm" ? "58mm" : printSize === "80mm" ? "80mm" : "210mm";

    const billHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bill - Table ${order.tableNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: ${maxWidth};
            margin: 0;
            padding: 10px;
            background: white;
          }
          .invoice {
            border: 1px solid #000;
            padding: 15px;
            text-align: center;
          }
          .header {
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            font-size: 18px;
          }
          .restaurant-name {
            font-size: 16px;
            font-weight: bold;
          }
          .bill-info {
            text-align: left;
            font-size: 12px;
            margin: 10px 0;
          }
          .bill-info p {
            margin: 2px 0;
          }
          .items {
            text-align: left;
            margin: 15px 0;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 10px 0;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin: 5px 0;
          }
          .item-name {
            flex: 1;
          }
          .item-qty {
            width: 30px;
            text-align: center;
          }
          .item-price {
            width: 50px;
            text-align: right;
          }
          .totals {
            text-align: left;
            font-size: 12px;
            margin: 10px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
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
            padding: 5px 0;
            margin: 10px 0;
            font-weight: bold;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            margin-top: 15px;
            border-top: 1px solid #000;
            padding-top: 10px;
          }
          @media print {
            body { margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div class="restaurant-name">${restaurantInfo?.name || "Restaurant"}</div>
            <p style="margin: 5px 0 0 0; font-size: 11px;">INVOICE</p>
          </div>

          <div class="bill-info">
            <p><strong>Table:</strong> ${order.tableNumber}</p>
            <p><strong>Order ID:</strong> ${String(order.id).substring(0, 8).toUpperCase()}</p>
            <p><strong>Date:</strong> ${new Date(order.createdAt?.toDate?.() || order.createdAt).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date(order.createdAt?.toDate?.() || order.createdAt).toLocaleTimeString()}</p>
          </div>

          <div class="items">
            <div style="font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px; display: flex; justify-content: space-between; font-size: 11px;">
              <span style="flex: 1;">Item</span>
              <span style="width: 30px; text-align: center;">Qty</span>
              <span style="width: 50px; text-align: right;">Amount</span>
            </div>
            ${items.map(item => `
              <div class="item-row">
                <div class="item-name">${item.name}</div>
                <div class="item-qty">${item.quantity}</div>
                <div class="item-price">₹${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(0)}</div>
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
            <div style="display: flex; justify-content: space-between;">
              <span>TOTAL:</span>
              <span>₹${finalTotal.toFixed(0)}</span>
            </div>
          </div>

          <div class="bill-info">
            <p><strong>Payment Status:</strong> ${order.paymentStatus === 'paid' ? '✓ PAID' : 'UNPAID'}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Cash'}</p>
          </div>

          ${order.gstNumber ? `
            <div style="font-size: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #000;">
              <p><strong>GST Number:</strong> ${order.gstNumber}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your visit!</p>
            <p style="margin: 5px 0 0 0; font-size: 10px;">Powered by DineBoss</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(billHTML);
    printWindow.document.close();
    printWindow.print();
  }
}

// ============ MAIN WAITER BILLING PAGE ============
export default function WaiterBillingPage() {
  const { loading, restaurantId, error: userError } = useCurrentUser({
    allowedRoles: ["waiter", "staff"],
  });
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState("");
  const [showBilling, setShowBilling] = useState(false);

  // Subscribe to real-time orders
  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubscribe = subscribeToOrders(restaurantId, setOrders, (err) => {
      setError(err.message || "Failed to load orders");
    });
    return unsubscribe;
  }, [restaurantId]);

  // Subscribe to restaurant
  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubscribe = subscribeToRestaurant(restaurantId, setRestaurant, (err) => {
      console.error("Failed to load restaurant:", err);
    });
    return unsubscribe;
  }, [restaurantId]);

  // Filter active orders only
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status !== "completed");
  }, [orders]);

  const handleLogout = async () => {
    await signOut(auth);
    toast.success("Logged out");
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border-theme bg-bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-gold">{restaurant?.name || "Waiter Billing"}</h1>
            <p className="text-xs text-text-muted">POS Billing System</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-border-theme px-3 py-2 text-xs font-semibold transition hover:bg-bg-primary"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-20">
        {error && <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

        {!showBilling ? (
          // Orders List View
          <div className="space-y-3">
            <h2 className="font-display text-lg">Active Orders ({activeOrders.length})</h2>

            {activeOrders.length > 0 ? (
              activeOrders.map((order) => (
                <motion.div key={order.id} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                  <OrderCard
                    order={order}
                    isSelected={selectedOrder?.id === order.id}
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowBilling(true);
                    }}
                  />
                </motion.div>
              ))
            ) : (
              <div className="card flex h-32 items-center justify-center text-center text-text-muted">
                <p>No active orders</p>
              </div>
            )}
          </div>
        ) : selectedOrder ? (
          // Billing View
          <div className="card p-4">
            <WaiterBillingView
              order={selectedOrder}
              restaurant={restaurant}
              onStatusChange={(id, status) => updateOrderStatus(restaurantId, id, status)}
              onPaymentChange={(id, status) => updateOrderPaymentStatus(restaurantId, id, status, selectedOrder)}
              onUpdateOrder={(id, updates) => updateOrderBillDetails(restaurantId, id, updates)}
              onClose={() => {
                setShowBilling(false);
                setSelectedOrder(null);
              }}
            />
          </div>
        ) : null}
      </main>

      {/* Mobile Bottom Navigation */}
      {showBilling && (
        <div className="fixed bottom-4 left-4 right-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={() => setShowBilling(false)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border-theme bg-bg-card p-3 text-xs font-semibold transition hover:bg-gold/10"
          >
            <ChevronLeft size={14} />
            Back
          </button>
        </div>
      )}
    </div>
  );
}
