"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ShoppingCart, Check, ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import MenuItem from "@/components/MenuItem";
import { placeOrder, subscribeToMenu, subscribeToRestaurant } from "@/lib/firestore";

const TABS = [
  { label: "All", value: "all" },
  { label: "Veg", value: "veg" },
  { label: "Non-Veg", value: "non-veg" },
  { label: "Drinks", value: "drinks" },
];

export default function CustomerQrPage() {
  const params = useParams();
  
  // Extract params directly from new routing
  const restaurantId = String(params.restaurantId || "");
  const tableNumber = String(params.tableNumber || "");
  
  // State management
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState("");
  const [orderSummary, setOrderSummary] = useState({ itemCount: 0, total: 0 });

  // Validation: Ensure both restaurantId and tableNumber exist
  useEffect(() => {
    if (!restaurantId || !tableNumber) {
      setError("Invalid restaurant or table information");
    }
  }, [restaurantId, tableNumber]);

  // Subscribe to data: Menu, Orders, Restaurant info
  useEffect(() => {
    if (!restaurantId) return undefined;
    
    const unsubMenu = subscribeToMenu(restaurantId, setMenu, (e) => {
      console.error("Menu error:", e);
      setError(e.message);
    });

    const unsubRestaurant = subscribeToRestaurant(restaurantId, (data) => {
      if (data?.name) {
        setRestaurantName(data.name);
      }
    }, (e) => {
      console.error("Restaurant error:", e);
      setError(e.message);
    });
    
    return () => {
      unsubMenu?.();
      unsubRestaurant?.();
    };
  }, [restaurantId]);

  // Filter menu by category
  const filtered = useMemo(() => {
    const items = menu.map((item) => ({
      ...item,
      category: String(item.category || "").trim().toLowerCase(),
    }));
    return category === "all" ? items : items.filter((item) => item.category === category);
  }, [category, menu]);

  // Cart derived values
  const cartItems = useMemo(() => cart, [cart]);
  const total = useMemo(() => 
    cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0), 
    [cart]
  );
  const itemCount = useMemo(() => 
    cart.reduce((sum, item) => sum + Number(item.quantity), 0), 
    [cart]
  );

  // Cart functions
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
          category: item.category,
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

  function clearCart() {
    setCart([]);
  }

  // Place order
  async function handlePlaceOrder() {
    // Validation
    if (!restaurantId || !tableNumber) {
      setError("Invalid restaurant or table information");
      toast.error("Invalid table information");
      return;
    }

    if (cart.length === 0) {
      window.alert("Cart empty");
      return;
    }

    setPlacing(true);
    setError("");

    try {
      // Store order summary BEFORE clearing cart
      setOrderSummary({
        itemCount,
        total,
      });

      const orderId = await placeOrder(restaurantId, {
        tableNumber: Number(tableNumber),
        items: cart,
        total,
        paymentMethod: "cash",
        paymentStatus: "unpaid",
        createdBy: "customer-qr",
        restaurantId
      });

      // Success: Show confirmation UI
      setPlacedOrderId(orderId);
      setOrderPlaced(true);
      setCart([]);
      setCartOpen(false);
      toast.success("Order placed successfully!");
    } catch (placeError) {
      console.error("Order error:", placeError);
      setError(placeError.message || "Unable to place order. Please try again.");
      toast.error("Order failed");
    } finally {
      setPlacing(false);
    }
  }

  // Reset order confirmation
  function resetOrder() {
    setOrderPlaced(false);
    setPlacedOrderId("");
    setOrderSummary({ itemCount: 0, total: 0 });
  }

  // If no valid params
  if (!restaurantId || !tableNumber) {
    return (
      <main className="min-h-screen w-full px-4 py-6 flex items-center justify-center"
        style={{ 
          background: '#0D0A06',
          backgroundImage: 'radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 70%)'
        }}
      >
        <div className="max-w-md w-full text-center rounded-2xl p-6" style={{ background: '#161009', border: '1px solid #2E1F0A' }}>
          <p className="text-lg text-danger font-semibold mb-2">❌ Invalid QR Code</p>
          <p className="text-sm text-text-secondary">This QR code is not valid. Please scan a valid table QR code from your restaurant.</p>
        </div>
      </main>
    );
  }

  // ORDER CONFIRMATION SCREEN
  if (orderPlaced) {
    return (
      <main 
        className="min-h-screen w-full px-4 py-6 flex items-center justify-center"
        style={{ 
          background: '#0D0A06',
          backgroundImage: 'radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 70%)'
        }}
      >
        <div className="mx-auto w-full max-w-md">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="rounded-2xl p-8 text-center"
            style={{ background: '#161009', border: '1px solid #2E1F0A' }}
          >
            {/* Success icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4, type: "spring" }}
              className="flex h-20 w-20 items-center justify-center rounded-full mx-auto mb-4"
              style={{ background: 'rgba(34, 197, 94, 0.1)', border: '2px solid #22C55E' }}
            >
              <Check size={40} className="text-green-500" />
            </motion.div>

            {/* Title */}
            <h1 className="font-display text-3xl text-gold mb-2">Order Placed!</h1>
            
            {/* Message */}
            <p className="text-text-secondary text-sm mb-4">
              Your order has been successfully placed and sent to the kitchen. Your meal will be prepared with care.
            </p>

            {/* Order details */}
            <div className="mb-6 space-y-2 rounded-lg p-4" style={{ background: '#0F0C08', border: '1px solid #2E1F0A' }}>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Order ID</span>
                <span className="text-gold font-mono text-xs font-semibold">{placedOrderId.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Table</span>
                <span className="text-text-primary font-semibold">{tableNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Items</span>
                <span className="text-text-primary font-semibold">{orderSummary.itemCount}</span>
              </div>
              <div className="border-t border-border-theme pt-2 mt-2 flex justify-between">
                <span className="text-text-secondary">Total</span>
                <span className="text-gold font-bold">₹{orderSummary.total.toFixed(0)}</span>
              </div>
            </div>

            {/* Status info */}
            <div className="mb-6 p-3 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <p className="text-xs text-green-400 font-semibold">✓ Status: Received</p>
              <p className="text-xs text-text-secondary mt-1">Chef will start preparing your order soon</p>
            </div>

            {/* Back to menu button */}
            <button
              type="button"
              onClick={resetOrder}
              className="w-full rounded-xl px-4 py-3 font-semibold text-text-primary transition"
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.2)'
              }}
            >
              Continue Browsing
            </button>

            {/* Helper text */}
            <p className="mt-4 text-xs text-text-muted">
              Powered by <span className="text-gold font-semibold">DineBoss</span>
            </p>
          </motion.div>
        </div>
      </main>
    );
  }

  // MAIN MENU & CART SCREEN
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
          <h1 className="font-display text-4xl text-gold">Welcome to {restaurantName || "Restaurant"}</h1>
          <p className="mt-2 text-sm text-text-secondary">Table {tableNumber}</p>
          <p className="mt-1 text-xs text-text-muted">Powered by DineBoss</p>
          {error ? <p className="mt-3 text-sm text-danger">⚠️ {error}</p> : null}
        </div>

        {/* Category tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition ${
                tab.value === category
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-border-theme text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setCategory(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="mb-24 space-y-3">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <MenuItem 
                key={item.id} 
                item={item} 
                quantity={cart.find((cartItem) => cartItem.id === item.id)?.quantity || 0} 
                onAdd={() => addToCart(item)} 
                onRemove={() => removeFromCart(item)}
              />
            ))
          ) : (
            <div className="card flex h-48 items-center justify-center text-center">
              <p className="text-sm text-text-muted">No items available in this category.</p>
            </div>
          )}
        </div>

        {/* Cart button - sticky bottom */}
        {itemCount > 0 ? (
          <motion.button 
            type="button" 
            onClick={() => setCartOpen(true)}
            layoutId="cart-button"
            className="fixed bottom-6 left-4 right-4 z-20 w-[calc(100%-2rem)] max-w-sm rounded-xl px-4 py-4 font-semibold text-text-primary transition hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
              boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)'
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart size={18} />
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </span>
              <span className="text-lg font-bold">₹{total.toFixed(0)}</span>
            </div>
          </motion.button>
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
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl p-6 max-h-[90vh] flex flex-col"
              style={{ background: '#161009', border: '1px solid #2E1F0A' }}
            >
              {/* Cart header */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl text-gold">Your Order</h2>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="text-text-secondary hover:text-text-primary text-xl font-semibold"
                >
                  ✕
                </button>
              </div>

              {/* Cart items - scrollable */}
              <div className="mb-4 flex-1 min-h-0 space-y-2 overflow-y-auto">
                {cartItems.length > 0 ? (
                  cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-border-theme bg-bg-card px-3 py-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{item.name}</p>
                        <p className="text-xs text-text-secondary">₹{item.price} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item)}
                          className="rounded px-2 py-1 text-xs hover:bg-gold/10 text-gold"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="rounded px-2 py-1 text-xs hover:bg-gold/10 text-gold"
                        >
                          +
                        </button>
                      </div>
                      <p className="ml-3 text-sm font-semibold text-gold min-w-fit">₹{(item.price * item.quantity).toFixed(0)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-text-muted py-8">Cart is empty</p>
                )}
              </div>

              {/* Order summary */}
              {cartItems.length > 0 && (
                <div className="mb-4 space-y-2 border-t border-border-theme pt-4">
                  <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>Total</span>
                    <span>₹{total.toFixed(0)}</span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={placing || !cartItems.length}
                  className="btn-gold flex-1 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {placing ? '🔄 Placing...' : '✓ Place Order'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    clearCart();
                  }}
                  className="flex-1 rounded-lg border border-border-theme py-3 text-sm font-semibold text-text-secondary transition hover:bg-gold/10 hover:text-gold"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
