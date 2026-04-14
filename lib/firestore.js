import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function getUserProfile(userId) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getRestaurant(restaurantId) {
  const restaurantRef = doc(db, "restaurants", restaurantId);
  const snap = await getDoc(restaurantRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToRestaurant(restaurantId, onData, onError) {
  const restaurantRef = doc(db, "restaurants", restaurantId);
  return onSnapshot(
    restaurantRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData({ id: snapshot.id, ...snapshot.data() });
    },
    onError
  );
}

export function subscribeToTables(restaurantId, onData, onError) {
  const tablesQuery = query(collection(db, `tables/${restaurantId}/tables`), orderBy("tableNumber", "asc"));
  return onSnapshot(
    tablesQuery,
    (snapshot) => onData(snapshot.docs.map((table) => ({ id: table.id, ...table.data() }))),
    onError
  );
}

export async function addTable(restaurantId, tableNumber) {
  await addDoc(collection(db, `tables/${restaurantId}/tables`), {
    tableNumber: Number(tableNumber),
    status: "available",
    createdAt: serverTimestamp(),
  });
}

export async function setTableStatus(restaurantId, tableId, status, currentOrderId = null) {
  await updateDoc(doc(db, `tables/${restaurantId}/tables/${tableId}`), {
    status,
    ...(currentOrderId ? { currentOrderId } : {}),
    ...(currentOrderId === null ? { currentOrderId: null } : {}),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToMenu(restaurantId, onData, onError) {
  const menuQuery = query(collection(db, `menus/${restaurantId}/items`), orderBy("name", "asc"));
  return onSnapshot(
    menuQuery,
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function addMenuItem(restaurantId, item) {
  await addDoc(collection(db, `menus/${restaurantId}/items`), {
    name: item.name,
    category: item.category,
    price: Number(item.price),
    available: Boolean(item.available ?? true),
    createdAt: serverTimestamp(),
  });
}

export async function updateMenuItem(restaurantId, itemId, updates) {
  await updateDoc(doc(db, `menus/${restaurantId}/items/${itemId}`), {
    ...updates,
    ...(updates.price !== undefined ? { price: Number(updates.price) } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMenuItem(restaurantId, itemId) {
  await deleteDoc(doc(db, `menus/${restaurantId}/items/${itemId}`));
}

export function subscribeToOrders(restaurantId, onData, onError) {
  const ordersQuery = query(
    collection(db, `orders/${restaurantId}/orders`),
    orderBy("createdAt", "desc"),
    limit(200)
  );
  return onSnapshot(
    ordersQuery,
    (snapshot) => onData(snapshot.docs.map((order) => ({ id: order.id, ...order.data() }))),
    onError
  );
}

export async function placeOrder(restaurantId, payload) {
  const orderRef = await addDoc(collection(db, `orders/${restaurantId}/orders`), {
    tableNumber: Number(payload.tableNumber),
    items: payload.items,
    total: Number(payload.total),
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: payload.paymentMethod || "cash",
    createdBy: payload.createdBy,
    createdAt: serverTimestamp(),
    restaurantId,
    statusHistory: [
      {
        status: "pending",
        label: "Order received",
        changedAt: Date.now(),
      },
    ],
  });

  if (payload.tableId) {
    await setTableStatus(restaurantId, payload.tableId, "occupied", orderRef.id);
  }

  return orderRef.id;
}

export async function updateOrderStatus(restaurantId, orderId, status) {
  const labels = {
    pending: "Order received",
    preparing: "Kitchen is preparing your order",
    served: "Your order is on its way",
  };
  await updateDoc(doc(db, `orders/${restaurantId}/orders/${orderId}`), {
    status,
    updatedAt: serverTimestamp(),
    statusHistory: arrayUnion({
      status,
      label: labels[status] || status,
      changedAt: Date.now(),
    }),
  });
}

export async function fetchOrdersByRestaurant(restaurantId) {
  const ordersSnap = await getDocs(query(collection(db, `orders/${restaurantId}/orders`), orderBy("createdAt", "desc")));
  return ordersSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function createRestaurantCore({ name, ownerId, orderLimitPerDay = 50 }) {
  const restaurantRef = doc(collection(db, "restaurants"));
  await setDoc(restaurantRef, {
    name,
    ownerId,
    createdAt: serverTimestamp(),
    plan: "free",
    orderLimitPerDay,
  });
  return restaurantRef.id;
}

export async function createUserProfile({ uid, email, displayName, role, restaurantId }) {
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    displayName,
    role,
    restaurantId,
    active: true,
    createdAt: serverTimestamp(),
  });
}

export async function listStaffByRestaurant(restaurantId) {
  const staffSnap = await getDocs(
    query(collection(db, "users"), where("restaurantId", "==", restaurantId), where("role", "==", "waiter"))
  );
  return staffSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export function subscribeToStaff(restaurantId, onData, onError) {
  const staffQuery = query(
    collection(db, "users"),
    where("restaurantId", "==", restaurantId),
    where("role", "==", "waiter")
  );
  return onSnapshot(
    staffQuery,
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function disableStaffUser(uid) {
  await updateDoc(doc(db, "users", uid), {
    active: false,
    disabledAt: serverTimestamp(),
  });
}
