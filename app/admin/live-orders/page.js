'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChefHat, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminShell from '@/components/AdminShell';
import { subscribeToOrders, subscribeToRestaurant, updateOrderStatus } from '@/lib/firestore';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const statusColors = {
  pending: 'bg-yellow-50 border-yellow-200',
  preparing: 'bg-blue-50 border-blue-200',
  served: 'bg-green-50 border-green-200',
  completed: 'bg-slate-50 border-slate-200',
  rejected: 'bg-red-50 border-red-200',
};

const statusIcons = {
  pending: Clock,
  preparing: ChefHat,
  served: Check,
  completed: Check,
  rejected: XCircle,
};

const statusBadges = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  preparing: 'bg-blue-100 text-blue-800 border-blue-200',
  served: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-slate-100 text-slate-700 border-slate-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

function displayStaffName(name) {
  return name || 'Customer (QR)';
}

export default function LiveOrdersPage() {
  const { loading, user, profile, restaurantId, error: userError } = useCurrentUser({ allowedRoles: ['admin'] });
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [rejectConfirmId, setRejectConfirmId] = useState(null);

  const actor = {
    uid: user?.uid,
    name: profile?.displayName || user?.displayName || user?.email || 'Admin',
  };

  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = subscribeToRestaurant(
      restaurantId,
      (data) => {
        if (data) setRestaurant(data);
      },
      (err) => setError(err.message || 'Failed to load restaurant')
    );
    return () => unsubscribe?.();
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message || 'Failed to load orders'));
    return () => unsub?.();
  }, [restaurantId]);

  async function handleStatusChange(orderId, newStatus) {
    if (!restaurantId) return;
    try {
      await updateOrderStatus(restaurantId, orderId, newStatus, actor);
      toast.success(`Order moved to ${newStatus}`);
      setRejectConfirmId(null);
    } catch (err) {
      setError(err.message || 'Failed to update order');
      toast.error('Could not update order');
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading live orders...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (userError) {
    return (
      <AdminShell>
        <div className="rounded-lg bg-red-50 p-4 text-red-800">Error: {userError}</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      restaurantName={restaurant?.name}
      activeOrders={orders.filter((o) => o.status !== 'completed' && o.status !== 'rejected').length}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl text-gold">Live Orders</h1>
          <p className="mt-1 text-sm text-text-muted">Real-time order status and management</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm">{error}</div>}

        {orders.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-text-muted/30 p-12 text-center">
            <p className="text-sm text-text-muted">No active orders</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {orders.map((order) => {
              const StatusIcon = statusIcons[order.status] || Clock;
              const nextStatus =
                order.status === 'preparing'
                  ? 'served'
                  : order.status === 'served'
                    ? 'completed'
                    : null;
              const nextActionLabel =
                order.status === 'preparing'
                  ? 'Mark Served'
                  : order.status === 'served'
                    ? 'Complete Order'
                    : null;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`card flex flex-col gap-4 border p-4 md:flex-row md:items-center md:justify-between ${statusColors[order.status] || statusColors.pending}`}
                >
                  <div className="flex items-start gap-4">
                    <StatusIcon size={24} className={order.status === 'rejected' ? 'text-red-600' : 'text-gold'} />
                    <div>
                      <p className="font-semibold">Table {order.tableNumber}</p>
                      <p className="text-sm text-text-muted">
                        {order.items?.length || 0} item
                        {order.items?.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-text-muted capitalize">
                        Payment: {order.paymentStatus || 'unpaid'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full border px-2 py-0.5 font-semibold capitalize ${statusBadges[order.status] || statusBadges.pending}`}>
                          {order.status || 'pending'}
                        </span>
                        <span className="text-text-muted">Created by: {displayStaffName(order.createdByName)}</span>
                        <span className="text-text-muted">Last updated by: {displayStaffName(order.lastUpdatedByName)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {order.items?.slice(0, 2).map((item, i) => (
                          <span key={i} className="inline-block rounded bg-text-muted/10 px-2 py-0.5 text-xs">
                            {item.quantity}x {item.name}
                          </span>
                        ))}
                        {order.items?.length > 2 && (
                          <span className="inline-block rounded bg-text-muted/10 px-2 py-0.5 text-xs">
                            +{order.items.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(order.id, 'preparing')}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                        >
                          Accept
                        </button>
                        {rejectConfirmId === order.id ? (
                          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                            <button
                              onClick={() => handleStatusChange(order.id, 'rejected')}
                              className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setRejectConfirmId(null)}
                              className="rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRejectConfirmId(order.id)}
                            className="rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Reject
                          </button>
                        )}
                      </>
                    )}
                    {nextStatus && (
                      <button
                        onClick={() => handleStatusChange(order.id, nextStatus)}
                        className="btn-gold px-4 py-2 text-sm"
                      >
                        {nextActionLabel}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
