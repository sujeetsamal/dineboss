"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Download,
  Eye,
  Home,
  Package,
  Printer,
  Plus,
  QrCode,
  Save,
  SettingsIcon,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import AdminShell from "@/components/AdminShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  subscribeToOrders,
  subscribeToRestaurant,
  updateOrderStatus,
  updateOrderPaymentStatus,
  updateOrderBillDetails,
  deleteOrder,
  subscribeToMenu,
  placeOrder,
} from "@/lib/firestore";
import { getMinutesAgo } from "@/lib/dateUtils";

const ORDER_FILTERS = [
  { key: "all", label: "All", color: "text-text-secondary" },
  { key: "pending", label: "Pending", color: "text-yellow-400" },
  { key: "preparing", label: "Preparing", color: "text-blue-400" },
  { key: "served", label: "Served", color: "text-purple-400" },
  { key: "payment-pending", label: "💳 Payment Pending", color: "text-red-400" },
  { key: "completed", label: "✓ Completed", color: "text-green-400" },
];

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
      whileHover={{ x: 4 }}
      className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
        isSelected
          ? "border-gold bg-gold/10 ring-2 ring-gold/50"
          : "border-border-theme bg-bg-card hover:border-gold/50"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-text-muted">#{String(order.id || "").substring(0, 8).toUpperCase()}</p>
          <p className="mt-1 text-base font-bold">Table {order.tableNumber}</p>
        </div>
        <span className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_COLORS[order.paymentStatus] || STATUS_COLORS.unpaid}`}>
          {order.paymentStatus === "paid" ? "✓ Paid" : "💳 Unpaid"}
        </span>
      </div>

      <div className="mb-2 space-y-1 text-xs text-text-secondary">
        <p>📦 {itemCount} item{itemCount !== 1 ? "s" : ""}</p>
        <p>⏱️ {minutesAgo}</p>
      </div>

      <div className="flex items-center justify-between border-t border-border-theme pt-2">
        <span className={`inline-block rounded-md border ${STATUS_COLORS[order.status] || STATUS_COLORS.pending} px-2 py-1 text-xs font-semibold capitalize`}>
          {order.status.replace(/_/g, " ")}
        </span>
        <span className="font-display text-base font-bold text-gold">₹{totalAmount.toFixed(0)}</span>
      </div>
    </motion.button>
  );
}

// ============ BILL CALCULATION PANEL ============
function BillCalculationPanel({ order, restaurantSettings, onUpdateOrder }) {
  const { restaurantId } = useCurrentUser();
  const items = order.items || [];
  const [gstPercent, setGstPercent] = useState(Number(restaurantSettings?.defaultGstPercent || 5));
  const [gstNumber, setGstNumber] = useState(String(order.gstNumber || restaurantSettings?.gstNumber || ""));
  const [discountAmount, setDiscountAmount] = useState(Number(order.discount || 0));
  const [serviceChargePercent, setServiceChargePercent] = useState(
    Number(restaurantSettings?.defaultServiceCharge || 0)
  );
  const [editingItemId, setEditingItemId] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [itemsToRemove, setItemsToRemove] = useState(new Set());
  const [menuItems, setMenuItems] = useState([]);
  const [showMenuPicker, setShowMenuPicker] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");

  // Subscribe to menu items
  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = subscribeToMenu(restaurantId, setMenuItems, (err) => {
      console.error("Failed to load menu:", err);
    });
    return unsubscribe;
  }, [restaurantId]);

  // Filter menu items based on search
  const filteredMenuItems = useMemo(() => {
    if (!menuSearch) return menuItems;
    return menuItems.filter(item =>
      item.name?.toLowerCase().includes(menuSearch.toLowerCase()) ||
      item.category?.toLowerCase().includes(menuSearch.toLowerCase())
    );
  }, [menuItems, menuSearch]);

  // Calculate totals
  const subtotal = items
    .filter((item, idx) => !itemsToRemove.has(idx))
    .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const gstAmount = Math.round(subtotal * (gstPercent / 100));
  const serviceChargeAmount = Math.round(subtotal * (serviceChargePercent / 100));
  const finalTotal = subtotal + gstAmount + serviceChargeAmount - discountAmount;

  const handleAddItemFromMenu = async (menuItem) => {
    try {
      const newItem = {
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        category: menuItem.category,
      };
      const updatedItems = [...items, newItem];
      await onUpdateOrder?.(order.id, { items: updatedItems });
      toast.success(`${menuItem.name} added to bill!`);
      setShowMenuPicker(false);
      setMenuSearch("");
    } catch (err) {
      toast.error(err.message || "Failed to add item");
    }
  };

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

  const saveBillDetails = async () => {
    try {
      // Validate GST number format if provided
      if (gstNumber && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gstNumber)) {
        toast.error("Invalid GST number format!");
        return;
      }
      
      await onUpdateOrder?.(order.id, {
        totalAmount: subtotal,
        tax: gstAmount,
        discount: discountAmount,
        serviceCharge: serviceChargeAmount,
        finalAmount: finalTotal,
        gstPercent,
        serviceChargePercent,
        gstNumber,
      });
      toast.success("Bill details saved!");
    } catch (err) {
      toast.error(err.message || "Failed to save bill");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-display text-xl">📋 Bill Details</h3>

      {/* Items List */}
      <div className="rounded-lg border border-border-theme bg-bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-text-secondary">Order Items</h4>
          <div className="flex items-center gap-2">
            {itemsToRemove.size > 0 && (
              <button
                type="button"
                onClick={handleApplyRemovals}
                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
              >
                Remove {itemsToRemove.size}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMenuPicker(!showMenuPicker)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gold/20 text-gold hover:bg-gold/30 transition font-semibold"
            >
              <Plus size={14} />
              Add Item
            </button>
          </div>
        </div>

        {/* Menu Picker Modal */}
        {showMenuPicker && (
          <div className="mb-4 p-3 rounded-lg bg-gold/5 border border-gold/20">
            <input
              type="text"
              placeholder="Search menu items..."
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              className="w-full mb-3 rounded border border-border-theme bg-bg-primary px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
            {filteredMenuItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredMenuItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddItemFromMenu(item)}
                    className="text-left p-2 rounded bg-bg-primary border border-border-theme hover:border-gold/50 hover:bg-bg-card transition text-xs"
                  >
                    <p className="font-semibold text-white truncate">{item.name}</p>
                    <p className="text-text-muted">₹{Number(item.price || 0).toFixed(0)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-text-muted">No items found</p>
            )}
          </div>
        )}

        {/* Items List Display */}
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between border-b border-border-theme pb-3 last:border-0 transition ${
                  itemsToRemove.has(idx) ? "opacity-50 line-through" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                  <p className="text-xs text-text-muted">₹{Number(item.price || 0).toFixed(0)} each</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {editingItemId === idx ? (
                    <>
                      <input
                        type="number"
                        min="1"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-12 rounded border border-border-theme bg-bg-primary px-2 py-1 text-sm text-white text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQuantity(idx, editQuantity)}
                        className="px-2 py-1 rounded text-xs bg-gold text-bg-primary hover:opacity-90 font-semibold transition"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="px-2 py-1 rounded text-xs bg-gray-600 text-white hover:opacity-90 transition"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItemId(idx);
                          setEditQuantity(item.quantity);
                        }}
                        className="w-8 text-right text-sm font-semibold text-gold hover:opacity-70 transition"
                      >
                        {item.quantity}x
                      </button>
                      <span className="w-16 text-right font-bold text-gold text-sm">
                        ₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className={`px-1.5 py-1 rounded text-xs transition ${
                          itemsToRemove.has(idx)
                            ? "bg-red-500/40 text-red-200"
                            : "bg-red-500/20 text-red-300 hover:bg-red-500/40"
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-text-muted py-4">No items in order</p>
        )}
      </div>

      {/* Calculations */}
      <div className="rounded-lg border border-border-theme bg-bg-card p-4 space-y-4">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Subtotal</span>
          <span className="font-semibold text-white">₹{subtotal.toFixed(0)}</span>
        </div>

        {/* GST */}
        <div className="flex items-center justify-between border-t border-border-theme pt-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <span>GST ({gstPercent}%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={gstPercent}
              onChange={(e) => setGstPercent(Number(e.target.value))}
              className="w-12 rounded border border-border-theme bg-bg-primary px-2 py-1 text-xs text-white"
            />
          </label>
          <span className="font-semibold text-gold">₹{gstAmount.toFixed(0)}</span>
        </div>

        {/* GST Number */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-text-secondary">GST Number (Optional)</label>
          <input
            type="text"
            placeholder="e.g., 18AABCU9603R1Z5"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
            className="w-full rounded border border-border-theme bg-bg-primary px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
          {gstNumber && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gstNumber) && (
            <p className="text-xs text-red-400">⚠ Invalid GST number format</p>
          )}
        </div>

        {/* Service Charge */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <span>Service ({serviceChargePercent}%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={serviceChargePercent}
              onChange={(e) => setServiceChargePercent(Number(e.target.value))}
              className="w-12 rounded border border-border-theme bg-bg-primary px-2 py-1 text-xs text-white"
            />
          </label>
          <span className="font-semibold text-gold">₹{serviceChargeAmount.toFixed(0)}</span>
        </div>

        {/* Discount */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <span>Discount</span>
            <input
              type="number"
              min="0"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Number(e.target.value))}
              className="w-16 rounded border border-border-theme bg-bg-primary px-2 py-1 text-xs text-white"
            />
          </label>
          <span className="font-semibold text-red-400">-₹{discountAmount.toFixed(0)}</span>
        </div>

        {/* Final Total */}
        <div className="border-t border-border-theme pt-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-white">Final Total</span>
            <span className="font-display text-2xl font-bold text-gold">₹{finalTotal.toFixed(0)}</span>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={saveBillDetails}
          className="btn-gold w-full flex items-center justify-center gap-2 py-3 mt-3 rounded-lg hover:opacity-90 transition"
        >
          <Save size={16} />
          Save Bill Details
        </button>
      </div>
    </div>
  );
}

// ============ PAYMENT SECTION ============
function PaymentSection({ order, onUpdatePaymentStatus, onUpdateOrderStatus }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentStatus = async (status) => {
    setIsProcessing(true);
    try {
      await onUpdatePaymentStatus?.(order.id, status);
      toast.success(`Payment marked as ${status}`);
    } catch (err) {
      toast.error(err.message || "Failed to update payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusChange = async (status) => {
    setIsProcessing(true);
    try {
      await onUpdateOrderStatus?.(order.id, status);
      toast.success(`Order status: ${status}`);
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-display text-xl">💳 Payment</h3>

      {/* Payment Status Display */}
      <div className={`rounded-lg border p-4 ${STATUS_COLORS[order.paymentStatus] || STATUS_COLORS.unpaid}`}>
        <p className="text-sm font-semibold capitalize">
          {order.paymentStatus === "paid" ? "✓ Payment Received" : "⚠️ Payment Pending"}
        </p>
        <p className="mt-1 text-xs text-text-secondary">Method: {order.paymentMethod || "Cash"}</p>
      </div>

      {/* Payment Buttons */}
      {order.paymentStatus !== "paid" ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handlePaymentStatus("unpaid")}
            disabled={isProcessing}
            className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-50"
          >
            💭 Mark Pending
          </button>
          <button
            type="button"
            onClick={() => handlePaymentStatus("paid")}
            disabled={isProcessing}
            className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
          >
            ✓ Mark Paid
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-center">
          <p className="text-sm font-semibold text-green-300">✓ Payment Completed</p>
        </div>
      )}

      {/* Order Status Buttons */}
      <div className="space-y-2 border-t border-border-theme pt-4">
        <p className="text-xs text-text-secondary">Update Order Status:</p>
        <div className="grid grid-cols-2 gap-2">
          {order.status !== "preparing" && (
            <button
              type="button"
              onClick={() => handleStatusChange("preparing")}
              disabled={isProcessing}
              className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
            >
              👨‍🍳 Preparing
            </button>
          )}
          {order.status !== "served" && (
            <button
              type="button"
              onClick={() => handleStatusChange("served")}
              disabled={isProcessing}
              className="rounded-lg border border-purple-500/50 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
            >
              🍽️ Served
            </button>
          )}
          {order.status !== "completed" && (
            <button
              type="button"
              onClick={() => handleStatusChange("completed")}
              disabled={isProcessing}
              className="rounded-lg border border-green-500/50 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
            >
              ✓ Completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ MAIN POS BILLING PAGE ============
export default function POSBillingPage() {
  const { loading, user, restaurantId, error: userError, role } = useCurrentUser({
    allowedRoles: ["admin", "waiter", "staff"],
  });
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [filterKey, setFilterKey] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState("");
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [paymentQRUrl, setPaymentQRUrl] = useState("");
  const [printSize, setPrintSize] = useState("80mm");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [newOrderTableNumber, setNewOrderTableNumber] = useState(1);
  const [newOrderItems, setNewOrderItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  // Subscribe to real-time orders
  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubscribe = subscribeToOrders(restaurantId, setOrders, (err) => {
      setError(err.message || "Failed to load orders");
    });
    return unsubscribe;
  }, [restaurantId]);

  // Subscribe to restaurant details
  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubscribe = subscribeToRestaurant(restaurantId, setRestaurant, (err) => {
      console.error("Failed to load restaurant:", err);
    });
    return unsubscribe;
  }, [restaurantId]);

  // Subscribe to menu items for creating orders
  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = subscribeToMenu(restaurantId, setMenuItems, (err) => {
      console.error("Failed to load menu:", err);
    });
    return unsubscribe;
  }, [restaurantId]);

  // Filter orders based on selected filter
  const filteredOrders = useMemo(() => {
    if (filterKey === "all") return orders;
    if (filterKey === "payment-pending") {
      return orders.filter((o) => o.paymentStatus === "unpaid");
    }
    return orders.filter((o) => o.status === filterKey);
  }, [orders, filterKey]);

  // Auto-select first order if none selected
  useEffect(() => {
    if (!selectedOrder && filteredOrders.length > 0) {
      setSelectedOrder(filteredOrders[0]);
    }
  }, [filteredOrders, selectedOrder]);

  const handleUpdateOrder = async (orderId, updates) => {
    try {
      await updateOrderBillDetails(restaurantId, orderId, updates);
      toast.success("Bill details saved!");
    } catch (err) {
      console.error("Error updating order:", err);
      throw new Error(err.message || "Failed to update bill");
    }
  };

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
          .gst-section {
            font-size: 10px;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #000;
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
            <div class="gst-section">
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
  };

  if (loading) {
    return (
      <AdminShell restaurantName={restaurant?.name}>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading POS...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell restaurantName={restaurant?.name}>
      {error && <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT: ORDER LIST */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-xl">📋 Orders</h2>
              <Link
                href="/admin/bills-history"
                className="text-xs font-semibold text-gold hover:text-gold/70 transition"
              >
                View Bills →
              </Link>
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap gap-2">
              {ORDER_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setFilterKey(filter.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    filterKey === filter.key
                      ? "bg-gold text-bg-primary"
                      : `text-text-secondary hover:${filter.color}`
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Order List */}
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrder?.id === order.id}
                    onClick={() => setSelectedOrder(order)}
                  />
                ))
              ) : (
                <div className="flex h-32 items-center justify-center text-center text-text-muted">
                  <p>No orders in this category</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: BILLING PANEL */}
        {selectedOrder ? (
          <div className="lg:col-span-2 space-y-4">
            {/* Order Info Header */}
            <div className="card p-4 border-l-4 border-gold">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-text-muted">Order #{String(selectedOrder.id).substring(0, 8).toUpperCase()}</p>
                  <p className="mt-1 font-display text-2xl">Table {selectedOrder.tableNumber}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    🕐 {new Date(selectedOrder.createdAt?.toDate?.() || selectedOrder.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded-md border px-3 py-1 font-semibold capitalize ${STATUS_COLORS[selectedOrder.status]}`}>
                    {selectedOrder.status.replace(/_/g, " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="rounded-md border border-red-500/50 bg-red-500/10 p-2 hover:bg-red-500/20 transition text-red-400"
                    title="Delete this order"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Bill & Payment Sections */}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="card p-4">
                <BillCalculationPanel
                  order={selectedOrder}
                  restaurantSettings={restaurant}
                  onUpdateOrder={handleUpdateOrder}
                />
              </div>

              <div className="card p-4">
                <PaymentSection
                  order={selectedOrder}
                  onUpdatePaymentStatus={(id, status) => updateOrderPaymentStatus(restaurantId, id, status, selectedOrder)}
                  onUpdateOrderStatus={(id, status) => updateOrderStatus(restaurantId, id, status)}
                />
              </div>
            </div>

            {/* QR Payment Section */}
            {restaurant?.paymentQR && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4 border-2 border-gold/50">
                <h3 className="mb-4 font-display text-lg">📱 QR Payment</h3>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <img src={restaurant.paymentQR} alt="Payment QR" className="h-32 w-32 rounded-lg" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Customer can scan to pay</p>
                    <p className="mt-2 font-display text-xl font-bold text-gold">
                      ₹{Number(selectedOrder.finalAmount || selectedOrder.total || 0).toFixed(0)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bill Generation */}
            <div className="card p-4">
              <h3 className="mb-4 font-display text-lg">🧾 Generate Bill</h3>
              
              {/* Print Size Selector */}
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm font-semibold text-text-secondary">Print Size:</label>
                <select
                  value={printSize}
                  onChange={(e) => setPrintSize(e.target.value)}
                  className="rounded border border-border-theme bg-bg-primary px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  <option value="58mm">58mm (Thermal)</option>
                  <option value="80mm">80mm (Standard)</option>
                  <option value="210mm">210mm (A4)</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button 
                  type="button" 
                  onClick={() => handlePrintBill(selectedOrder, restaurant, printSize)}
                  className="btn-gold flex items-center justify-center gap-2 py-3 hover:opacity-90 transition"
                >
                  <Printer size={16} />
                  Print
                </button>
                <button type="button" className="flex items-center justify-center gap-2 rounded-lg border border-border-theme py-3 transition hover:bg-bg-card cursor-not-allowed opacity-50">
                  <Download size={16} />
                  PDF
                </button>
                <button type="button" className="flex items-center justify-center gap-2 rounded-lg border border-border-theme py-3 transition hover:bg-bg-card cursor-not-allowed opacity-50">
                  <QrCode size={16} />
                  Share
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 card flex h-96 items-center justify-center text-center text-text-muted">
            <p>Select an order to view billing details</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="card w-96 p-6"
          >
            <h3 className="font-display text-lg mb-2">⚠️ Delete Order?</h3>
            <p className="text-sm text-text-secondary mb-4">
              Permanently delete order #{String(selectedOrder?.id).substring(0, 8).toUpperCase()} from Table {selectedOrder?.tableNumber}? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-border-theme py-2 text-sm font-semibold transition hover:bg-bg-card disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteOrder(restaurantId, selectedOrder.id);
                    setSelectedOrder(null);
                    setShowDeleteModal(false);
                    toast.success("Order deleted");
                  } catch (err) {
                    toast.error(err.message || "Failed to delete order");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-500/20 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/30 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AdminShell>
  );
}
