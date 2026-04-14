"use client";

import { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { Users } from "lucide-react";
import toast from "react-hot-toast";
import AdminShell from "@/components/AdminShell";
import { db, firebaseConfig } from "@/lib/firebase";
import { getRestaurant, subscribeToOrders, subscribeToTables } from "@/lib/firestore";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";

function getInitials(value) {
  const text = String(value || "").trim();
  if (!text) return "ST";
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function AdminStaffPage() {
  const { loading: authLoading, profile, error, setError } = useCurrentUserProfile({ allowedRoles: ["admin"] });
  const restaurantId = profile?.restaurantId || "";
  const [restaurantName, setRestaurantName] = useState("");
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

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
    setLoadingStaff(true);
    const staffQuery = query(
      collection(db, "users"),
      where("role", "==", "waiter"),
      where("restaurantId", "==", restaurantId)
    );
    const unsubscribe = onSnapshot(
      staffQuery,
      (snapshot) => {
        setStaff(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoadingStaff(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Unable to load staff members");
        setLoadingStaff(false);
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

  function resetModal() {
    setForm({ name: "", email: "", password: "" });
    setFormError("");
    setShowModal(false);
  }

  async function handleAddStaff(event) {
    event.preventDefault();
    if (!restaurantId) return;
    setSaving(true);
    setFormError("");
    try {
      const secondaryApp = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const newUser = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.password);
      const newUid = newUser.user.uid;
      await setDoc(doc(db, "users", newUid), {
        uid: newUid,
        email: form.email.trim(),
        displayName: form.name.trim(),
        role: "waiter",
        restaurantId,
        createdAt: serverTimestamp(),
        active: true,
      });
      await secondaryAuth.signOut();
      toast.success("Staff added successfully");
      resetModal();
    } catch (createError) {
      setFormError(createError.message || "Unable to add staff member");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(staffUid) {
    try {
      await updateDoc(doc(db, "users", staffUid), { active: false });
      toast.success("Staff member deactivated");
    } catch (removeError) {
      setError(removeError.message || "Unable to deactivate staff");
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-display text-3xl">Staff</h3>
        <button type="button" className="btn-gold px-4 py-2 text-sm" onClick={() => setShowModal(true)}>
          Add Staff
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {authLoading || loadingStaff ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="card p-5">
              <div className="h-11 w-11 animate-pulse rounded-full bg-amber-500/20" />
              <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-border-theme" />
              <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-border-theme" />
              <div className="mt-4 h-8 w-24 animate-pulse rounded bg-border-theme" />
            </div>
          ))}
        </div>
      ) : null}

      {!authLoading && !loadingStaff && staff.length === 0 ? (
        <div className="card flex min-h-[260px] flex-col items-center justify-center text-center">
          <Users className="mb-3 text-text-secondary" size={30} />
          <p className="text-text-secondary">No staff members yet. Add your first waiter.</p>
        </div>
      ) : null}

      {!authLoading && !loadingStaff && staff.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {staff.map((member) => (
            <div key={member.id} className="card p-5">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/25 font-semibold text-amber-300">
                    {getInitials(member.displayName || member.email)}
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">{member.displayName || "Unnamed Staff"}</p>
                    <p className="text-[13px] text-text-secondary">{member.email}</p>
                  </div>
                </div>
                <span className={member.active === false ? "badge-red" : "badge-green"}>
                  {member.active === false ? "Inactive" : "Active"}
                </span>
              </div>
              <button
                type="button"
                className="rounded-md border border-red-500 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                onClick={() => handleRemove(member.uid || member.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleAddStaff} className="card w-full max-w-md p-5">
            <h4 className="mb-4 font-display text-2xl">Add Staff</h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Full Name</label>
                <input
                  className="input-gold"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Email</label>
                <input
                  className="input-gold"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Password</label>
                <input
                  className="input-gold"
                  type="password"
                  minLength={6}
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </div>
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={saving} className="btn-gold flex-1">
                {saving ? "Adding..." : "Add Staff"}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-border-theme px-4 py-2 text-sm"
                onClick={resetModal}
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
