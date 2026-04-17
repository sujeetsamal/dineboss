'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShoppingCart, Clock, Phone, MapPin } from 'lucide-react';
import MenuItem from './MenuItem';
import toast from 'react-hot-toast';
import { subscribeToRestaurant } from '@/lib/firestore';

const CATEGORY_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Veg', value: 'veg' },
  { label: 'Non-Veg', value: 'non-veg' },
  { label: 'Drinks', value: 'drinks' },
];

/**
 * Public Menu Page Component
 * Displays the restaurant's menu to customers
 * This component works across all domain types (subdomain and custom domain)
 */
export default function PublicMenuPage({ restaurantId, restaurant, slug }) {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [restaurantInfo, setRestaurantInfo] = useState(restaurant);
  const [queryError, setQueryError] = useState(null);

  useEffect(() => {
    fetchMenuItems();
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubscribe = subscribeToRestaurant(restaurantId, (data) => {
      if (data) {
        setRestaurantInfo((prev) => ({
          ...prev,
          ...data,
        }));
      }
    });
    return () => unsubscribe?.();
  }, [restaurantId]);

  async function fetchMenuItems() {
    try {
      console.log('[PublicMenuPage] Fetching menu for restaurantId:', restaurantId);
      const collectionPath = `restaurants/${restaurantId}/menu`;
      
      // Try fetching with where clause first (filters out unavailable items)
      try {
        console.log('[PublicMenuPage] Attempt 1: Query with available=true filter');
        const menuQuery = query(
          collection(db, collectionPath),
          where('available', '==', true),
          orderBy('name', 'asc')
        );
        const snapshot = await getDocs(menuQuery);
        
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            category: String(data.category || '').trim().toLowerCase(),
            price: Number(data.price || 0),
          };
        });
        
        console.log('[PublicMenuPage] ✓ Query successful - found', items.length, 'available items');
        setMenuItems(items);
        setQueryError(null);
      } catch (whereError) {
        // Fallback: fetch all items and filter in code
        console.log('[PublicMenuPage] Attempt 1 failed:', whereError.message);
        console.log('[PublicMenuPage] Attempt 2: Fallback - fetch all items and filter in code');
        
        const allItemsQuery = query(
          collection(db, collectionPath),
          orderBy('name', 'asc')
        );
        const snapshot = await getDocs(allItemsQuery);
        
        const items = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              category: String(data.category || '').trim().toLowerCase(),
              price: Number(data.price || 0),
              available: Boolean(data.available ?? data.isAvailable ?? true), // Default to true if not set
            };
          })
          .filter((item) => item.available !== false); // Show items that are available OR have undefined available status
        
        console.log('[PublicMenuPage] ✓ Fallback query successful - found', items.length, 'items');
        setMenuItems(items);
        setQueryError(null);
      }
    } catch (error) {
      console.error('[PublicMenuPage] ✗ Failed to load menu:', {
        message: error.message,
        code: error.code,
        restaurantId,
      });
      
      console.log('[PublicMenuPage] Troubleshooting:');
      console.log('  - Verify restaurant ID is correct:', restaurantId);
      console.log('  - Check Firestore security rules allow public read');
      console.log('  - Verify menu collection exists at /restaurants/{id}/menu');
      console.log('  - Check Firebase project is dineboss-prod');
      
      setQueryError(error.message);
      toast.error('Failed to load menu - ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAddToCart(item) {
    setSelectedItems((prev) => {
      const existingItem = prev.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return prev.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...prev, { id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
    toast.success(`${item.name} added to cart`);
  }

  function handleRemoveFromCart(item) {
    setSelectedItems((prev) => {
      const existingItem = prev.find((cartItem) => cartItem.id === item.id);
      if (!existingItem) return prev;
      if (existingItem.quantity <= 1) {
        return prev.filter((cartItem) => cartItem.id !== item.id);
      }
      return prev.map((cartItem) =>
        cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity - 1 } : cartItem
      );
    });
    toast.success('Item removed');
  }

  const filteredMenuItems = useMemo(() => {
    return selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory);
  }, [menuItems, selectedCategory]);

  const cartTotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [selectedItems]
  );
  const itemCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems]
  );

  const domain = restaurantInfo?.customDomain || `${slug}.dineboss.app`;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome to {restaurantInfo?.name || 'Restaurant'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Powered by DineBoss</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Accessible at: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-xs">{domain}</code>
              </p>
            </div>
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Cart Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ₹{cartTotal.toFixed(0)}
                  </p>
                </div>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
                  <ShoppingCart className="w-5 h-5 inline mr-2" />
                  {itemCount} Items
                </button>
              </div>
            )}
          </div>

          {/* Restaurant Info */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {restaurantInfo?.phone && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4" />
                <a href={`tel:${restaurantInfo.phone}`} className="hover:text-blue-600">
                  {restaurantInfo.phone}
                </a>
              </div>
            )}
            {restaurantInfo?.address && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>{restaurantInfo.address}</span>
              </div>
            )}
            {restaurantInfo?.acceptingOrders !== false && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Clock className="w-4 h-4" />
                <span>Accepting Orders</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-4 border-gray-300 border-t-blue-600 animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading menu...</p>
            </div>
          </div>
        ) : menuItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-600 dark:text-gray-400 text-lg">Menu not available yet</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedCategory(tab.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                    selectedCategory === tab.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredMenuItems.map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                quantity={selectedItems.find((cartItem) => cartItem.id === item.id)?.quantity || 0}
                onAdd={() => handleAddToCart(item)}
                onRemove={() => handleRemoveFromCart(item)}
              />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Powered by <strong>DineBoss</strong></p>
        </div>
      </footer>
    </div>
  );
}
