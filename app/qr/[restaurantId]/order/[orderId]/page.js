"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChefHat, Circle, ClipboardCheck, Clock, XCircle } from "lucide-react";
import { subscribeToOrder, subscribeToRestaurant } from "@/lib/firestore";

const TIMELINE = [
  { status: "pending", label: "Order Placed", Icon: ClipboardCheck, activeClass: "border-green-500 bg-green-500/10 text-green-300" },
  { status: "preparing", label: "Preparing", Icon: ChefHat, activeClass: "border-yellow-500 bg-yellow-500/10 text-yellow-300" },
  { status: "served", label: "Served", Icon: Clock, activeClass: "border-orange-500 bg-orange-500/10 text-orange-300" },
  { status: "completed", label: "Completed", Icon: Check, activeClass: "border-gray-400 bg-gray-400/10 text-gray-200" },
];

function statusIndex(status) {
  return TIMELINE.findIndex((step) => step.status === status);
}

export default function CustomerOrderTrackingPage() {
  const params = useParams();
  const restaurantId = String(params.restaurantId || "");
  const orderId = String(params.orderId || "");
  const [order, setOrder] = useState(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubscribe = subscribeToRestaurant(
      restaurantId,
      (restaurant) => setRestaurantName(restaurant?.name || ""),
      (err) => setError(err.message || "Unable to load restaurant")
    );
    return () => unsubscribe?.();
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !orderId) return undefined;
    const unsubscribe = subscribeToOrder(
      restaurantId,
      orderId,
      (data) => setOrder(data),
      (err) => setError(err.message || "Unable to load order")
    );
    return () => unsubscribe?.();
  }, [restaurantId, orderId]);

  const currentIndex = useMemo(() => {
    if (!order) return 0;
    return Math.max(0, statusIndex(order.status));
  }, [order]);

  if (!restaurantId || !orderId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] p-4 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
          <p className="font-semibold text-red-300">Invalid order link</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f172a] px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-md">
        <AnimatePresence>
          {showSuccess ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-400 bg-green-400/10"
                >
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.35 }}>
                    <Check size={42} className="text-green-300" />
                  </motion.div>
                </motion.div>
                <p className="font-display text-3xl text-[#f59e0b]">Order Placed Successfully!</p>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <header className="mb-6 rounded-2xl border border-[#253047] bg-[#111c33] p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">{restaurantName || "DineBoss"}</p>
          <h1 className="mt-1 font-display text-3xl text-[#f59e0b]">Order Status</h1>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Order</p>
              <p className="mt-1 font-mono text-slate-100">#{orderId.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Table</p>
              <p className="mt-1 font-semibold">{order?.tableNumber || "-"}</p>
            </div>
          </div>
        </header>

        {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}

        {!order ? (
          <div className="rounded-2xl border border-slate-700 bg-[#111c33] p-6 text-center text-sm text-slate-300">
            Loading your order...
          </div>
        ) : order.status === "rejected" ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center"
          >
            <XCircle className="mx-auto mb-3 text-red-300" size={42} />
            <h2 className="font-display text-2xl text-red-200">Order Rejected</h2>
            <p className="mt-2 text-sm text-red-100">Your order was not accepted. Please contact staff.</p>
          </motion.div>
        ) : (
          <section className="rounded-2xl border border-slate-700 bg-[#111c33] p-5">
            <div className="space-y-4">
              {TIMELINE.map((step, index) => {
                const isComplete = index < currentIndex;
                const isActive = index === currentIndex;
                const isFuture = index > currentIndex;
                const Icon = step.Icon;

                return (
                  <motion.div
                    key={step.status}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                      isActive ? step.activeClass : isComplete ? "border-green-500/40 bg-green-500/5 text-green-200" : "border-slate-700 bg-slate-900/50 text-slate-500"
                    }`}
                  >
                    <motion.div
                      animate={
                        step.status === "preparing" && isActive
                          ? { scale: [1, 1.08, 1] }
                          : step.status === "served" && isActive
                            ? { boxShadow: ["0 0 0 rgba(251,146,60,0)", "0 0 18px rgba(251,146,60,0.45)", "0 0 0 rgba(251,146,60,0)"] }
                            : {}
                      }
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current"
                    >
                      {isComplete || (isActive && step.status === "completed") ? <Check size={18} /> : isFuture ? <Circle size={16} /> : <Icon size={18} />}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${isActive ? "font-bold" : "font-semibold"}`}>{step.label}</p>
                      {isActive ? <p className="mt-0.5 text-xs opacity-80">Current status</p> : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Items</span>
                <span>{order.items?.length || 0}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 text-sm">
                <span className="text-slate-400">Total</span>
                <span className="font-semibold text-[#f59e0b]">₹{Number(order.total || 0).toFixed(0)}</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
