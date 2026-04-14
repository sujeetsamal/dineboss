"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import MenuItem from "@/components/MenuItem";
import TableCard from "@/components/TableCard";
import { placeOrder, subscribeToMenu, subscribeToTables } from "@/lib/firestore";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";

const CATEGORY_TABS = ["All", "Veg", "Non-Veg", "Drinks"];

export default function WaiterPage() {
  const { loading, profile, firebaseUser, error, setError } = useCurrentUserProfile({ allowedRoles: ["waiter"] });
  const [step, setStep] = useState(1);
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState({});
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!profile?.restaurantId) return undefined;
    const unsubTables = subscribeToTables(profile.restaurantId, setTables, (e) => setError(e.message));
    const unsubMenu = subscribeToMenu(profile.restaurantId, setMenu, (e) => setError(e.message));
    return () => {
      unsubTables();
      unsubMenu();
    };
  }, [profile?.restaurantId, setError]);

  const filteredMenu = useMemo(() => {
    if (category === "All") return menu;
    return menu.filter((item) => item.category === category);
  }, [category, menu]);
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const itemCount = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.quantity), 0), [cartItems]);
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0), [cartItems]);

  function addToCart(item) {
    setCart((prev) => ({
      ...prev,
      [item.id]: prev[item.id]
        ? { ...prev[item.id], quantity: prev[item.id].quantity + 1 }
        : { id: item.id, name: item.name, price: Number(item.price), quantity: 1 },
    }));
  }

  function removeFromCart(item) {
    setCart((prev) => {
      const next = { ...prev };
      if (!next[item.id]) return next;
      if (next[item.id].quantity <= 1) {
        delete next[item.id];
        return next;
      }
      next[item.id] = { ...next[item.id], quantity: next[item.id].quantity - 1 };
      return next;
    });
  }

  async function submitOrder() {
    if (!selectedTable || !profile?.restaurantId) return;
    if (!cartItems.length) return;
    setPlacing(true);
    setError("");
    try {
      await placeOrder(profile.restaurantId, {
        tableId: selectedTable.id,
        tableNumber: selectedTable.tableNumber,
        items: cartItems,
        total,
        createdBy: firebaseUser.uid,
      });
      toast.success("Order placed successfully");
      setCart({});
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
  if (!profile?.restaurantId) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md flex items-center justify-center px-4 py-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm">
          <p>Restaurant not assigned.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-4">
      <header className="mb-4">
        <h1 className="font-display text-3xl text-gold">DineBoss</h1>
        <p className="text-sm text-text-secondary">Waiter: {profile.displayName || profile.email}</p>
      </header>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {step === 1 ? (
        <section>
          <h2 className="mb-3 font-display text-2xl">Select Table</h2>
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
          <div className="sticky top-2 z-10 mb-3 rounded-xl border border-border-theme bg-bg-card px-3 py-2 text-sm">
            Table {selectedTable?.tableNumber}
            <button type="button" onClick={() => setStep(1)} className="ml-3 text-gold-light">
              Change
            </button>
          </div>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategory(tab)}
                className={`rounded-full border px-3 py-1 text-xs ${category === tab ? "border-gold text-gold" : "border-border-theme text-text-secondary"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredMenu.map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                quantity={cart[item.id]?.quantity || 0}
                onAdd={addToCart}
                onRemove={removeFromCart}
              />
            ))}
          </div>

          {!filteredMenu.length ? <p className="mt-6 text-sm text-text-muted">No menu items in this category.</p> : null}
        </section>
      )}

      {step === 2 ? (
        <button type="button" className="btn-gold fixed bottom-4 left-4 right-4 z-20 flex items-center justify-between" onClick={() => setCartOpen(true)}>
          <span className="flex items-center gap-2">
            <ShoppingCart size={16} />
            {itemCount} items
          </span>
          <span>₹{total.toFixed(0)}</span>
        </button>
      ) : null}

      <AnimatePresence>
        {cartOpen ? (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-0 bottom-0 z-30 rounded-t-2xl border border-border-theme bg-bg-card p-4"
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
