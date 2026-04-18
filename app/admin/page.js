"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChefHat, Plus, QrCode, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";
import AdminShell from "@/components/AdminShell";
import OrderPanel from "@/components/OrderPanel";
import BillModal from "@/components/BillModal";
import { adminSearchStore } from "./searchStore";
import { useAdminGlobalSearch } from "./hooks/useAdminGlobalSearch";
import SearchBar from "@/components/SearchBar";
import {
  addMenuItem,
  addTable,
  subscribeToMenu,
  subscribeToOrders,
  subscribeToRestaurant,
  subscribeToTables,
  updateOrderStatus,
  updateOrderBillDetails
} from "@/lib/firestore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getOrdersToday, getRevenueToday } from "@/lib/dateUtils";

function StatCard({ title, value, subtitle, valueClass = "" }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
    </div>
  );
}

export default function AdminPage() {
  const { loading, user, role, restaurantId, error, setError } = useCurrentUser({ allowedRoles: ["admin"] });
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [menuForm, setMenuForm] = useState({ name: "", category: "veg", price: "" });
  const [tableNumber, setTableNumber] = useState("");
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  // Global admin search state (mode + query)
  const globalSearch = useAdminGlobalSearch();
  const currentMode = globalSearch?.mode ?? 'Orders';
  const currentQuery = globalSearch?.query ?? '';
  const [showAdminSearch, setShowAdminSearch] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  // Removed UI blocks related to export bills (Fix 1)
  
  // Filtered orders for search (client-side)
  const filteredOrders = useMemo(() => {
    if (!adminSearchQuery) return orders;
    const q = adminSearchQuery.toLowerCase();
    return orders.filter((o) => {
      const id = String(o.id || "");
      const table = String(o.tableNumber ?? "");
      const items = (o.items || []).map((it) => String(it.name || "")).join(" ");
      return id.includes(q) || table.includes(q) || items.toLowerCase().includes(q);
    });
  }, [orders, adminSearchQuery]);

  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = subscribeToRestaurant(
      restaurantId,
      (data) => setRestaurant(data),
      (restaurantError) => setError(restaurantError.message || "Unable to load restaurant")
    );
    return () => unsubscribe?.();
  }, [restaurantId, setError]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubTables = subscribeToTables(restaurantId, setTables, (e) => setError(e.message));
    const unsubOrders = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message));
    const unsubMenu = subscribeToMenu(restaurantId, setMenu, (e) => setError(e.message));
    return () => {
      unsubTables();
      unsubOrders();
      unsubMenu();
    };
  }, [restaurantId, setError]);

  const occupiedCount = useMemo(
    () => tables.filter((table) => table.status === "occupied" || table.isOccupied).length,
    [tables]
  );
  const pendingOrders = useMemo(() => orders.filter((order) => order.status === "pending").length, [orders]);
  const activeOrders = useMemo(
    () => orders.filter((order) => order.status === "pending" || order.status === "preparing").length,
    [orders]
  );
  const ordersToday = useMemo(() => getOrdersToday(orders), [orders]);
  const revenueToday = useMemo(() => getRevenueToday(orders), [orders]);

  const activity = useMemo(() => {
    // Show recent activity from today's orders
    return ordersToday
      .flatMap((order) =>
        (order.statusHistory || []).map((entry) => ({
          ...entry,
          orderId: order.id,
          tableNumber: order.tableNumber,
        }))
      )
      .sort((a, b) => Number(b.changedAt || 0) - Number(a.changedAt || 0))
      .slice(0, 10);
  }, [ordersToday]);

  // Dessert panel removed from Admin Dashboard (Fix 1)

  async function handleStatusChange(orderId, status) {
    try {
      await updateOrderStatus(restaurantId, orderId, status);
      toast.success(`Order marked ${status}`);
    } catch (statusError) {
      toast.error("Unable to update order");
      setError(statusError.message || "Unable to update order");
    }
  }

  function handleGenerateBill(order) {
    setSelectedOrder(order);
    setBillModalOpen(true);
  }

  async function createMenuItem(event) {
    event.preventDefault();
    try {
      await addMenuItem(restaurantId, {
        name: menuForm.name,
        category: menuForm.category,
        price: Number(menuForm.price),
        available: true,
      });
      setMenuForm({ name: "", category: "veg", price: "" });
      setShowMenuModal(false);
      toast.success("Menu item added");
    } catch (menuError) {
      toast.error("Unable to add menu item");
      setError(menuError.message || "Unable to add menu item");
    }
  }

  async function createTable(event) {
    event.preventDefault();
    try {
      await addTable(restaurantId, Number(tableNumber));
      setTableNumber("");
      setShowTableModal(false);
      toast.success("Table added");
    } catch (tableError) {
      toast.error("Unable to add table");
      setError(tableError.message || "Unable to add table");
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading dashboard...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  // Desserts panel on OR page (Orders page) moved to top-level; see later blocks for use
  if (!restaurantId) {
    return (
      <AdminShell>
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <p className="text-sm">Restaurant not assigned.</p>
        </div>
      </AdminShell>
    );
  }

  function toDateSafe(v) {
    if (!v) return null
    if (typeof v.toDate === 'function') return v.toDate()
    if (v instanceof Date) return v
    const d = new Date(v)
    return isNaN(d) ? null : d
  }

  

  return (
    <AdminShell
      restaurantName={restaurant?.name}
      activeOrders={activeOrders}
      occupiedTables={occupiedCount}
      totalTables={tables.length}
    >
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-display text-3xl">Admin Dashboard</h3>
        <button
          type="button"
          className="btn-gold px-4 py-2 text-sm"
          onClick={() => setShowAdminSearch((s) => !s)}
        >
          {showAdminSearch ? "Hide Search" : "Search"}
        </button>
      </div>
      {showAdminSearch ? (
        <div className="mb-4">
          <SearchBar placeholder="Search by Order ID, Table or Item" onSearch={setAdminSearchQuery} />
        </div>
      ) : null}

      {/* Desserts panel removed per Fix 1 */}

     

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's Revenue" value={`₹${revenueToday.toFixed(0)}`} subtitle="vs yesterday +8.5%" valueClass="text-success" />
        <StatCard title="Orders Today" value={String(ordersToday.length)} subtitle="Total count today" />
        <StatCard title="Tables Occupied" value={`${occupiedCount}/${tables.length}`} subtitle="Live floor status" valueClass="text-gold" />
        <StatCard title="Pending Orders" value={String(pendingOrders)} subtitle="Needs action" valueClass={pendingOrders > 0 ? "text-danger" : "text-success"} />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-4 font-display text-2xl">Live Orders</h3>
          <div className="space-y-3">
            {filteredOrders.filter((item) => item.status !== "completed").length ? (
              filteredOrders
                .filter((item) => item.status !== "completed")
                .map((order) => (
                  <motion.div key={order.id} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <OrderPanel
                      order={order}
                      showActions
                      onStatusChange={(status) => handleStatusChange(order.id, status)}
                      onGenerateBill={() => handleGenerateBill(order)}
                    />
                  </motion.div>
                ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted">
                <ChefHat className="mb-2" />
                <p>Kitchen is quiet. No active orders.</p>
              </div>
            )}
          </div>
        </div>

      {/* Desserts panel removed per Fix 1 */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="mb-3 font-display text-2xl">Quick Actions</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => setShowMenuModal(true)} className="btn-gold flex items-center justify-center gap-2 text-sm">
                <UtensilsCrossed size={16} /> Add Menu Item
              </button>
              <button type="button" onClick={() => setShowQrModal(true)} className="btn-gold flex items-center justify-center gap-2 text-sm">
                <QrCode size={16} /> Generate QR
              </button>
              <button type="button" onClick={() => setShowTableModal(true)} className="btn-gold flex items-center justify-center gap-2 text-sm">
                <Plus size={16} /> Add Table
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 font-display text-2xl">Recent Activity</h3>
            <div className="space-y-2">
              {activity.length ? (
                activity.map((entry, index) => (
                  <div key={`${entry.orderId}-${entry.changedAt}-${index}`} className="rounded-xl border border-border-theme px-3 py-2 text-sm">
                    <p className="text-text-primary">
                      Table {entry.tableNumber}: <span className="capitalize text-gold">{entry.status}</span>
                    </p>
                    <p className="text-xs text-text-muted">{entry.label}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">No status changes yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {showMenuModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <form className="card w-full max-w-md space-y-3" onSubmit={createMenuItem}>
            <h4 className="font-display text-2xl">Add Menu Item</h4>
            <input placeholder="Name" value={menuForm.name} onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))} required />
            <select value={menuForm.category} onChange={(e) => setMenuForm((p) => ({ ...p, category: e.target.value }))}>
              <option value="veg">veg</option>
              <option value="non-veg">non-veg</option>
              <option value="drinks">drinks</option>
            </select>
            <input type="number" placeholder="Price" min="1" value={menuForm.price} onChange={(e) => setMenuForm((p) => ({ ...p, price: e.target.value }))} required />
            <div className="flex gap-2">
              <button className="btn-gold flex-1" type="submit">Save</button>
              <button className="flex-1 rounded-lg border border-border-theme" type="button" onClick={() => setShowMenuModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      {showTableModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <form className="card w-full max-w-sm space-y-3" onSubmit={createTable}>
            <h4 className="font-display text-2xl">Add Table</h4>
            <input type="number" min="1" placeholder="Table Number" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} required />
            <div className="flex gap-2">
              <button className="btn-gold flex-1" type="submit">Create</button>
              <button className="flex-1 rounded-lg border border-border-theme" type="button" onClick={() => setShowTableModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      {showQrModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm space-y-2 text-center">
            <h4 className="font-display text-2xl">QR Management</h4>
            <p className="text-sm text-text-secondary">Open QR center to generate and download all table QR codes.</p>
            <button className="btn-gold w-full" type="button" onClick={() => (window.location.href = "/admin/qr")}>
              Go to /admin/qr
            </button>
            <button className="w-full rounded-lg border border-border-theme py-2" type="button" onClick={() => setShowQrModal(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <BillModal
        isOpen={billModalOpen}
        onClose={() => {
          setBillModalOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        restaurantId={restaurantId}
        userId={user?.uid}
      />
    </AdminShell>
  );
}
