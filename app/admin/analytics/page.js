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
import AdminShell from "@/components/AdminShell";
import { getRestaurant, subscribeToOrders, subscribeToTables } from "@/lib/firestore";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function sameDay(a, b) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export default function AdminAnalyticsPage() {
  const { loading, user, role, restaurantId, error, setError } = useCurrentUser({ allowedRoles: ["admin"] });
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId).then(setRestaurant).catch((e) => setError(e.message));
  }, [restaurantId, setError]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubOrders = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message));
    const unsubTables = subscribeToTables(restaurantId, setTables, (e) => setError(e.message));
    return () => {
      unsubOrders();
      unsubTables();
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
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [normalizedOrders]);

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
              <Tooltip />
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
              <Tooltip />
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
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </AdminShell>
  );
}
