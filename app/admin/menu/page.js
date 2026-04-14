"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";
import AdminShell from "@/components/AdminShell";
import { db } from "@/lib/firebase";
import { getRestaurant, subscribeToOrders, subscribeToTables } from "@/lib/firestore";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";

const DEFAULT_FORM = {
  name: "",
  category: "veg",
  price: "",
  description: "",
  isAvailable: true,
};

function categoryBadge(category) {
  const value = String(category || "").toLowerCase();
  if (value === "veg") return "badge-green";
  if (value === "non-veg") return "badge-red";
  return "badge-amber";
}

export default function AdminMenuPage() {
  const { loading: authLoading, profile, error, setError } = useCurrentUserProfile({ allowedRoles: ["admin"] });
  const restaurantId = profile?.restaurantId || "";
  const [restaurantName, setRestaurantName] = useState("");
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [deleteId, setDeleteId] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId)
      .then((restaurant) => setRestaurantName(restaurant?.name || ""))
      .catch((restaurantError) => setError(restaurantError.message || "Unable to load restaurant"));
  }, [restaurantId, setError]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubTables = subscribeToTables(restaurantId, setTables, (tablesError) =>
      setError(tablesError.message || "Unable to load tables")
    );
    const unsubOrders = subscribeToOrders(restaurantId, setOrders, (ordersError) =>
      setError(ordersError.message || "Unable to load orders")
    );
    return () => {
      unsubTables();
      unsubOrders();
    };
  }, [restaurantId, setError]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    setLoadingItems(true);
    const itemsQuery = query(collection(db, `menus/${restaurantId}/items`), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      itemsQuery,
      (snapshot) => {
        setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoadingItems(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Unable to load menu");
        setLoadingItems(false);
      }
    );
    return () => unsubscribe();
  }, [restaurantId, setError]);

  const activeOrders = useMemo(
    () => orders.filter((item) => item.status === "pending" || item.status === "preparing").length,
    [orders]
  );
  const occupied = useMemo(
    () => tables.filter((table) => table.status === "occupied" || table.isOccupied).length,
    [tables]
  );

  function openAddModal() {
    setEditingItem(null);
    setForm(DEFAULT_FORM);
    setFormError("");
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      category: String(item.category || "veg").toLowerCase(),
      price: item.price ?? "",
      description: item.description || "",
      isAvailable: item.isAvailable ?? item.available ?? true,
    });
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingItem(null);
    setForm(DEFAULT_FORM);
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!restaurantId) return;
    if (!form.name.trim() || !form.price) {
      setFormError("Item name and price are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        description: form.description.trim(),
        isAvailable: Boolean(form.isAvailable),
        available: Boolean(form.isAvailable),
        restaurantId,
      };
      if (editingItem?.id) {
        await updateDoc(doc(db, `menus/${restaurantId}/items/${editingItem.id}`), payload);
        toast.success("Item updated");
      } else {
        await addDoc(collection(db, `menus/${restaurantId}/items`), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Item added");
      }
      closeModal();
    } catch (submitError) {
      setFormError(submitError.message || "Unable to save item");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item) {
    if (!restaurantId) return;
    const current = item.isAvailable ?? item.available ?? true;
    const next = !current;
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isAvailable: next, available: next } : row)));
    try {
      await updateDoc(doc(db, `menus/${restaurantId}/items/${item.id}`), { isAvailable: next, available: next });
    } catch (toggleError) {
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isAvailable: current, available: current } : row)));
      setError(toggleError.message || "Unable to update availability");
    }
  }

  async function handleDelete(item) {
    if (!restaurantId) return;
    try {
      await deleteDoc(doc(db, `menus/${restaurantId}/items/${item.id}`));
      toast.success("Item deleted");
      setDeleteId("");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete item");
    }
  }

  return (
    <AdminShell
      profile={profile}
      restaurantName={restaurantName}
      activeOrders={activeOrders}
      occupiedTables={occupied}
      totalTables={tables.length}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-[24px]">Menu Management</h3>
          <span className="badge-amber">{items.length} items</span>
        </div>
        <button type="button" className="btn-gold px-4 py-2 text-sm" onClick={openAddModal}>
          Add Item
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {authLoading || loadingItems ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="card p-5">
              <div className="mb-2 h-5 w-1/2 animate-pulse rounded bg-border-theme" />
              <div className="mb-4 h-3 w-3/4 animate-pulse rounded bg-border-theme" />
              <div className="h-6 w-20 animate-pulse rounded bg-border-theme" />
            </div>
          ))}
        </div>
      ) : null}

      {!authLoading && !loadingItems && items.length === 0 ? (
        <div className="card flex min-h-[280px] flex-col items-center justify-center text-center">
          <UtensilsCrossed className="mb-3 text-text-secondary" size={30} />
          <p className="text-text-secondary">No menu items yet. Add your first item.</p>
        </div>
      ) : null}

      {!authLoading && !loadingItems && items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const isAvailable = item.isAvailable ?? item.available ?? true;
            const isDeleting = deleteId === item.id;
            return (
              <div key={item.id} className="card relative p-5">
                <span className={`${categoryBadge(item.category)} absolute right-4 top-4`}>{item.category || "drinks"}</span>
                <h4 className="pr-20 text-[18px] font-semibold text-text-primary">{item.name}</h4>
                {item.description ? (
                  <p
                    className="mt-2 text-[13px] text-text-secondary"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.description}
                  </p>
                ) : null}
                <p className="mt-3 text-[20px] font-bold text-gold">₹{Number(item.price || 0).toFixed(0)}</p>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleAvailability(item)}
                    className={`relative h-7 w-14 rounded-full border transition ${
                      isAvailable
                        ? "border-green-400 bg-green-500/30 shadow-[0_0_14px_rgba(52,211,153,0.45)]"
                        : "border-zinc-600 bg-zinc-600/30"
                    }`}
                    aria-label="Toggle availability"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                        isAvailable ? "left-8" : "left-1"
                      }`}
                    />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-amber-500/50 p-2 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => openEditModal(item)}
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-500/50 p-2 text-red-400 hover:bg-red-500/10"
                      onClick={() => setDeleteId(item.id)}
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isDeleting ? (
                  <div className="mt-4 rounded-lg border border-red-900/70 bg-red-900/20 p-3">
                    <p className="text-sm text-red-200">Delete {item.name}?</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-md border border-border-theme px-3 py-1.5 text-xs"
                        onClick={() => setDeleteId("")}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-md border border-red-500 px-3 py-1.5 text-xs text-red-300"
                        onClick={() => handleDelete(item)}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-lg p-5">
            <h4 className="mb-4 font-display text-2xl">{editingItem ? "Edit Item" : "Add Item"}</h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Item Name</label>
                <input
                  className="input-gold"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Category</label>
                <select
                  className="input-gold"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                >
                  <option value="veg">veg</option>
                  <option value="non-veg">non-veg</option>
                  <option value="drinks">drinks</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Price</label>
                <input
                  className="input-gold"
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Description</label>
                <textarea
                  className="input-gold"
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border-theme px-3 py-2">
                <span className="text-sm text-text-secondary">Available</span>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, isAvailable: !prev.isAvailable }))}
                  className={`relative h-7 w-14 rounded-full border transition ${
                    form.isAvailable
                      ? "border-green-400 bg-green-500/30 shadow-[0_0_14px_rgba(52,211,153,0.45)]"
                      : "border-zinc-600 bg-zinc-600/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      form.isAvailable ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" className="btn-gold flex-1" disabled={saving}>
                {saving ? "Saving..." : editingItem ? "Save Changes" : "Add Item"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-lg border border-border-theme px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AdminShell>
  );
}
