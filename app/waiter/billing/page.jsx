"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  subscribeToOrders,
  subscribeToRestaurant,
  subscribeToMenu,
  subscribeToTables,
  updateOrderStatus,
  updateOrderPaymentStatus,
  updateOrderBillDetails,
  placeOrder,
} from "@/lib/firestore";

// BillCalculations Component
function BillCalculations({ order, restaurantId, orderId, onUpdate }) {
  const [gstPercent, setGstPercent] = useState(Number(order.gstPercent || 5));
  const [serviceChargePercent, setServiceChargePercent] = useState(Number(order.serviceChargePercent || 0));
  const [discountType, setDiscountType] = useState(order.discountType || "flat");
  const [discountValue, setDiscountValue] = useState(Number(order.discount || 0));

  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const gstAmount = Math.round(subtotal * (gstPercent / 100));
  const serviceChargeAmount = Math.round(subtotal * (serviceChargePercent / 100));
  const discount = discountType === "percentage" ? Math.round(subtotal * (discountValue / 100)) : discountValue;
  const grandTotal = subtotal + gstAmount + serviceChargeAmount - discount;

  const debounceUpdate = useRef(null);
  const saveChanges = (updates) => {
    clearTimeout(debounceUpdate.current);
    debounceUpdate.current = setTimeout(() => {
      onUpdate(updates);
    }, 500);
  };

  useEffect(() => {
    setGstPercent(Number(order.gstPercent || 5));
    setServiceChargePercent(Number(order.serviceChargePercent || 0));
    setDiscountType(order.discountType || "flat");
    setDiscountValue(Number(order.discount || 0));
  }, [order.id]);

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
            setGstPercent(Number(e.target.value));
            saveChanges({ gstPercent: Number(e.target.value) });
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
            setServiceChargePercent(Number(e.target.value));
            saveChanges({ serviceChargePercent: Number(e.target.value) });
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
              setDiscountType("flat");
              saveChanges({ discountType: "flat" });
            }}
            className={`px-2 py-1 text-xs rounded transition flex-shrink-0 ${
              discountType === "flat"
                ? "bg-amber-500 text-black font-semibold"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            ₹
          </button>
          <button
            onClick={() => {
              setDiscountType("percentage");
              saveChanges({ discountType: "percentage" });
            }}
            className={`px-2 py-1 text-xs rounded transition flex-shrink-0 ${
              discountType === "percentage"
                ? "bg-amber-500 text-black font-semibold"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
            setDiscountValue(Number(e.target.value));
            saveChanges({ discount: Number(e.target.value), discountType });
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
  );
}

// Main Waiter Billing Page
export default function WaiterBillingPage() {
  const { loading, restaurantId, error: userError, user } = useCurrentUser({
    allowedRoles: ["waiter", "staff"],
  });
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState("");
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [createBillModalOpen, setCreateBillModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [createBillMenuSearch, setCreateBillMenuSearch] = useState("");
  const [createBillItems, setCreateBillItems] = useState([]);

  // Subscribe to real-time orders
  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToOrders(restaurantId, setOrders, (e) => {
      setError(e.message || "Failed to load orders");
    });
    return () => unsub?.();
  }, [restaurantId]);

  // Subscribe to menu
  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToMenu(restaurantId, setMenu, (e) => {
      console.error("Failed to load menu:", e);
    });
    return () => unsub?.();
  }, [restaurantId]);

  // Subscribe to restaurant
  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToRestaurant(restaurantId, setRestaurant, (e) => {
      console.error("Failed to load restaurant:", e);
    });
    return () => unsub?.();
  }, [restaurantId]);

  // Subscribe to tables
  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToTables(restaurantId, setTables, (e) => {
      console.error("Failed to load tables:", e);
    });
    return () => unsub?.();
  }, [restaurantId]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusMatch = statusFilter === "all" || order.status === statusFilter;
      const paymentMatch = paymentFilter === "all" || order.paymentStatus === paymentFilter;
      const searchMatch = !searchQuery || 
        String(order.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(order.tableNumber || "").includes(searchQuery) ||
        (order.items || []).some(item => (item.name || "").toLowerCase().includes(searchQuery.toLowerCase()));
      return statusMatch && paymentMatch && searchMatch;
    });
  }, [orders, statusFilter, paymentFilter, searchQuery]);

  // Get selected order
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId);
  }, [orders, selectedOrderId]);

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-amber-900/30 text-amber-200";
      case "preparing":
        return "bg-blue-900/30 text-blue-200";
      case "served":
        return "bg-cyan-900/30 text-cyan-200";
      case "completed":
        return "bg-green-900/30 text-green-200";
      default:
        return "bg-gray-900/30 text-gray-200";
    }
  };

  const getPaymentColor = (status) => {
    if (status === "paid") return "bg-green-900/30 text-green-200";
    return "bg-red-900/30 text-red-200";
  };

  const handleAddItemToCreateBill = (menuItem) => {
    const existingItem = createBillItems.find(i => i.id === menuItem.id);
    if (existingItem) {
      setCreateBillItems(createBillItems.map(i => 
        i.id === menuItem.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i
      ));
    } else {
      setCreateBillItems([...createBillItems, {
        id: menuItem.id,
        name: menuItem.name,
        price: Number(menuItem.price || 0),
        quantity: 1
      }]);
    }
  };

  const handleRemoveItemFromCreateBill = (itemId) => {
    setCreateBillItems(createBillItems.filter(i => i.id !== itemId));
  };

  const handleChangeCreateBillItemQty = (itemId, qty) => {
    if (qty <= 0) {
      handleRemoveItemFromCreateBill(itemId);
    } else {
      setCreateBillItems(createBillItems.map(i =>
        i.id === itemId ? { ...i, quantity: qty } : i
      ));
    }
  };

  const createBillTotal = createBillItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

  const handleGenerateBill = async () => {
    if (!restaurantId) return;
    if (!createBillItems.length) {
      toast.error("No items selected");
      return;
    }
    if (!selectedTable) {
      toast.error("Please select a table");
      return;
    }

    try {
      const items = createBillItems.map(it => ({
        name: it.name,
        price: it.price,
        quantity: it.quantity
      }));
      
      await placeOrder(restaurantId, {
        tableNumber: selectedTable.tableNumber,
        tableId: selectedTable.id,
        items,
        total: createBillTotal,
        status: "pending",
        paymentStatus: "unpaid",
        paymentMethod: "cash",
        createdBy: user?.displayName || user?.email || "Waiter"
      });
      
      toast.success("Order created successfully");
      setCreateBillModalOpen(false);
      setCreateBillItems([]);
      setSelectedTable(null);
      setCreateBillMenuSearch("");
    } catch (e) {
      console.error("Failed to create order:", e);
      toast.error("Failed to create order");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    toast.success("Logged out");
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-amber-500">{restaurant?.name || "Waiter Billing"}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setCreateBillModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-lg transition"
          >
            + Create Bill
          </button>
          <button
            onClick={handleLogout}
            className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Orders List */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h2 className="text-xl font-semibold mb-4">Orders</h2>

            {/* Filters */}
            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="preparing">Preparing</option>
                  <option value="served">Served</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Payment Status</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                >
                  <option value="all">All</option>
                  <option value="unpaid">Payment Pending</option>
                  <option value="paid">Completed</option>
                </select>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
              {filteredOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No orders found</p>
              ) : (
                filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-3 rounded-lg cursor-pointer transition border ${
                      selectedOrderId === order.id
                        ? "bg-amber-500/20 border-amber-500"
                        : "bg-gray-800 border-gray-700 hover:border-amber-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">Order #{order.id?.slice(-6).toUpperCase()}</span>
                      <span className="text-xs text-gray-400">Table {order.tableNumber}</span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">{order.items?.length || 0} items</div>
                    <div className="flex gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.status)}`}>{order.status}</span>
                      <span className={`text-xs px-2 py-1 rounded ${getPaymentColor(order.paymentStatus)}`}>{order.paymentStatus}</span>
                    </div>
                    <div className="text-sm font-semibold mt-2 text-amber-500">₹{Number(order.total || 0).toFixed(0)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Order Details */}
        <div className="lg:col-span-2">
          {selectedOrder ? (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 space-y-4">
              {/* Order Header */}
              <div className="border-b border-gray-700 pb-4">
                <h2 className="text-2xl font-bold mb-2">Order #{selectedOrder.id?.slice(-6).toUpperCase()}</h2>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Table</p>
                    <p className="text-white font-semibold">Table {selectedOrder.tableNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created</p>
                    <p className="text-white font-semibold">
                      {selectedOrder.createdAt
                        ? new Date(
                            selectedOrder.createdAt.toDate?.() || new Date(selectedOrder.createdAt.seconds * 1000)
                          ).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bill Details - FULLY EDITABLE */}
              <div className="border-b border-gray-700 pb-4">
                <h3 className="text-lg font-semibold mb-3">Bill Items</h3>
                <div className="space-y-2 max-h-[250px] overflow-y-auto mb-3">
                  {selectedOrder.items?.length > 0 ? (
                    selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-800 p-2 rounded text-sm">
                        <div className="flex-1">
                          <p className="text-gray-300">{item.name}</p>
                          <p className="text-xs text-gray-500">₹{Number(item.price || 0).toFixed(0)}</p>
                        </div>
                        <div className="flex items-center gap-2 mr-2">
                          <button
                            onClick={() => {
                              const updatedItems = [...selectedOrder.items];
                              if (updatedItems[idx].quantity > 1) {
                                updatedItems[idx].quantity -= 1;
                                updateOrderBillDetails(restaurantId, selectedOrderId, { items: updatedItems });
                              }
                            }}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-semibold">{item.quantity || 1}</span>
                          <button
                            onClick={() => {
                              const updatedItems = [...selectedOrder.items];
                              updatedItems[idx].quantity += 1;
                              updateOrderBillDetails(restaurantId, selectedOrderId, { items: updatedItems });
                            }}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-amber-500 font-semibold w-16 text-right">₹{Number((item.price || 0) * (item.quantity || 1)).toFixed(0)}</span>
                        <button
                          onClick={() => {
                            const updatedItems = selectedOrder.items.filter((_, i) => i !== idx);
                            updateOrderBillDetails(restaurantId, selectedOrderId, { items: updatedItems });
                            toast.success("Item removed");
                          }}
                          className="text-red-400 hover:text-red-200 ml-2 text-xs"
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded mb-3 text-sm transition"
                >
                  + Add Item
                </button>

                {/* Bill Calculations - FULLY EDITABLE */}
                <BillCalculations
                  order={selectedOrder}
                  restaurantId={restaurantId}
                  orderId={selectedOrderId}
                  onUpdate={(updates) => updateOrderBillDetails(restaurantId, selectedOrderId, updates)}
                />
              </div>

              {/* Payment Section */}
              <div className="border-b border-gray-700 pb-4">
                <h3 className="text-lg font-semibold mb-3">Payment</h3>

                {/* Payment Method */}
                <div className="mb-3">
                  <label className="text-sm text-gray-400 mb-2 block">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Cash", "Card", "UPI"].map((method) => (
                      <button
                        key={method}
                        onClick={() => updateOrderBillDetails(restaurantId, selectedOrderId, { paymentMethod: method })}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                          selectedOrder.paymentMethod === method
                            ? "bg-amber-500 border-amber-500 text-black"
                            : "bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-400"
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Status */}
                <div className="flex gap-2">
                  {selectedOrder.paymentStatus === "unpaid" ? (
                    <button
                      onClick={() => updateOrderPaymentStatus(restaurantId, selectedOrderId, "paid", selectedOrder)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg transition"
                    >
                      ✓ Mark Paid
                    </button>
                  ) : (
                    <button
                      onClick={() => updateOrderPaymentStatus(restaurantId, selectedOrderId, "unpaid", selectedOrder)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition"
                    >
                      Mark Unpaid
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Status: <span className="text-white capitalize">{selectedOrder.paymentStatus}</span>
                </p>
              </div>

              {/* Order Status Section */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-3">Order Status</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {selectedOrder.status !== "pending" && (
                    <button
                      onClick={() => updateOrderStatus(restaurantId, selectedOrderId, "pending")}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-3 py-2 rounded-lg transition text-sm"
                    >
                      Pending
                    </button>
                  )}
                  {selectedOrder.status !== "preparing" && (
                    <button
                      onClick={() => updateOrderStatus(restaurantId, selectedOrderId, "preparing")}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-lg transition text-sm"
                    >
                      Preparing
                    </button>
                  )}
                  {selectedOrder.status !== "served" && (
                    <button
                      onClick={() => updateOrderStatus(restaurantId, selectedOrderId, "served")}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-3 py-2 rounded-lg transition text-sm"
                    >
                      Served
                    </button>
                  )}
                  {selectedOrder.status !== "completed" && (
                    <button
                      onClick={() => updateOrderStatus(restaurantId, selectedOrderId, "completed")}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-2 rounded-lg transition text-sm"
                    >
                      Completed
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Current: <span className="text-white capitalize">{selectedOrder.status}</span>
                </p>
              </div>

              {/* Print Bill Button */}
              <button
                onClick={() => printBill(selectedOrder, restaurant)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                🖨️ Print Bill (80mm)
              </button>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 flex items-center justify-center h-full">
              <p className="text-gray-500 text-center">Select an order to view details</p>
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
              <h3 className="text-xl font-semibold">Create Bill</h3>
              <button
                onClick={() => {
                  setCreateBillModalOpen(false);
                  setCreateBillItems([]);
                  setSelectedTable(null);
                  setCreateBillMenuSearch("");
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
                  value={selectedTable?.id || ""}
                  onChange={(e) => {
                    const table = tables.find(t => t.id === e.target.value);
                    setSelectedTable(table || null);
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
                  value={createBillMenuSearch}
                  onChange={(e) => setCreateBillMenuSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>

              {/* Menu Items Grid */}
              <div>
                <label className="block text-sm font-semibold mb-2">Menu Items</label>
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                  {menu
                    .filter(item => !createBillMenuSearch || (item.name || "").toLowerCase().includes(createBillMenuSearch.toLowerCase()))
                    .map(item => (
                      <div
                        key={item.id}
                        className="bg-gray-800 border border-gray-700 rounded p-2"
                      >
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400 mb-2">₹{Number(item.price || 0).toFixed(0)}</p>
                        <button
                          onClick={() => handleAddItemToCreateBill(item)}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-1 rounded text-xs transition"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Selected Items */}
              {createBillItems.length > 0 && (
                <div className="bg-gray-800 rounded p-3 border border-gray-700">
                  <h4 className="font-semibold mb-2 text-sm">Selected Items</h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto mb-2">
                    {createBillItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleChangeCreateBillItemQty(item.id, (item.quantity || 1) - 1)}
                              className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                            >
                              -
                            </button>
                            <span className="w-6 text-center">{item.quantity || 1}</span>
                            <button
                              onClick={() => handleChangeCreateBillItemQty(item.id, (item.quantity || 1) + 1)}
                              className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-amber-500 font-semibold w-16 text-right">
                            ₹{Number(item.price * (item.quantity || 1)).toFixed(0)}
                          </span>
                          <button
                            onClick={() => handleRemoveItemFromCreateBill(item.id)}
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
                    <span className="text-amber-500">₹{createBillTotal.toFixed(0)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex gap-2">
              <button
                onClick={() => {
                  setCreateBillModalOpen(false);
                  setCreateBillItems([]);
                  setSelectedTable(null);
                  setCreateBillMenuSearch("");
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateBill}
                disabled={!selectedTable || createBillItems.length === 0}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-black font-semibold px-4 py-2 rounded-lg transition disabled:cursor-not-allowed"
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
                  setAddItemModalOpen(false);
                  setAddItemSearch("");
                  setAddItemQuantity(1);
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
                    .filter((item) => !addItemSearch || (item.name || "").toLowerCase().includes(addItemSearch.toLowerCase()))
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          const updatedItems = [...(selectedOrder.items || []), { id: item.id, name: item.name, price: Number(item.price || 0), quantity: addItemQuantity }];
                          updateOrderBillDetails(restaurantId, selectedOrderId, { items: updatedItems });
                          toast.success("Item added to bill");
                          setAddItemModalOpen(false);
                          setAddItemSearch("");
                          setAddItemQuantity(1);
                        }}
                        className="bg-gray-800 border border-gray-700 rounded p-3 cursor-pointer hover:border-amber-500/50 transition"
                      >
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400 mb-2">₹{Number(item.price || 0).toFixed(0)}</p>
                        <button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-1 rounded text-xs transition">
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
                  setAddItemModalOpen(false);
                  setAddItemSearch("");
                  setAddItemQuantity(1);
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
  );
}


// Shared bill printer (local, side-effect free) for use across components
export function printBill(order, restaurantInfo, printSize = "80mm") {
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
        body { font-family: Arial, sans-serif; max-width: ${maxWidth}; margin: 0; padding: 10px; background: white; }
        .invoice { border: 1px solid #000; padding: 15px; text-align: center; }
        .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .restaurant-name { font-size: 16px; font-weight: bold; }
        .bill-info { text-align: left; font-size: 12px; margin: 10px 0; }
        .items { text-align: left; margin: 15px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 0; }
        .item-row { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }
        .totals { text-align: left; font-size: 12px; margin: 10px 0; }
        .grand-total { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 0; margin: 10px 0; font-weight: bold; font-size: 14px; }
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
            <span style="flex: 1;">Item</span><span style="width: 30px; text-align: center;">Qty</span><span style="width: 50px; text-align: right;">Amount</span>
          </div>
          ${items.map((it) => `<div class="item-row"><div class="item-name">${it.name}</div><div class="item-qty">${it.quantity}</div><div class="item-price">₹${(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(0)}</div></div>`).join('')}
        </div>
        <div class="totals">
          <div class="total-row"><span class="total-label">Subtotal:</span><span class="total-value">₹${subtotal.toFixed(0)}</span></div>
          ${gstAmount > 0 ? `<div class="total-row"><span class="total-label">GST (${gstPercent}%):</span><span class="total-value">₹${gstAmount.toFixed(0)}</span></div>` : ''}
          ${serviceChargeAmount > 0 ? `<div class="total-row"><span class="total-label">Service:</span><span class="total-value">₹${serviceChargeAmount.toFixed(0)}</span></div>` : ''}
          ${discount > 0 ? `<div class="total-row"><span class="total-label">Discount:</span><span class="total-value">-₹${discount.toFixed(0)}</span></div>` : ''}
        </div>
        <div class="grand-total"><div style="display: flex; justify-content: space-between;"><span>TOTAL:</span><span>₹${finalTotal.toFixed(0)}</span></div></div>
        <div class="bill-info"><p><strong>Payment Status:</strong> ${order.paymentStatus === 'paid' ? '✓ PAID' : 'UNPAID'}</p><p><strong>Payment Method:</strong> ${order.paymentMethod || 'Cash'}</p></div>
      </div>
    </body>
    </html>
  `;

  const w = window.open('', '_blank');
  w.document.write(billHTML);
  w.document.close();
  w.print();
}

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

  // Print handler moved above render to fix initialization order
  function handlePrintBill(order, restaurantInfo, printSize = "80mm") {
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

  // Add Print Bill handler here to ensure it's defined before UI references
  function handlePrintBill(order, restaurantInfo, printSize = "80mm") {
    if (!order) return;

    const items = order.items || [];
    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const gstPercent = Number(order.gstPercent || 5);
    const gstAmount = Math.round(subtotal * (gstPercent / 100));
    const serviceChargePercent = Number(order.serviceChargePercent || 0);
    const serviceChargeAmount = Math.round(subtotal * (serviceChargePercent / 100));
    const discount = Number(order.discount || 0);
    const finalTotal = subtotal + gstAmount + serviceChargeAmount - discount;

    const maxWidth = printSize === "58mm" ? "58mm" : printSize === "80mm" ? "80mm" : "210mm";

    const billHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bill - Table ${order.tableNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: ${maxWidth}; margin: 0; padding: 10px; background: white; }
          .invoice { border: 1px solid #000; padding: 15px; text-align: center; }
          .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .restaurant-name { font-size: 16px; font-weight: bold; }
          .bill-info { text-align: left; font-size: 12px; margin: 10px 0; }
          .items { text-align: left; margin: 15px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 0; }
          .item-row { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }
          .totals { text-align: left; font-size: 12px; margin: 10px 0; }
          .grand-total { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 0; margin: 10px 0; font-weight: bold; font-size: 14px; }
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
              <span style="flex: 1;">Item</span><span style="width: 30px; text-align: center;">Qty</span><span style="width: 50px; text-align: right;">Amount</span>
            </div>
            ${items.map((it) => `<div class="item-row"><div class="item-name">${it.name}</div><div class="item-qty">${it.quantity}</div><div class="item-price">₹${(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(0)}</div></div>`).join('')}
          </div>
          <div class="totals">
            <div class="total-row"><span class="total-label">Subtotal:</span><span class="total-value">₹${subtotal.toFixed(0)}</span></div>
            ${gstAmount > 0 ? `<div class="total-row"><span class="total-label">GST (${gstPercent}%):</span><span class="total-value">₹${gstAmount.toFixed(0)}</span></div>` : ''}
            ${serviceChargeAmount > 0 ? `<div class="total-row"><span class="total-label">Service:</span><span class="total-value">₹${serviceChargeAmount.toFixed(0)}</span></div>` : ''}
            ${discount > 0 ? `<div class="total-row"><span class="total-label">Discount:</span><span class="total-value">-₹${discount.toFixed(0)}</span></div>` : ''}
          </div>
          <div class="grand-total"><div style="display: flex; justify-content: space-between;"><span>TOTAL:</span><span>₹${finalTotal.toFixed(0)}</span></div></div>
          <div class="bill-info"><p><strong>Payment Status:</strong> ${order.paymentStatus === 'paid' ? '✓ PAID' : 'UNPAID'}</p><p><strong>Payment Method:</strong> ${order.paymentMethod || 'Cash'}</p></div>
        </div>
      </body>
      </html>
    `;

    const w = window.open('', '_blank');
    w.document.write(billHTML);
    w.document.close();
    w.print();
  }

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
        onClick={() => printBill(order, restaurant, printSize)}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-gold p-3 text-sm font-semibold text-bg-primary transition hover:bg-gold/90"
      >
        <Printer size={16} />
        Print Bill
      </button>
    </div>
  );
}
