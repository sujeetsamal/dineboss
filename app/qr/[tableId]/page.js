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
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#FAF6EE] px-4 py-4 text-[#2E1F0A]">
      <header>
        <h1 className="font-display text-3xl text-[#92400E]">DineBoss</h1>
        <p className="text-sm">Table {tableNumber || "-"}</p>
      </header>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${tab === category ? "border-[#92400E] text-[#92400E]" : "border-[#D6C3A6]"}`}
            onClick={() => setCategory(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3 pb-24">
        {filtered.map((item) => (
          <MenuItem key={item.id} item={item} quantity={cart[item.id]?.quantity || 0} onAdd={add} onRemove={remove} />
        ))}
        {!filtered.length ? <p className="text-sm text-[#7C6A4F]">No items available.</p> : null}
      </div>

      <button type="button" onClick={() => setCartOpen(true)} className="btn-gold fixed bottom-4 left-4 right-4 z-20 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <ShoppingCart size={16} /> {count} items
        </span>
        <span>₹{total.toFixed(0)}</span>
      </button>

      <AnimatePresence>
        {cartOpen ? (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-x-0 bottom-0 z-30 rounded-t-2xl border border-[#D6C3A6] bg-[#FFFDF7] p-4"
          >
            <h2 className="font-display text-2xl text-[#92400E]">Your Cart</h2>
            <div className="mt-3 space-y-2">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-[#EADDC8] px-3 py-2 text-sm">
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <span>₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm">Total: ₹{total.toFixed(0)}</p>
            <div className="mt-3 flex gap-2">
              <button className="btn-gold flex-1" type="button" onClick={checkout} disabled={placing || !cartItems.length}>
                {placing ? "Placing..." : "Place Order"}
              </button>
              <button type="button" className="flex-1 rounded-lg border border-[#D6C3A6]" onClick={() => setCartOpen(false)}>
                Close
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {lastOrderId ? (
        <div className="mt-4 rounded-xl border border-[#D6C3A6] bg-[#FFFDF7] p-3 text-sm">
          <p>{orderStatus === "pending" ? "Order received ✓" : null}</p>
          <p>{orderStatus === "preparing" ? "Kitchen is preparing your order 👨‍🍳" : null}</p>
          <p>{orderStatus === "served" ? "Your order is on its way! 🍽️" : null}</p>
        </div>
      ) : null}
    </main>
  );
}
