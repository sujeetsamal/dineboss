'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { subscribeToOrders, subscribeToRestaurant, updateOrderStatus } from '@/lib/firestore';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOrderNotification } from '@/hooks/useOrderNotification';

function minsSince(createdAt) {
  const timestamp = createdAt?.toDate ? createdAt.toDate().getTime() : Number(createdAt?.seconds || 0) * 1000;
  if (!timestamp) return '0 min';
  return `${Math.max(0, Math.floor((Date.now() - timestamp) / 60000))} min`;
}

function KitchenCard({ order, onAction, isNew }) {
  return (
    <motion.div 
      initial={{ x: -10, opacity: 0 }} 
      animate={{ x: 0, opacity: 1 }} 
      className={`card p-4 relative transition-all ${isNew ? 'ring-2 ring-gold animate-pulse' : ''}`}
    >
      {isNew && <div className="absolute top-2 right-2 badge-amber animate-bounce">NEW</div>}
      <p className="text-sm text-text-muted">#{String(order.index || 0).padStart(3, '0')}</p>
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
          {order.status === 'pending'
            ? 'Start Cooking'
            : order.status === 'preparing'
              ? 'Mark Served'
              : 'Complete Order'}
        </button>
      ) : null}
    </motion.div>
  );
}

export default function KitchenPage() {
  const { loading, restaurantId, error: userError } = useCurrentUser({ redirectTo: '/login' });
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [newOrderIds, setNewOrderIds] = useState(new Set());
  const prevOrderCountRef = useRef(0);
  const [enableSound, setEnableSound] = useState(false);
  const { playSound } = useOrderNotification();

  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = subscribeToOrders(restaurantId, (newOrders) => {
      // Detect new orders
      const currentPendingCount = newOrders.filter(o => o.status === 'pending').length;
      if (prevOrderCountRef.current > 0 && currentPendingCount > prevOrderCountRef.current) {
        // New order arrived
        if (enableSound) {
          playSound();
        }
        const newOrderId = newOrders.find(o => o.status === 'pending' && !newOrderIds.has(o.id))?.id;
        if (newOrderId) {
          setNewOrderIds(prev => new Set(prev).add(newOrderId));
          // Remove "NEW" badge after 5 seconds
          setTimeout(() => {
            setNewOrderIds(prev => {
              const updated = new Set(prev);
              updated.delete(newOrderId);
              return updated;
            });
          }, 5000);
        }
      }
      prevOrderCountRef.current = currentPendingCount;
      setOrders(newOrders);
    }, (e) => setError(e.message || 'Failed to load orders'));
    return () => unsubscribe?.();
  }, [restaurantId, playSound, newOrderIds, enableSound]);

  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = subscribeToRestaurant(
      restaurantId,
      (restaurant) => {
        setRestaurantName(restaurant?.name || '');
        setEnableSound(restaurant?.enableOrderSound !== false);
      },
      (restaurantError) => setError(restaurantError.message || 'Failed to load restaurant')
    );
    return () => unsubscribe?.();
  }, [restaurantId]);

  const columns = useMemo(
    () => ({
      pending: orders
        .filter((order) => order.status === 'pending')
        .map((order, index) => ({ ...order, index: index + 1 })),
      preparing: orders
        .filter((order) => order.status === 'preparing')
        .map((order, index) => ({ ...order, index: index + 1 })),
      served: orders
        .filter((order) => order.status === 'served')
        .map((order, index) => ({ ...order, index: index + 1 })),
      completed: orders
        .filter((order) => order.status === 'completed')
        .slice(0, 10)
        .map((order, index) => ({ ...order, index: index + 1 })),
    }),
    [orders]
  );

  async function setStatus(orderId, status) {
    if (!restaurantId) return;
    try {
      await updateOrderStatus(restaurantId, orderId, status);
      toast.success(`Order moved to ${status}`);
    } catch (updateError) {
      setError(updateError.message || 'Unable to update order');
      toast.error('Status update failed');
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-sm text-text-muted">Loading kitchen screen...</p>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary p-4">
        <div className="rounded-lg bg-red-50 p-6 text-red-800">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{userError}</p>
        </div>
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary p-4">
        <div className="text-center">
          <p className="text-text-muted">Unable to determine restaurant</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg-primary p-4 text-text-primary md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-4xl text-gold">
          {restaurantName ? `${restaurantName} Kitchen` : 'Kitchen Screen'}
        </h1>
      </div>
      
      {/* Kitchen Stats */}
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="card p-4 border-l-4 border-yellow-500">
          <p className="text-xs uppercase tracking-wide text-text-muted">Pending Orders</p>
          <p className="mt-2 text-3xl font-bold text-yellow-400">{columns.pending.length}</p>
        </div>
        <div className="card p-4 border-l-4 border-blue-500">
          <p className="text-xs uppercase tracking-wide text-text-muted">Preparing</p>
          <p className="mt-2 text-3xl font-bold text-blue-400">{columns.preparing.length}</p>
        </div>
        <div className="card p-4 border-l-4 border-purple-500">
          <p className="text-xs uppercase tracking-wide text-text-muted">Ready to Serve</p>
          <p className="mt-2 text-3xl font-bold text-purple-400">{columns.served.length}</p>
        </div>
        <div className="card p-4 border-l-4 border-gold">
          <p className="text-xs uppercase tracking-wide text-text-muted">Total Orders</p>
          <p className="mt-2 text-3xl font-bold text-gold">{orders.length}</p>
        </div>
      </section>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <h2 className="mb-3 font-display text-xl">PENDING</h2>
          <div className="space-y-3">
            {columns.pending.length === 0 ? (
              <p className="text-sm text-text-muted">No pending</p>
            ) : (
              columns.pending.map((order) => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  isNew={newOrderIds.has(order.id)}
                  onAction={() => setStatus(order.id, 'preparing')}
                />
              ))
            )}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-xl">PREPARING</h2>
          <div className="space-y-3">
            {columns.preparing.length === 0 ? (
              <p className="text-sm text-text-muted">No preparing</p>
            ) : (
              columns.preparing.map((order) => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  onAction={() => setStatus(order.id, 'served')}
                />
              ))
            )}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-xl">SERVED</h2>
          <div className="space-y-3">
            {columns.served.length === 0 ? (
              <p className="text-sm text-text-muted">No served</p>
            ) : (
              columns.served.map((order) => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  onAction={() => setStatus(order.id, 'completed')}
                />
              ))
            )}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-xl">COMPLETED</h2>
          <div className="space-y-3">
            {columns.completed.length === 0 ? (
              <p className="text-sm text-text-muted">No completed</p>
            ) : (
              columns.completed.map((order) => (
                <motion.div key={order.id} exit={{ x: 20, opacity: 0 }}>
                  <KitchenCard order={order} />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

