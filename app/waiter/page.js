"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, LogOut, ClipboardList, UtensilsCrossed, Grid3x3 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import MenuItem from "@/components/MenuItem";
import TableCard from "@/components/TableCard";
import { placeOrder, subscribeToMenu, subscribeToTables, subscribeToOrders, subscribeToRestaurant, updateOrderBillDetails, updateOrderStatus } from "@/lib/firestore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { auth } from "@/lib/firebase";
import { getStartOfDay, getEndOfDay } from "@/lib/dateUtils";

const CATEGORY_TABS = [
  { label: "All", value: "all" },
  { label: "Veg", value: "veg" },
  { label: "Non-Veg", value: "non-veg" },
  { label: "Drinks", value: "drinks" },
  { label: "Dessert", value: "dessert" },
];

export default function WaiterPage() {
  const { loading, user, profile, role, restaurantId, error, setError } = useCurrentUser({ allowedRoles: ["waiter"] });
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [restaurantName, setRestaurantName] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [activeTab, setActiveTab] = useState("tables"); // "tables", "myorders", "menu"
  const [searchTerm, setSearchTerm] = useState("");
  const [editingOrder, setEditingOrder] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [editMenuSearch, setEditMenuSearch] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "pending", "preparing", "served"
  const [selectedOrdersForBulk, setSelectedOrdersForBulk] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showStatusHistory, setShowStatusHistory] = useState(null); // order ID to show history for

  // Estimated prep times (in minutes)
  const PREP_TIME_ESTIMATES = {
    pending: { elapsed: 0, estimated: 0, message: "Not started" },
    preparing: { elapsed: 0, estimated: 15, message: "Cooking" },
    served: { elapsed: 0, estimated: 0, message: "Ready to serve" },
    completed: { elapsed: 0, estimated: 0, message: "Completed" },
  };

  const STATUS_OPTIONS = [
    { value: "pending", label: "Pending", color: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
    { value: "preparing", label: "Preparing", color: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
    { value: "served", label: "Served", color: "bg-green-500/10 text-green-300 border-green-500/30" },
    { value: "completed", label: "Completed", color: "bg-purple-500/10 text-purple-300 border-purple-500/30" },
  ];

  const getStatusColor = (status) => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status || (status === "ordered" && opt.value === "pending"));
    return option?.color || "bg-gray-500/10 text-gray-300 border-gray-500/30";
  };

  const getEstimatedPrepTime = (order) => {
    const status = order.status || "pending";
    if (!order.createdAt?.toDate) return PREP_TIME_ESTIMATES[status];
    
    const createdTime = order.createdAt.toDate().getTime();
    const elapsedMins = Math.floor((Date.now() - createdTime) / 60000);
    const estimate = PREP_TIME_ESTIMATES[status].estimated;
    
    return {
      ...PREP_TIME_ESTIMATES[status],
      elapsed: elapsedMins,
      remaining: Math.max(0, estimate - elapsedMins),
    };
  };

  const formatEstimatedTime = (order) => {
    const prep = getEstimatedPrepTime(order);
    if (prep.estimated === 0) return prep.message;
    if (prep.remaining > 0) return `~${prep.remaining}min left`;
    return `${prep.elapsed}min elapsed`;
  };

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubTables = subscribeToTables(restaurantId, setTables, (e) => setError(e.message));
    const unsubMenu = subscribeToMenu(restaurantId, setMenu, (e) => setError(e.message));
    const unsubOrders = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message));
    const unsubRestaurant = subscribeToRestaurant(restaurantId, (data) => {
      setRestaurantName(data?.name || "");
    }, (e) => setError(e.message));
    return () => {
      unsubTables();
      unsubMenu();
      unsubOrders();
      unsubRestaurant();
    };
  }, [restaurantId, setError]);

  const filteredMenu = useMemo(() => {
    const items = menu.map((item) => ({
      ...item,
      category: String(item.category || "").trim().toLowerCase(),
    }));
    let filtered = category === "all" ? items : items.filter((item) => item.category === category);
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(term) ||
        item.category?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [category, menu, searchTerm]);
  const cartItems = useMemo(() => cart, [cart]);
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + Number(item.quantity), 0), [cart]);
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0),
    [cart]
  );

  // Dashboard stats
  const myOrdersToday = useMemo(() => {
    const startOfDay = getStartOfDay();
    const endOfDay = getEndOfDay();
    return orders.filter((o) => {
      if (o.createdBy !== user?.uid) return false;
      if (!o.createdAt?.toDate) return false;
      const orderDate = o.createdAt.toDate();
      return orderDate >= startOfDay && orderDate <= endOfDay;
    });
  }, [orders, user?.uid]);

  // Filtered orders with status filter
  const filteredOrdersToday = useMemo(() => {
    if (statusFilter === "all") return myOrdersToday;
    return myOrdersToday.filter(o => (o.status || "pending") === statusFilter);
  }, [myOrdersToday, statusFilter]);

  const occupiedTables = useMemo(() => tables.filter((t) => t.status === "occupied" || t.isOccupied).length, [tables]);
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);
  const editMenuItems = useMemo(() => {
    const query = editMenuSearch.trim().toLowerCase();
    if (!query) return menu.slice(0, 8);
    return menu.filter((item) => (item.name || "").toLowerCase().includes(query)).slice(0, 8);
  }, [editMenuSearch, menu]);

  function addToCart(item) {
    setCart((prev) => {
      const existingItem = prev.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return prev.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: 1,
        },
      ];
    });
  }

  function removeFromCart(item) {
    setCart((prev) => {
      const existingItem = prev.find((cartItem) => cartItem.id === item.id);
      if (!existingItem) return prev;
      if (existingItem.quantity <= 1) {
        return prev.filter((cartItem) => cartItem.id !== item.id);
      }
      return prev.map((cartItem) =>
        cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity - 1 } : cartItem
      );
    });
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      toast.success("Logged out");
      router.push("/login");
    } catch (err) {
      toast.error("Logout failed");
    }
  }

  async function submitOrder() {
    if (!selectedTable || !restaurantId) return;
    if (cart.length === 0) {
      toast.error("Cart empty");
      return;
    }
    setPlacing(true);
    setError("");
    try {
      await placeOrder(restaurantId, {
        tableId: selectedTable.id,
        tableNumber: selectedTable.tableNumber,
        items: cart,
        total,
        createdBy: user?.uid,
        createdByName: profile?.displayName || user?.displayName || user?.email || "Waiter",
        lastUpdatedBy: user?.uid,
        lastUpdatedByName: profile?.displayName || user?.displayName || user?.email || "Waiter",
        paymentStatus: "unpaid",
      });
      toast.success("Order placed successfully");
      setCart([]);
      setCartOpen(false);
      setSelectedTable(null);
      setStep(1);
    } catch (placeError) {
      setError(placeError.message || "Unable to place order.");
      toast.error("Order failed");
    } finally {
      setPlacing(false);
    }
  }

  function startEditingOrder(order) {
    setEditingOrder(order);
    setDraftItems((order.items || []).map((item) => ({ ...item })));
    setEditMenuSearch("");
  }

  function changeDraftItem(item, delta) {
    setDraftItems((prev) => {
      const existing = prev.find((draftItem) => draftItem.id === item.id);
      if (!existing && delta > 0) {
        return [
          ...prev,
          {
            id: item.id,
            name: item.name,
            price: Number(item.price || 0),
            quantity: 1,
            category: item.category,
          },
        ];
      }
      return prev
        .map((draftItem) =>
          draftItem.id === item.id
            ? { ...draftItem, quantity: Math.max(0, Number(draftItem.quantity || 0) + delta) }
            : draftItem
        )
        .filter((draftItem) => Number(draftItem.quantity || 0) > 0);
    });
  }

  async function saveEditedOrder() {
    if (!restaurantId || !editingOrder?.id) return;
    if (!draftItems.length) {
      toast.error("Order needs at least one item");
      return;
    }
    setSavingChanges(true);
    try {
      await updateOrderBillDetails(
        restaurantId,
        editingOrder.id,
        {
          items: draftItems,
          gstPercent: editingOrder.gstPercent,
          serviceChargePercent: editingOrder.serviceChargePercent,
          discount: editingOrder.discount,
          discountType: editingOrder.discountType,
          paymentMethod: editingOrder.paymentMethod,
        },
        {
          uid: user?.uid,
          name: profile?.displayName || user?.displayName || user?.email || "Waiter",
        }
      );
      toast.success("Changes saved");
      setEditingOrder(null);
      setDraftItems([]);
    } catch (err) {
      toast.error(err.message || "Could not save changes");
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleOrderStatusUpdate(orderId, newStatus) {
    if (!restaurantId) return;
    setUpdatingOrderStatus(orderId);
    try {
      await updateOrderStatus(restaurantId, orderId, newStatus, {
        uid: user?.uid,
        name: profile?.displayName || user?.displayName || user?.email || "Waiter",
      });
      toast.success(`Order status updated to ${newStatus}`);
    } catch (err) {
      toast.error(err.message || "Could not update order status");
    } finally {
      setUpdatingOrderStatus(null);
    }
  }

  async function handleBulkStatusUpdate(newStatus) {
    if (selectedOrdersForBulk.size === 0) {
      toast.error("Select at least one order");
      return;
    }
    if (!restaurantId) return;
    setBulkUpdating(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const orderId of selectedOrdersForBulk) {
        try {
          await updateOrderStatus(restaurantId, orderId, newStatus, {
            uid: user?.uid,
            name: profile?.displayName || user?.displayName || user?.email || "Waiter",
          });
          successCount++;
        } catch (err) {
          failCount++;
          console.warn(`Failed to update order ${orderId}:`, err.message);
        }
      }

      if (successCount > 0) {
        toast.success(`Updated ${successCount} order${successCount > 1 ? "s" : ""} to ${newStatus}`);
        setSelectedOrdersForBulk(new Set());
      }
      if (failCount > 0) {
        toast.error(`Failed to update ${failCount} order${failCount > 1 ? "s" : ""}`);
      }
    } finally {
      setBulkUpdating(false);
    }
  }

  function toggleOrderSelection(orderId) {
    const newSelected = new Set(selectedOrdersForBulk);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrdersForBulk(newSelected);
  }

  function toggleAllOrdersSelection() {
    if (selectedOrdersForBulk.size === filteredOrdersToday.length) {
      setSelectedOrdersForBulk(new Set());
    } else {
      setSelectedOrdersForBulk(new Set(filteredOrdersToday.map(o => o.id)));
    }
  }

  function toggleOrderSelection(orderId) {
    const newSelected = new Set(selectedOrdersForBulk);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrdersForBulk(newSelected);
  }

  function toggleAllOrdersSelection() {
    if (selectedOrdersForBulk.size === filteredOrdersToday.length) {
      setSelectedOrdersForBulk(new Set());
    } else {
      setSelectedOrdersForBulk(new Set(filteredOrdersToday.map(o => o.id)));
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md flex items-center justify-center px-4 py-4">
        <div className="text-center">
          <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-sm text-text-muted">Loading waiter app...</p>
        </div>
      </main>
    );
  }
  if (!restaurantId) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md flex items-center justify-center px-4 py-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm">
          <p>Restaurant not assigned.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-4 pb-24">
      {/* HEADER */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-bg-primary font-bold">
            {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "W"}
          </div>
          <div>
            <h1 className="font-display text-lg text-gold">
              Welcome {restaurantName || "Restaurant"} Staff
            </h1>
            <p className="text-xs text-text-muted">{user?.displayName || user?.email}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs badge-amber">Today: {myOrdersToday.length} orders</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded px-3 py-1 text-xs text-red-500 border border-red-500/30 hover:bg-red-500/10 transition"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {/* DASHBOARD (when step === 1 and not selecting table) */}
      {step === 1 && activeTab === "tables" && (
        <section className="mb-6">
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-gold">{myOrdersToday.length}</p>
              <p className="text-xs text-text-muted">Your orders</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-gold">{occupiedTables}/{tables.length}</p>
              <p className="text-xs text-text-muted">Tables occupied</p>
            </div>
            <div className="card p-3 text-center">
              <p className={`text-2xl font-bold ${pendingOrders > 0 ? 'text-red-500' : 'text-green-500'}`}>{pendingOrders}</p>
              <p className="text-xs text-text-muted">Pending</p>
            </div>
          </div>
        </section>
      )}

      {/* CONTENT: TABLES TAB */}
      {activeTab === "tables" && (
        <>
          {step === 1 ? (
            <section>
              <h2 className="mb-3 font-display text-2xl">Select a Table</h2>
              <div className="grid grid-cols-2 gap-3">
                {tables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    onSelect={(t) => {
                      setSelectedTable(t);
                      setStep(2);
                    }}
                  />
                ))}
              </div>
              {!tables.length ? <p className="mt-6 text-center text-sm text-text-muted">No tables configured yet.</p> : null}
            </section>
          ) : (
            <section className="pb-24">
              <div className="sticky top-2 z-10 mb-3 rounded-xl border border-border-theme bg-bg-card px-3 py-2 text-sm flex justify-between items-center">
                <span>Table {selectedTable?.tableNumber}</span>
                <button type="button" onClick={() => setStep(1)} className="text-gold-light">
                  Change
                </button>
              </div>

              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 input-gold px-3 py-2 text-sm"
                />
              </div>

              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setCategory(tab.value)}
                    className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${category === tab.value ? "border-gold text-gold" : "border-border-theme text-text-secondary"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredMenu.map((item) => (
                  <MenuItem
                    key={item.id}
                    item={item}
                    quantity={cart.find((cartItem) => cartItem.id === item.id)?.quantity || 0}
                    onAdd={addToCart}
                    onRemove={removeFromCart}
                  />
                ))}
              </div>

              {!filteredMenu.length ? <p className="mt-6 text-sm text-text-muted">No menu items in this category.</p> : null}
            </section>
          )}
        </>
      )}

      {/* CONTENT: MY ORDERS TAB */}
      {activeTab === "myorders" && (
        <section>
          <h2 className="mb-4 font-display text-2xl">My Orders Today</h2>

          {/* Status Filter Controls */}
          {myOrdersToday.length > 0 && (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setStatusFilter("all")}
                className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap font-semibold transition ${
                  statusFilter === "all" 
                    ? "border-gold bg-gold text-bg-primary" 
                    : "border-border-theme text-text-secondary hover:border-gold"
                }`}
              >
                All ({myOrdersToday.length})
              </button>
              {["pending", "preparing", "served"].map((status) => {
                const count = myOrdersToday.filter(o => (o.status || "pending") === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap font-semibold transition ${
                      statusFilter === status 
                        ? "border-gold bg-gold text-bg-primary" 
                        : "border-border-theme text-text-secondary hover:border-gold"
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Bulk Status Update Bar (only show when orders selected) */}
          {selectedOrdersForBulk.size > 0 && filteredOrdersToday.length > 0 && (
            <div className="mb-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-bg-card border border-border-theme">
              <span className="text-sm font-semibold text-gold">{selectedOrdersForBulk.size} selected</span>
              <div className="flex gap-2">
                {STATUS_OPTIONS.filter(opt => opt.value !== "pending").map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleBulkStatusUpdate(opt.value)}
                    disabled={bulkUpdating}
                    className={`text-xs font-semibold px-2 py-1 rounded border transition ${
                      bulkUpdating ? "opacity-50 cursor-not-allowed" : `${opt.color} hover:opacity-80`
                    }`}
                  >
                    {bulkUpdating ? "..." : `${opt.label}`}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedOrdersForBulk(new Set())}
                  className="text-xs font-semibold px-2 py-1 rounded border border-text-muted/30 text-text-muted hover:text-text-primary transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Orders List */}
          <div className="space-y-3">
            {filteredOrdersToday.length > 0 ? (
              filteredOrdersToday.map((order) => (
                <motion.div key={order.id} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                  <div className={`card border-l-4 border-l-gold p-4 transition ${
                    selectedOrdersForBulk.has(order.id) ? "ring-2 ring-gold bg-gold/5" : ""
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      {/* Checkbox for bulk selection */}
                      <input
                        type="checkbox"
                        checked={selectedOrdersForBulk.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="w-5 h-5 rounded mt-0.5"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">Table {order.tableNumber}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(order.status || "pending")}`}>
                            {(order.status || "pending").charAt(0).toUpperCase() + (order.status || "pending").slice(1)}
                          </span>
                          <span className="text-xs text-text-muted">{formatEstimatedTime(order)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setShowStatusHistory(order.id)}
                          className="rounded border border-text-muted/30 px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-bg-card transition"
                          title="View status history"
                        >
                          📋
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingOrder(order)}
                          className="rounded-lg border border-gold px-2 py-1 text-xs font-semibold text-gold transition hover:bg-gold/10"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Status Update Controls */}
                    {order.status !== "served" && order.status !== "completed" && (
                      <div className="mb-3 flex gap-2">
                        {STATUS_OPTIONS.filter(opt => {
                          const currentStatus = order.status || "pending";
                          // Allow transition logic
                          if (currentStatus === "pending") return opt.value === "preparing";
                          if (currentStatus === "preparing") return opt.value === "served";
                          return false;
                        }).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleOrderStatusUpdate(order.id, opt.value)}
                            disabled={updatingOrderStatus === order.id}
                            className={`flex-1 rounded border px-2 py-1.5 text-xs font-semibold transition ${
                              updatingOrderStatus === order.id 
                                ? "opacity-50 cursor-not-allowed" 
                                : `${opt.color} hover:opacity-80`
                            }`}
                          >
                            {updatingOrderStatus === order.id ? "..." : `→ ${opt.label}`}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="mt-3 space-y-1 text-sm text-text-secondary">
                      {(order.items || []).map((item, idx) => (
                        <div key={`${order.id}-${idx}-${item.id || item.name}`} className="flex items-center justify-between">
                          <span>{item.quantity}x {item.name}</span>
                          <span>₹{Number(item.price || 0) * Number(item.quantity || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="card p-8 text-center text-text-muted">
                <p>{statusFilter === "all" ? "No orders placed today yet." : `No ${statusFilter} orders.`}</p>
              </div>
            )}
          </div>

          {/* Status History Modal */}
          {showStatusHistory && filteredOrdersToday.find(o => o.id === showStatusHistory) && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60"
                onClick={() => setShowStatusHistory(null)}
              />
              <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-border-theme bg-bg-card p-4 max-w-md mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-xl">Status History</h3>
                  <button
                    onClick={() => setShowStatusHistory(null)}
                    className="text-text-muted hover:text-text-primary transition"
                  >
                    ✕
                  </button>
                </div>

                {(() => {
                  const order = filteredOrdersToday.find(o => o.id === showStatusHistory);
                  if (!order) return null;
                  
                  return (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold mb-3">Table {order.tableNumber}</p>
                      
                      {(order.statusHistory || []).length > 0 ? (
                        <div className="space-y-2">
                          {(order.statusHistory || []).map((entry, idx) => {
                            const timestamp = entry.changedAt;
                            const date = new Date(timestamp);
                            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            
                            return (
                              <div key={idx} className="flex items-start gap-3 pb-2 border-b border-border-theme last:border-0">
                                <div className="flex-shrink-0 mt-1">
                                  <div className={`w-2 h-2 rounded-full ${
                                    entry.status === "pending" ? "bg-orange-400" :
                                    entry.status === "preparing" ? "bg-blue-400" :
                                    entry.status === "served" ? "bg-green-400" :
                                    entry.status === "completed" ? "bg-purple-400" :
                                    "bg-gray-400"
                                  }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold capitalize">{entry.status}</p>
                                  <p className="text-xs text-text-muted">{entry.label}</p>
                                  <p className="text-xs text-text-muted mt-1">{time}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-text-muted">No status history available</p>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            </AnimatePresence>
          )}
        </section>
      )}

      {/* CONTENT: MENU TAB (full menu without table selection) */}
      {activeTab === "menu" && (
        <section className="pb-24">
          <h2 className="mb-3 font-display text-2xl">Menu</h2>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setCategory(tab.value)}
                className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${category === tab.value ? "border-gold text-gold" : "border-border-theme text-text-secondary"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {filteredMenu.map((item) => (
              <MenuItem key={item.id} item={item} quantity={0} onAdd={(i) => toast("Select table to add items")} onRemove={() => {}} />
            ))}
          </div>
        </section>
      )}

      {/* CART BUTTON (shows when on table + step 2) */}
      {step === 2 && activeTab === "tables" ? (
        <button
          type="button"
          className="btn-gold fixed bottom-20 left-4 right-4 z-20 flex items-center justify-between"
          onClick={() => setCartOpen(true)}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart size={16} />
            {itemCount} items
          </span>
          <span>₹{total.toFixed(0)}</span>
        </button>
      ) : null}

      {/* BOTTOM NAVIGATION (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border-theme bg-bg-primary px-4 py-3 flex justify-around max-w-md mx-auto">
        <button
          onClick={() => {
            setActiveTab("tables");
            setStep(1);
          }}
          className={`flex flex-col items-center gap-1 p-2 rounded transition ${activeTab === "tables" ? "text-gold" : "text-text-secondary"}`}
        >
          <Grid3x3 size={20} />
          <span className="text-xs">Tables</span>
        </button>
        <button
          onClick={() => setActiveTab("myorders")}
          className={`flex flex-col items-center gap-1 p-2 rounded transition relative ${activeTab === "myorders" ? "text-gold" : "text-text-secondary"}`}
        >
          <ClipboardList size={20} />
          <span className="text-xs">My Orders</span>
          {myOrdersToday.length > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{myOrdersToday.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("menu")}
          className={`flex flex-col items-center gap-1 p-2 rounded transition ${activeTab === "menu" ? "text-gold" : "text-text-secondary"}`}
        >
          <UtensilsCrossed size={20} />
          <span className="text-xs">Menu</span>
        </button>
      </nav>

      {/* EDIT ORDER MODAL */}
      <AnimatePresence>
        {editingOrder ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/60"
              onClick={() => !savingChanges && setEditingOrder(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.25 }}
              className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-y-auto rounded-t-2xl border border-border-theme bg-bg-card p-4 max-w-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl">Edit Order</h3>
                  <p className="text-xs text-text-muted">Table {editingOrder.tableNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  disabled={savingChanges}
                  className="rounded-lg border border-border-theme px-3 py-2 text-xs text-text-secondary"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2">
                {draftItems.map((item) => (
                  <div key={item.id || item.name} className="flex items-center justify-between rounded-xl border border-border-theme px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-text-muted">₹{Number(item.price || 0).toFixed(0)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeDraftItem(item, -1)}
                        className="rounded border border-border-theme px-2 py-1 text-gold"
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeDraftItem(item, 1)}
                        className="rounded border border-border-theme px-2 py-1 text-gold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                {!draftItems.length ? <p className="rounded-lg border border-border-theme p-3 text-sm text-text-muted">No items selected.</p> : null}
              </div>

              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Search menu to add items..."
                  value={editMenuSearch}
                  onChange={(e) => setEditMenuSearch(e.target.value)}
                  className="w-full input-gold px-3 py-2 text-sm"
                />
                <div className="mt-2 grid gap-2">
                  {editMenuItems.map((item) => {
                    const quantity = draftItems.find((draftItem) => draftItem.id === item.id)?.quantity || 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => changeDraftItem(item, 1)}
                        className="flex items-center justify-between rounded-lg border border-border-theme px-3 py-2 text-left text-sm transition hover:border-gold"
                      >
                        <span>
                          <span className="block font-medium">{item.name}</span>
                          <span className="text-xs text-text-muted">₹{Number(item.price || 0).toFixed(0)}</span>
                        </span>
                        <span className="rounded-full border border-gold px-2 py-0.5 text-xs text-gold">
                          {quantity ? `${quantity} in order` : "Add"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={saveEditedOrder}
                disabled={savingChanges || !draftItems.length}
                className="btn-gold mt-4 w-full"
              >
                {savingChanges ? "Saving..." : "Save Changes"}
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* CART MODAL */}
      <AnimatePresence>
        {cartOpen ? (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-0 bottom-0 z-30 rounded-t-2xl border border-border-theme bg-bg-card p-4 max-w-md"
          >
            <h3 className="font-display text-2xl">Cart</h3>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border-theme px-3 py-2 text-sm">
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <span>₹{item.price * item.quantity}</span>
                </div>
              ))}
              {!cartItems.length ? <p className="text-sm text-text-muted">Your cart is empty.</p> : null}
            </div>
            <p className="mt-3 text-sm text-text-secondary">Total: ₹{total.toFixed(0)}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-gold flex-1" onClick={submitOrder} disabled={!cartItems.length || placing}>
                {placing ? "Placing..." : "Place Order"}
              </button>
              <button type="button" className="flex-1 rounded-lg border border-border-theme" onClick={() => setCartOpen(false)}>
                Close
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
