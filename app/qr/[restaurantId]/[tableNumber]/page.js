"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import MenuItem from "@/components/MenuItem";
import { placeOrder, subscribeToMenu, subscribeToRestaurant, subscribeToRestaurantSettings } from "@/lib/firestore";

const TABS = [
  { label: "All", value: "all" },
  { label: "Veg", value: "veg" },
  { label: "Non-Veg", value: "non-veg" },
  { label: "Drinks", value: "drinks" },
  { label: "Dessert", value: "dessert" },

];

export default function CustomerQrPage() {
  const params = useParams();
  const router = useRouter();
  
  // Extract params directly from new routing
  const restaurantId = String(params.restaurantId || "");
  const tableNumber = String(params.tableNumber || "");
  
  // State management
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [settings, setSettings] = useState({ requireCustomerDetails: false });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({ name: "", phone: "" });
  const [detailErrors, setDetailErrors] = useState({});

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

    const unsubSettings = subscribeToRestaurantSettings(restaurantId, setSettings, (e) => {
      console.warn("Settings error:", e);
    });
    
    return () => {
      unsubMenu?.();
      unsubRestaurant?.();
      unsubSettings?.();
    };
  }, [restaurantId]);

  // Filter menu by category and search query
  const filtered = useMemo(() => {
    const items = menu.map((item) => ({
      ...item,
      category: String(item.category || "").trim().toLowerCase(),
    }));
    let result = category === "all" ? items : items.filter((item) => item.category === category);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => (item.name || "").toLowerCase().includes(q));
    }
    return result;
  }, [category, menu, searchQuery]);

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

  function validateDetails({ allowSkip = false } = {}) {
    const name = customerDetails.name.trim();
    const phone = customerDetails.phone.trim();
    const nextErrors = {};

    if (!allowSkip && settings.requireCustomerDetails && !name) {
      nextErrors.name = "Name is required.";
    }

    if (!allowSkip && settings.requireCustomerDetails && !phone) {
      nextErrors.phone = "Mobile number is required.";
    } else if (phone && !/^\d{10}$/.test(phone)) {
      nextErrors.phone = "Enter a valid 10 digit mobile number.";
    }

    setDetailErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function openCustomerDetails() {
    if (!restaurantId || !tableNumber) {
      setError("Invalid restaurant or table information");
      toast.error("Invalid table information");
      return;
    }

    if (cart.length === 0) {
      toast.error("Cart empty");
      return;
    }

    setDetailErrors({});
    setDetailsOpen(true);
  }

  // Place order
  async function handlePlaceOrder({ skipDetails = false } = {}) {
    if (!skipDetails && !validateDetails()) return;
    if (skipDetails && settings.requireCustomerDetails) return;

    setPlacing(true);
    setError("");

    try {
      const name = skipDetails ? null : customerDetails.name.trim() || null;
      const phone = skipDetails ? null : customerDetails.phone.trim() || null;

      const orderId = await placeOrder(restaurantId, {
        tableNumber: Number(tableNumber),
        items: cart,
        total,
        paymentMethod: "cash",
        paymentStatus: "unpaid",
        customerName: name,
        customerPhone: phone,
        createdBy: null,
        createdByName: null,
        lastUpdatedBy: null,
        lastUpdatedByName: null,
        restaurantId,
      });

      setCart([]);
      setCartOpen(false);
      setDetailsOpen(false);
      toast.success("Order placed successfully!");
      router.push(`/qr/${restaurantId}/order/${orderId}`);
    } catch (placeError) {
      console.error("Order error:", placeError);
      setError(placeError.message || "Unable to place order. Please try again.");
      toast.error("Order failed");
    } finally {
      setPlacing(false);
    }
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

        {/* Search bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border-theme px-4 py-2 text-sm bg-bg-card text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition"
          />
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
                  onClick={openCustomerDetails}
                  disabled={placing || !cartItems.length}
                  className="btn-gold flex-1 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {placing ? 'Placing...' : 'Place Order'}
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

      {/* Customer details modal */}
      <AnimatePresence>
        {detailsOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/70"
            />
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 bottom-4 z-[70] mx-auto w-auto max-w-sm rounded-2xl border border-[#2E1F0A] bg-[#161009] p-5 shadow-2xl"
            >
              <div className="mb-4">
                <h2 className="font-display text-2xl text-gold">Customer Details</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {settings.requireCustomerDetails
                    ? "Name and mobile number are required for this order."
                    : "Add your details for staff reference, or skip to continue."}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Name</span>
                  <input
                    type="text"
                    value={customerDetails.name}
                    onChange={(e) => {
                      setCustomerDetails((prev) => ({ ...prev, name: e.target.value }));
                      setDetailErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    className="w-full rounded-lg border border-border-theme bg-bg-card px-3 py-3 text-sm text-text-primary outline-none transition focus:border-gold"
                    placeholder="Your name"
                  />
                  {detailErrors.name ? <span className="mt-1 block text-xs text-red-400">{detailErrors.name}</span> : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Mobile Number</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={customerDetails.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setCustomerDetails((prev) => ({ ...prev, phone: digits }));
                      setDetailErrors((prev) => ({ ...prev, phone: "" }));
                    }}
                    className="w-full rounded-lg border border-border-theme bg-bg-card px-3 py-3 text-sm text-text-primary outline-none transition focus:border-gold"
                    placeholder="10 digit mobile number"
                  />
                  {detailErrors.phone ? <span className="mt-1 block text-xs text-red-400">{detailErrors.phone}</span> : null}
                </label>
              </div>

              <div className="mt-5 flex gap-2">
                {!settings.requireCustomerDetails ? (
                  <button
                    type="button"
                    onClick={() => handlePlaceOrder({ skipDetails: true })}
                    disabled={placing}
                    className="flex-1 rounded-lg border border-border-theme py-3 text-sm font-semibold text-text-secondary transition hover:border-gold hover:text-gold disabled:opacity-50"
                  >
                    Skip
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handlePlaceOrder()}
                  disabled={placing}
                  className="btn-gold flex-1 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {placing ? "Submitting..." : "Submit Order"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                disabled={placing}
                className="mt-3 w-full rounded-lg py-2 text-xs text-text-muted transition hover:text-text-secondary disabled:opacity-50"
              >
                Back to cart
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
