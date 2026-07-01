'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShoppingCart, Clock, Phone, MapPin } from 'lucide-react';
import MenuItem from './MenuItem';
import SearchBar from '@/components/SearchBar';
import toast from 'react-hot-toast';
import { subscribeToRestaurant } from '@/lib/firestore';

const CATEGORY_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Veg', value: 'veg' },
  { label: 'Non-Veg', value: 'non-veg' },
  { label: 'Drinks', value: 'drinks' },
  { label: 'Dessert', value: 'dessert' },
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
  const [menuSearch, setMenuSearch] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

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
      const collectionPath = `restaurants/${restaurantId}/menu`;
      
      // Try fetching with where clause first (filters out unavailable items)
      try {
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
        
        setMenuItems(items);
        setQueryError(null);
      } catch (whereError) {
        // Fallback: fetch all items and filter in code
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
        
        setMenuItems(items);
        setQueryError(null);
      }
    } catch (error) {
      console.error('[PublicMenuPage] ✗ Failed to load menu:', {
        message: error.message,
        code: error.code,
        restaurantId,
      });
      
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
    let items = selectedCategory === 'all' ? menuItems : menuItems.filter((item) => item.category === selectedCategory);
    if (menuSearch) {
      const q = menuSearch.toLowerCase();
      items = items.filter((item) =>
        String(item.name || '').toLowerCase().includes(q) ||
        String(item.category || '').toLowerCase().includes(q) ||
        String(item.description || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [menuItems, selectedCategory, menuSearch]);

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
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
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
        <div className="mb-4">
          <SearchBar placeholder="Search menu" onSearch={setMenuSearch} />
        </div>
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

      {/* Slide-over Cart Panel */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={() => setIsCartOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-gray-800 shadow-xl flex flex-col">
              <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  Your Cart
                </h2>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-gray-400 hover:text-gray-500 text-2xl font-medium"
                >
                  &times;
                </button>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {selectedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 pb-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.name}</h4>
                      <p className="text-sm text-gray-500">₹{item.price}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemoveFromCart(item)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-gray-700"
                      >
                        &minus;
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-gray-900 dark:text-white">{item.quantity}</span>
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-gray-700"
                      >
                        +
                      </button>
                    </div>
                    <p className="ml-4 font-bold text-gray-900 dark:text-white">₹{(item.price * item.quantity).toFixed(0)}</p>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-6 bg-gray-50 dark:bg-gray-900 space-y-4">
                <div className="flex justify-between text-base font-medium text-gray-900 dark:text-white">
                  <p>Subtotal</p>
                  <p>₹{cartTotal.toFixed(0)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsCheckoutModalOpen(true)}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow transition text-center"
                  >
                    Check Out
                  </button>
                  <button
                    onClick={() => {
                      setSelectedItems([]);
                      setIsCartOpen(false);
                      toast.success("Cart cleared");
                    }}
                    className="py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Info Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setIsCheckoutModalOpen(false)} />
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative z-10 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">How to Place Your Order</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              You are currently viewing the online public menu. To order:
            </p>
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">📍 Dining at the restaurant?</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Please scan the QR code located on your table to place a direct order to the kitchen.
                </p>
              </div>
              {restaurantInfo?.phone && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="font-semibold text-green-800 dark:text-green-200 text-sm">📞 Ordering Take-Away / Delivery?</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    Call us directly at <a href={`tel:${restaurantInfo.phone}`} className="underline font-semibold text-blue-600 dark:text-blue-400">{restaurantInfo.phone}</a> to place your order manually.
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsCheckoutModalOpen(false)}
              className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
