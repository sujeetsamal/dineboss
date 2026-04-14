"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { subscribeToOrders, updateOrderStatus } from "@/lib/firestore";

function minsSince(createdAt) {
  const timestamp = createdAt?.toDate ? createdAt.toDate().getTime() : Number(createdAt?.seconds || 0) * 1000;
  if (!timestamp) return "0 min";
  return `${Math.max(0, Math.floor((Date.now() - timestamp) / 60000))} min`;
}

function KitchenCard({ order, onAction }) {
  return (
    <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="card p-4">
      <p className="text-sm text-text-muted">#{String(order.index || 0).padStart(3, "0")}</p>
      <p className="mt-1 text-2xl font-bold">Table {order.tableNumber}</p>
      <ul className="mt-2 space-y-1 text-base">
        {order.items?.map((item) => (
          <li key={`${item.id || item.name}-${item.quantity}`}>
            {item.quantity}x {item.name}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-text-secondary">{minsSince(order.createdAt)}</p>
      {onAction ? (
        <button className="btn-gold mt-3 w-full" type="button" onClick={onAction}>
          {order.status === "pending" ? "Start Cooking" : "Mark Served"}
        </button>
      ) : null}
    </motion.div>
  );
}

function KitchenPageContent() {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId");
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubscribe = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message));
    return () => unsubscribe();
  }, [restaurantId]);

  const columns = useMemo(
    () => ({
      pending: orders.filter((order, index) => order.status === "pending").map((order, index) => ({ ...order, index: index + 1 })),
      preparing: orders.filter((order, index) => order.status === "preparing").map((order, index) => ({ ...order, index: index + 1 })),
      served: orders.filter((order, index) => order.status === "served").slice(0, 10).map((order, index) => ({ ...order, index: index + 1 })),
    }),
    [orders]
  );

  async function setStatus(orderId, status) {
    if (!restaurantId) return;
    try {
      await updateOrderStatus(restaurantId, orderId, status);
      toast.success(`Order moved to ${status}`);
    } catch (updateError) {
      setError(updateError.message || "Unable to update order");
      toast.error("Status update failed");
    }
  }

  if (!restaurantId) return <p className="p-6 text-sm text-danger">Missing restaurantId query parameter.</p>;

  return (
    <main className="min-h-screen bg-bg-primary p-4 text-text-primary md:p-6">
      <h1 className="font-display text-4xl text-gold">Kitchen Screen</h1>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <h2 className="mb-3 font-display text-2xl">PENDING</h2>
          <div className="space-y-3">
            {columns.pending.map((order) => (
              <KitchenCard key={order.id} order={order} onAction={() => setStatus(order.id, "preparing")} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-2xl">PREPARING</h2>
          <div className="space-y-3">
            {columns.preparing.map((order) => (
              <KitchenCard key={order.id} order={order} onAction={() => setStatus(order.id, "served")} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-2xl">SERVED</h2>
          <div className="space-y-3">
            {columns.served.map((order) => (
              <motion.div key={order.id} exit={{ x: 20, opacity: 0 }}>
                <KitchenCard order={order} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function KitchenPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-muted">Loading kitchen screen...</div>}>
      <KitchenPageContent />
    </Suspense>
  );
}
