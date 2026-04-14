'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ChefHat, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminShell from '@/components/AdminShell';
import { getRestaurant, subscribeToOrders, updateOrderStatus } from '@/lib/firestore';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const statusColors = {
  pending: 'bg-yellow-50 border-yellow-200',
  preparing: 'bg-blue-50 border-blue-200',
  served: 'bg-green-50 border-green-200',
};

const statusIcons = {
  pending: Clock,
  preparing: ChefHat,
  served: Check,
};

export default function LiveOrdersPage() {
  const { loading, restaurantId, error: userError } = useCurrentUser({ allowedRoles: ['admin'] });
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId)
      .then((data) => {
        if (data) setRestaurant(data);
      })
      .catch((err) => setError(err.message || 'Failed to load restaurant'));
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message || 'Failed to load orders'));
    return () => unsub?.();
  }, [restaurantId]);

  async function handleStatusChange(orderId, newStatus) {
    if (!restaurantId) return;
    try {
      await updateOrderStatus(restaurantId, orderId, newStatus);
      toast.success(`Order moved to ${newStatus}`);
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
      activeOrders={orders.filter((o) => o.status !== 'served').length}
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
              const nextStatus = order.status === 'pending' ? 'preparing' : order.status === 'preparing' ? 'served' : null;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`card flex items-center justify-between border p-4 ${statusColors[order.status]}`}
                >
                  <div className="flex items-center gap-4">
                    <StatusIcon size={24} className="text-gold" />
                    <div>
                      <p className="font-semibold">Table {order.tableNumber}</p>
                      <p className="text-sm text-text-muted">
                        {order.items?.length || 0} item
                        {order.items?.length !== 1 ? 's' : ''}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
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

                  <div className="flex gap-2">
                    {nextStatus && (
                      <button
                        onClick={() => handleStatusChange(order.id, nextStatus)}
                        className="btn-gold px-4 py-2 text-sm"
                      >
                        Mark {nextStatus}
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
