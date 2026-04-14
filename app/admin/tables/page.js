"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { Grid3x3, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AdminShell from "@/components/AdminShell";
import { db } from "@/lib/firebase";
import { getRestaurant, subscribeToOrders } from "@/lib/firestore";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";

export default function AdminTablesPage() {
  const { loading: authLoading, profile, error, setError } = useCurrentUserProfile({ allowedRoles: ["admin"] });
  const restaurantId = profile?.restaurantId || "";
  const [restaurantName, setRestaurantName] = useState("");
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState("");

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId)
      .then((restaurant) => setRestaurantName(restaurant?.name || ""))
      .catch((restaurantError) => setError(restaurantError.message || "Unable to load restaurant"));
  }, [restaurantId, setError]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubOrders = subscribeToOrders(restaurantId, setOrders, (ordersError) =>
      setError(ordersError.message || "Unable to load orders")
    );
    return () => unsubOrders();
  }, [restaurantId, setError]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    setLoadingTables(true);
    const tablesQuery = query(collection(db, `tables/${restaurantId}/tables`), orderBy("tableNumber", "asc"));
    const unsubscribe = onSnapshot(
      tablesQuery,
      (snapshot) => {
        setTables(snapshot.docs.map((table) => ({ id: table.id, ...table.data() })));
        setLoadingTables(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Unable to load tables");
        setLoadingTables(false);
      }
    );
    return () => unsubscribe();
  }, [restaurantId, setError]);

  const occupiedCount = useMemo(
    () => tables.filter((table) => table.status === "occupied" || table.isOccupied).length,
    [tables]
  );
  const activeOrders = useMemo(
    () => orders.filter((item) => item.status === "pending" || item.status === "preparing").length,
    [orders]
  );

  async function handleAddTable(event) {
    event.preventDefault();
    if (!restaurantId) return;
    const parsed = Number(tableNumber);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFormError("Please enter a valid table number.");
      return;
    }
    const duplicate = tables.some((table) => Number(table.tableNumber) === parsed);
    if (duplicate) {
      setFormError("Table number already exists.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const tableRef = doc(collection(db, `tables/${restaurantId}/tables`));
      await setDoc(tableRef, {
        tableNumber: parsed,
        status: "available",
        restaurantId,
        currentOrderId: null,
        createdAt: serverTimestamp(),
      });
      setTableNumber("");
      setShowModal(false);
      toast.success("Table added");
    } catch (createError) {
      setFormError(createError.message || "Unable to add table");
    } finally {
      setSaving(false);
    }
  }

  async function markAvailable(tableId) {
    if (!restaurantId) return;
    try {
      await updateDoc(doc(db, `tables/${restaurantId}/tables/${tableId}`), {
        status: "available",
        currentOrderId: null,
      });
      toast.success("Table marked available");
    } catch (updateError) {
      setError(updateError.message || "Unable to update table");
    }
  }

  async function handleDelete(table) {
    if (!restaurantId || table.status === "occupied") return;
    try {
      await deleteDoc(doc(db, `tables/${restaurantId}/tables/${table.id}`));
      toast.success("Table deleted");
      setDeleteId("");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete table");
    }
  }

  if (authLoading) {
    return (
      <AdminShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading tables...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      profile={profile}
      restaurantName={restaurantName}
      activeOrders={activeOrders}
      occupiedTables={occupiedCount}
      totalTables={tables.length}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-3xl">Tables</h3>
          <span className="badge-amber">
            {occupiedCount} occupied / {tables.length} total
          </span>
        </div>
        <button type="button" className="btn-gold px-4 py-2 text-sm" onClick={() => setShowModal(true)}>
          Add Table
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {authLoading || loadingTables ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="card p-6">
              <div className="mx-auto h-14 w-14 animate-pulse rounded bg-border-theme" />
              <div className="mx-auto mt-3 h-5 w-24 animate-pulse rounded bg-border-theme" />
            </div>
          ))}
        </div>
      ) : null}

      {!authLoading && !loadingTables && tables.length === 0 ? (
        <div className="card flex min-h-[280px] flex-col items-center justify-center text-center">
          <Grid3x3 className="mb-3 text-text-secondary" size={30} />
          <p className="text-text-secondary">No tables yet. Add your first table.</p>
        </div>
      ) : null}

      {!authLoading && !loadingTables && tables.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {tables.map((table) => {
            const occupied = table.status === "occupied" || table.isOccupied;
            const isDeleteConfirm = deleteId === table.id;
            return (
              <div key={table.id} className="card p-6">
                <p className="text-center font-display text-[48px] leading-none text-text-primary">{table.tableNumber}</p>
                <div className="mt-3 flex justify-center">
                  <span className={occupied ? "badge-amber" : "badge-green"}>{occupied ? "Occupied" : "Available"}</span>
                </div>
                {occupied && table.currentOrderId ? (
                  <p className="mt-2 truncate text-center text-xs text-text-secondary">{table.currentOrderId}</p>
                ) : null}

                {occupied ? (
                  <button
                    type="button"
                    className="mt-4 w-full rounded-md border border-green-500 px-3 py-2 text-xs text-green-400 hover:bg-green-500/10"
                    onClick={() => markAvailable(table.id)}
                  >
                    Mark Available
                  </button>
                ) : null}

                {!isDeleteConfirm ? (
                  <button
                    type="button"
                    disabled={occupied}
                    title={occupied ? "Cannot delete occupied table" : "Delete table"}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-red-500 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => setDeleteId(table.id)}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                ) : (
                  <div className="mt-3 rounded-lg border border-red-900/70 bg-red-900/20 p-2">
                    <p className="text-center text-xs text-red-200">Delete table {table.tableNumber}?</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded border border-border-theme px-2 py-1 text-xs"
                        onClick={() => setDeleteId("")}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded border border-red-500 px-2 py-1 text-xs text-red-300"
                        onClick={() => handleDelete(table)}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleAddTable} className="card w-full max-w-sm p-5">
            <h4 className="mb-4 font-display text-2xl">Add Table</h4>
            <label className="mb-1 block text-sm text-text-secondary">Table Number</label>
            <input
              className="input-gold"
              type="number"
              min="1"
              value={tableNumber}
              onChange={(event) => setTableNumber(event.target.value)}
              required
            />
            {formError ? <p className="mt-2 text-sm text-danger">{formError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving} className="btn-gold flex-1">
                {saving ? "Adding..." : "Add Table"}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-border-theme px-4 py-2 text-sm"
                onClick={() => {
                  setShowModal(false);
                  setTableNumber("");
                  setFormError("");
                }}
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
