"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import MenuItem from "@/components/MenuItem";
import { placeOrder, subscribeToMenu, subscribeToOrders } from "@/lib/firestore";

const TABS = ["All", "Veg", "Non-Veg", "Drinks"];

function decodeTableId(tableId) {
  if (!tableId) return { restaurantId: "", tableNumber: "" };
  const [restaurantId, tableNumber] = tableId.split("__");
  return { restaurantId, tableNumber };
}

export default function CustomerQrPage() {
  const params = useParams();
  const { restaurantId, tableNumber } = decodeTableId(String(params.tableId || ""));
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubMenu = subscribeToMenu(restaurantId, setMenu, (e) => setError(e.message));
    const unsubOrders = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message));
    return () => {
      unsubMenu();
      unsubOrders();
    };
  }, [restaurantId]);

  const filtered = useMemo(() => (category === "All" ? menu : menu.filter((item) => item.category === category)), [category, menu]);
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0), [cartItems]);
  const count = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.quantity), 0), [cartItems]);

  const orderStatus = useMemo(() => {
    if (!lastOrderId) return "";
    return orders.find((item) => item.id === lastOrderId)?.status || "";
  }, [lastOrderId, orders]);

  function add(item) {
    setCart((prev) => ({
      ...prev,
      [item.id]: prev[item.id]
        ? { ...prev[item.id], quantity: prev[item.id].quantity + 1 }
        : { id: item.id, name: item.name, price: Number(item.price), quantity: 1 },
    }));
  }

  function remove(item) {
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

  async function checkout() {
    if (!restaurantId || !tableNumber || !cartItems.length) return;
    setPlacing(true);
    try {
      const orderId = await placeOrder(restaurantId, {
        tableNumber: Number(tableNumber),
        items: cartItems,
        total,
        paymentMethod: "cash",
        createdBy: "customer-qr",
      });
      setLastOrderId(orderId);
      setCart({});
      setCartOpen(false);
      toast.success("Order placed");
    } catch (checkoutError) {
      setError(checkoutError.message || "Unable to place order");
      toast.error("Checkout failed");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <main 
      className="min-h-screen w-full px-4 py-6"
      style={{ 
        background: '#0D0A06',
        backgroundImage: 'radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 70%)'
      }}
    >
      {/* Main container */}
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="mb-6 rounded-2xl p-6" style={{ background: '#161009', border: '1px solid #2E1F0A' }}>
          <h1 className="font-display text-4xl text-gold">DineBoss</h1>
          <p className="mt-2 text-sm text-text-secondary">Table {tableNumber || "-"}</p>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </div>

        {/* Category tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition ${
                tab === category
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-border-theme text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setCategory(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="mb-24 space-y-3">
          {filtered.map((item) => (
            <MenuItem 
              key={item.id} 
              item={item} 
              quantity={cart[item.id]?.quantity || 0} 
              onAdd={add} 
              onRemove={remove}
            />
          ))}
          {!filtered.length ? (
            <div className="card flex h-48 items-center justify-center text-center">
              <p className="text-sm text-text-muted">No items available in this category.</p>
            </div>
          ) : null}
        </div>

        {/* Cart button - sticky bottom */}
        {count > 0 ? (
          <button 
            type="button" 
            onClick={() => setCartOpen(true)} 
            className="fixed bottom-6 left-4 right-4 z-20 w-[calc(100%-2rem)] max-w-sm rounded-xl px-4 py-4 font-semibold text-text-primary transition hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
              boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)'
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart size={18} />
                {count} item{count !== 1 ? 's' : ''}
              </span>
              <span className="text-lg font-bold">₹{total.toFixed(0)}</span>
            </div>
          </button>
        ) : null}

        {/* Order status card */}
        {lastOrderId && orderStatus ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-border-theme bg-bg-card p-4"
          >
            <p className="text-center font-semibold text-gold">
              {orderStatus === 'pending' && '✓ Order Received'}
              {orderStatus === 'preparing' && '👨‍🍳 Kitchen is Preparing'}
              {orderStatus === 'served' && '🍽️ Order Coming!'}
            </p>
            <p className="mt-2 text-center text-xs text-text-secondary">
              {orderStatus === 'pending' && 'Your order has been placed. Chef will start soon!'}
              {orderStatus === 'preparing' && 'Your meal is being prepared with care.'}
              {orderStatus === 'served' && 'Your order is on its way to your table!'}
            </p>
          </motion.div>
        ) : null}
      </div>

      {/* Cart modal */}
      <AnimatePresence>
        {cartOpen ? (
          <>
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 z-40 bg-black/60"
            />
            
            {/* Cart panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl p-6"
              style={{ background: '#161009', border: '1px solid #2E1F0A' }}
            >
              {/* Cart header */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl text-gold">Your Order</h2>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  ✕
                </button>
              </div>

              {/* Cart items */}
              <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border-theme bg-bg-card px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{item.name}</p>
                      <p className="text-xs text-text-secondary">x {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-gold">₹{(item.price * item.quantity).toFixed(0)}</p>
                  </div>
                ))}
              </div>

              {/* Order summary */}
              <div className="mb-4 space-y-2 border-t border-border-theme pt-4">
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>Subtotal</span>
                  <span>₹{total.toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>Tax (estimated)</span>
                  <span>₹{(total * 0.05).toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border-theme pt-2 text-base font-semibold text-gold">
                  <span>Total</span>
                  <span>₹{(total * 1.05).toFixed(0)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={checkout}
                  disabled={placing || !cartItems.length}
                  className="btn-gold flex-1 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {placing ? '🔄 Placing...' : '✓ Place Order'}
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="flex-1 rounded-lg border border-border-theme py-3 text-sm font-semibold text-text-secondary transition hover:bg-gold/10 hover:text-gold"
                >
                  Continue Shopping
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
