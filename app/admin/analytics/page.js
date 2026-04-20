"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight, Download, Eye } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { getRestaurant, subscribeToOrders, subscribeToTables, subscribeToBills } from "@/lib/firestore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { sameDay } from "@/lib/dateUtils";

export default function AdminAnalyticsPage() {
  const { loading, user, role, restaurantId, error, setError } = useCurrentUser({ allowedRoles: ["admin"] });
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [bills, setBills] = useState([]);
  const [billDateFilter, setBillDateFilter] = useState("all"); // 'all', 'today', 'week', 'month'
  const [selectedBill, setSelectedBill] = useState(null);

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId).then(setRestaurant).catch((e) => setError(e.message));
  }, [restaurantId, setError]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubOrders = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message));
    const unsubTables = subscribeToTables(restaurantId, setTables, (e) => setError(e.message));
    const unsubBills = subscribeToBills(restaurantId, setBills, (e) => setError(e.message));
    return () => {
      unsubOrders();
      unsubTables();
      unsubBills();
    };
  }, [restaurantId, setError]);

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(now.getDate() - 30);

  const normalizedOrders = useMemo(
    () =>
      orders.map((order) => ({
        ...order,
        date: order.createdAt?.toDate ? order.createdAt.toDate() : new Date(0),
      })),
    [orders]
  );

  const metrics = useMemo(() => {
    const dayOrders = normalizedOrders.filter((order) => sameDay(order.date, now));
    const weekOrders = normalizedOrders.filter((order) => order.date >= weekAgo);
    const monthOrders = normalizedOrders.filter((order) => order.date >= monthAgo);
    const revenue = (arr) => arr.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return {
      revenueToday: revenue(dayOrders),
      revenueWeek: revenue(weekOrders),
      revenueMonth: revenue(monthOrders),
      ordersToday: dayOrders.length,
      ordersWeek: weekOrders.length,
      ordersMonth: monthOrders.length,
      avgOrderValue: normalizedOrders.length ? revenue(normalizedOrders) / normalizedOrders.length : 0,
    };
  }, [monthAgo, normalizedOrders, now, weekAgo]);

  const topItems = useMemo(() => {
    const map = new Map();
    normalizedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        map.set(item.name, (map.get(item.name) || 0) + Number(item.quantity || 0));
      });
    });
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [normalizedOrders]);

  const revenueLast7 = useMemo(() => {
    const points = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      const key = date.toDateString();
      const total = normalizedOrders
        .filter((order) => order.date.toDateString() === key)
        .reduce((sum, order) => sum + Number(order.total || 0), 0);
      points.push({ day: date.toLocaleDateString("en-IN", { weekday: "short" }), revenue: total });
    }
    return points;
  }, [normalizedOrders, now]);

  const ordersByHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour: `${hour}:00`, orders: 0 }));
    normalizedOrders.filter((order) => sameDay(order.date, now)).forEach((order) => {
      buckets[order.date.getHours()].orders += 1;
    });
    return buckets;
  }, [normalizedOrders, now]);

  const revenueByCategory = useMemo(() => {
    const data = { Veg: 0, "Non-Veg": 0, Drinks: 0 };
    normalizedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.category || "Veg";
        data[key] = (data[key] || 0) + Number(item.price || 0) * Number(item.quantity || 0);
      });
    });
    const colors = { Veg: "#10B981", "Non-Veg": "#EF4444", Drinks: "#3B82F6" };
    return Object.entries(data).map(([name, value]) => ({ name, value, fill: colors[name] || "#F59E0B" }));
  }, [normalizedOrders]);

  const filteredBills = useMemo(() => {
    let result = bills.map((bill) => ({
      ...bill,
      createdAtDate: bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(0),
    }));

    if (billDateFilter === "today") {
      result = result.filter((bill) => sameDay(bill.createdAtDate, now));
    } else if (billDateFilter === "week") {
      result = result.filter((bill) => bill.createdAtDate >= weekAgo);
    } else if (billDateFilter === "month") {
      result = result.filter((bill) => bill.createdAtDate >= monthAgo);
    }

    return result;
  }, [bills, billDateFilter, now, weekAgo, monthAgo]);

  const activeOrders = useMemo(
    () => orders.filter((item) => item.status === "pending" || item.status === "preparing").length,
    [orders]
  );
  const occupied = useMemo(
    () => tables.filter((table) => table.status === "occupied" || table.isOccupied).length,
    [tables]
  );

  if (loading) {
    return (
      <AdminShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading analytics...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      restaurantName={restaurant?.name}
      activeOrders={activeOrders}
      occupiedTables={occupied}
      totalTables={tables.length}
    >
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-text-muted">Revenue Today</p><p className="text-2xl font-semibold text-success">₹{metrics.revenueToday.toFixed(0)}</p></div>
        <div className="card p-4"><p className="text-xs text-text-muted">Revenue This Week</p><p className="text-2xl font-semibold">₹{metrics.revenueWeek.toFixed(0)}</p></div>
        <div className="card p-4"><p className="text-xs text-text-muted">Revenue This Month</p><p className="text-2xl font-semibold">₹{metrics.revenueMonth.toFixed(0)}</p></div>
        <div className="card p-4"><p className="text-xs text-text-muted">Avg Order Value</p><p className="text-2xl font-semibold text-gold">₹{metrics.avgOrderValue.toFixed(0)}</p></div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card h-[320px] p-4">
          <h3 className="mb-3 font-display text-2xl">Revenue Last 7 Days</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueLast7}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E1F0A" />
              <XAxis dataKey="day" stroke="#C4B89A" />
              <YAxis stroke="#C4B89A" />
              <Tooltip contentStyle={{ backgroundColor: "#0D0A06", border: "1px solid #C4B89A", color: "#F59E0B" }} />
              <Line type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card h-[320px] p-4">
          <h3 className="mb-3 font-display text-2xl">Orders per Hour</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ordersByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E1F0A" />
              <XAxis dataKey="hour" stroke="#C4B89A" hide />
              <YAxis stroke="#C4B89A" />
              <Tooltip contentStyle={{ backgroundColor: "#0D0A06", border: "1px solid #C4B89A", color: "#F59E0B" }} />
              <Bar dataKey="orders" fill="#B45309" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-3 font-display text-2xl">Most Ordered Items</h3>
          <div className="space-y-2">
            {topItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-lg border border-border-theme px-3 py-2 text-sm">
                <span>{item.name}</span>
                <span className="badge-amber">{item.qty}</span>
              </div>
            ))}
            {!topItems.length ? <p className="text-sm text-text-muted">No item analytics yet.</p> : null}
          </div>
        </div>
        <div className="card h-[320px] p-4">
          <h3 className="mb-3 font-display text-2xl">Revenue by Category</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={revenueByCategory} dataKey="value" nameKey="name" outerRadius={90} fill="#F59E0B" />
              <Legend wrapperStyle={{ color: "#C4B89A" }} />\n              <Tooltip contentStyle={{ backgroundColor: "#0D0A06", border: "1px solid #C4B89A", color: "#F59E0B" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl">Bill History</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setBillDateFilter("all")}
              className={`text-xs px-3 py-1 rounded-full border transition ${billDateFilter === "all" ? "border-gold text-gold" : "border-border-theme text-text-secondary"}`}
            >
              All
            </button>
            <button
              onClick={() => setBillDateFilter("today")}
              className={`text-xs px-3 py-1 rounded-full border transition ${billDateFilter === "today" ? "border-gold text-gold" : "border-border-theme text-text-secondary"}`}
            >
              Today
            </button>
            <button
              onClick={() => setBillDateFilter("week")}
              className={`text-xs px-3 py-1 rounded-full border transition ${billDateFilter === "week" ? "border-gold text-gold" : "border-border-theme text-text-secondary"}`}
            >
              Week
            </button>
            <button
              onClick={() => setBillDateFilter("month")}
              className={`text-xs px-3 py-1 rounded-full border transition ${billDateFilter === "month" ? "border-gold text-gold" : "border-border-theme text-text-secondary"}`}
            >
              Month
            </button>
          </div>
        </div>

        <div className="card overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-theme">
                <th className="px-3 py-2 text-left text-text-secondary">Bill #</th>
                <th className="px-3 py-2 text-left text-text-secondary">Date & Time</th>
                <th className="px-3 py-2 text-left text-text-secondary">Table</th>
                <th className="px-3 py-2 text-left text-text-secondary">Waiter</th>
                <th className="px-3 py-2 text-right text-text-secondary">Total</th>
                <th className="px-3 py-2 text-center text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length > 0 ? (
                filteredBills.slice(0, 50).map((bill) => (
                  <tr key={bill.id} className="border-b border-border-theme/50 hover:bg-bg-primary/50 transition">
                    <td className="px-3 py-2 font-semibold text-gold">{bill.billId || bill.billNumber || "—"}</td>
                    <td className="px-3 py-2 text-text-secondary">
                      {bill.createdAtDate.toLocaleDateString("en-IN")} {bill.createdAtDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2">#{bill.tableNumber || "—"}</td>
                    <td className="px-3 py-2 text-text-secondary">{bill.createdByName || bill.waiterName || "Customer (QR)"}</td>
                    <td className="px-3 py-2 text-right font-semibold">₹{Number(bill.total || 0).toFixed(0)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="inline-flex items-center gap-1 text-gold hover:text-gold-light transition text-xs"
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-3 py-4 text-center text-text-muted">
                    No bills found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredBills.length > 50 && (
            <div className="mt-3 text-center text-xs text-text-muted">
              Showing 50 of {filteredBills.length} bills
            </div>
          )}
        </div>
      </section>

      {selectedBill && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md overflow-y-auto max-h-[80vh] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-2xl">Bill {selectedBill.billId || selectedBill.billNumber}</h3>
              <button
                onClick={() => setSelectedBill(null)}
                className="text-text-secondary hover:text-text-primary transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-4 pb-4 border-b border-border-theme">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Date:</span>
                <span>{selectedBill.createdAtDate.toLocaleDateString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Table:</span>
                <span>#{selectedBill.tableNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Waiter:</span>
                <span>{selectedBill.createdByName || selectedBill.waiterName || "Customer (QR)"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Payment:</span>
                <span className="badge-amber">{selectedBill.paymentMethod || "Cash"}</span>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-semibold text-text-secondary mb-2">Items</h4>
              {(selectedBill.items || []).map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-border-theme pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Subtotal:</span>
                <span>₹{Number(selectedBill.subtotal || 0).toFixed(0)}</span>
              </div>
              {selectedBill.gst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">GST ({selectedBill.gstPercent || 5}%):</span>
                  <span>₹{Number(selectedBill.gst || 0).toFixed(0)}</span>
                </div>
              )}
              {selectedBill.discount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Discount:</span>
                  <span>-₹{Number(selectedBill.discount || 0).toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gold pt-2 border-t border-border-theme">
                <span>Total:</span>
                <span>₹{Number(selectedBill.total || 0).toFixed(0)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                window.print();
              }}
              className="mt-4 w-full btn-gold flex items-center justify-center gap-2"
            >
              <Download size={14} /> Print Bill
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
