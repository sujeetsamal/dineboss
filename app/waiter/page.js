"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, LogOut, ClipboardList, UtensilsCrossed, Grid3x3, CreditCard } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import MenuItem from "@/components/MenuItem";
import TableCard from "@/components/TableCard";
import OrderPanel from "@/components/OrderPanel";
import { placeOrder, subscribeToMenu, subscribeToTables, subscribeToOrders, subscribeToRestaurant } from "@/lib/firestore";
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
  const { loading, user, role, restaurantId, error, setError } = useCurrentUser({ allowedRoles: ["waiter"] });
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

  const occupiedTables = useMemo(() => tables.filter((t) => t.status === "occupied" || t.isOccupied).length, [tables]);
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);

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
      window.alert("Cart empty");
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
          <div className="space-y-3">
            {myOrdersToday.length > 0 ? (
              myOrdersToday.map((order) => (
                <motion.div key={order.id} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                  <OrderPanel order={order} showActions={false} />
                </motion.div>
              ))
            ) : (
              <div className="card p-8 text-center text-text-muted">
                <p>No orders placed today yet.</p>
              </div>
            )}
          </div>
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
              <MenuItem key={item.id} item={item} quantity={0} onAdd={(i) => toast.info("Select table to add items")} onRemove={() => {}} />
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
        <button
          onClick={() => router.push("/waiter/billing")}
          className="flex flex-col items-center gap-1 p-2 rounded transition text-text-secondary hover:text-gold"
        >
          <CreditCard size={20} />
          <span className="text-xs">Billing</span>
        </button>
      </nav>

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
