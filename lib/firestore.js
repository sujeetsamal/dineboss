import { getApps, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
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
import { firebaseConfig, db } from "@/lib/firebase";

export async function createStaffUser({ email, password, displayName, restaurantId }) {
  // Use a secondary Firebase app instance for staff creation
  const secondaryApp = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
  const secondaryAuth = getAuth(secondaryApp);
  const newUser = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const newUid = newUser.user.uid;
  await setDoc(doc(db, "users", newUid), {
    uid: newUid,
    email,
    displayName,
    role: "waiter",
    restaurantId,
    createdAt: serverTimestamp(),
    active: true,
  });
  await secondaryAuth.signOut();
}

export async function deleteTable(restaurantId, tableId) {
  await deleteDoc(doc(db, `tables/${restaurantId}/tables/${tableId}`));
}

function normalizeMenuCategory(category) {
  const value = String(category || "").trim().toLowerCase();
  if (!value) return "drinks";
  if (value === "nonveg" || value === "non veg" || value === "non_veg") return "non-veg";
  if (value === "drink" || value === "beverage" || value === "beverages") return "drinks";
  return value;
}

function normalizeMenuItem(item) {
  return {
    ...item,
    name: String(item?.name || "").trim(),
    price: Number(item?.price || 0),
    category: normalizeMenuCategory(item?.category),
    available: Boolean(item?.available ?? item?.isAvailable ?? true),
    isAvailable: Boolean(item?.available ?? item?.isAvailable ?? true),
  };
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      id: item?.id || `item-${index}`,
      name: String(item?.name || "").trim(),
      price: Number(item?.price || 0),
      quantity: Number(item?.quantity || 0),
      category: normalizeMenuCategory(item?.category),
    }))
    .filter((item) => item.name && item.quantity > 0);
}

function normalizePaymentStatus(paymentStatus) {
  const value = String(paymentStatus || "").trim().toLowerCase();
  if (value === "paid") return "paid";
  return "unpaid";
}

function normalizeOrder(order) {
  const items = normalizeOrderItems(order?.items);
  const computedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    ...order,
    items,
    total: Number(order?.total ?? computedTotal),
    status: String(order?.status || "pending").trim().toLowerCase(),
    paymentStatus: normalizePaymentStatus(order?.paymentStatus),
  };
}

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
  const menuQuery = query(collection(db, `restaurants/${restaurantId}/menu`), orderBy("name", "asc"));
  return onSnapshot(
    menuQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => normalizeMenuItem({ id: item.id, ...item.data() }));
      console.log(items);
      onData(items);
    },
    onError
  );
}

export async function addMenuItem(restaurantId, item) {
  const normalizedItem = normalizeMenuItem(item);
  await addDoc(collection(db, `restaurants/${restaurantId}/menu`), {
    name: normalizedItem.name,
    category: normalizedItem.category,
    price: normalizedItem.price,
    imageUrl: item.imageUrl || "",
    description: item.description || "",
    available: normalizedItem.available,
    createdAt: serverTimestamp(),
  });
}

export async function updateMenuItem(restaurantId, itemId, updates) {
  const normalizedUpdates = {
    ...updates,
    ...(updates.name !== undefined ? { name: String(updates.name || "").trim() } : {}),
    ...(updates.category !== undefined ? { category: normalizeMenuCategory(updates.category) } : {}),
    ...(updates.price !== undefined ? { price: Number(updates.price) } : {}),
    ...(updates.available !== undefined || updates.isAvailable !== undefined
      ? { available: Boolean(updates.available ?? updates.isAvailable) }
      : {}),
  };
  await updateDoc(doc(db, `restaurants/${restaurantId}/menu/${itemId}`), {
    ...normalizedUpdates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMenuItem(restaurantId, itemId) {
  await deleteDoc(doc(db, `restaurants/${restaurantId}/menu/${itemId}`));
}

export function subscribeToOrders(restaurantId, onData, onError) {
  const ordersQuery = query(
    collection(db, `orders/${restaurantId}/orders`),
    orderBy("createdAt", "desc"),
    limit(200)
  );
  return onSnapshot(
    ordersQuery,
    (snapshot) => onData(snapshot.docs.map((order) => normalizeOrder({ id: order.id, ...order.data() }))),
    onError
  );
}

export async function placeOrder(restaurantId, payload) {
  // Try to check usage limit, but don't fail if restaurant read fails (QR orders)
  let restaurant = null;
  try {
    restaurant = await getRestaurant(restaurantId);
  } catch (e) {
    console.warn("Could not fetch restaurant for limit check:", e.message);
    // For QR orders from unauthenticated users, skip strict limit check
    restaurant = { plan: "basic", orderLimit: 500, currentUsage: 0 };
  }
  
  const currentUsage = restaurant?.currentUsage || 0;
  const orderLimit = restaurant?.orderLimit || 500;
  const plan = restaurant?.plan || "basic";

  // Check if limit exceeded (only enforce for scale plans)
  if (currentUsage >= orderLimit && plan === "scale") {
    throw new Error(`Order limit reached for your plan (${currentUsage}/${orderLimit}). Please upgrade.`);
  }

  const items = normalizeOrderItems(payload.items);
  if (!items.length) {
    throw new Error("Cart empty");
  }
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const orderRef = await addDoc(collection(db, `orders/${restaurantId}/orders`), {
    tableNumber: Number(payload.tableNumber),
    items,
    total,
    status: "pending",
    paymentStatus: normalizePaymentStatus(payload.paymentStatus),
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

  // ✅ Order created successfully, now do post-order tasks (non-blocking)
  try {
    // Increment usage (may fail for QR orders - that's OK)
    await incrementOrderUsage(restaurantId);
  } catch (e) {
    console.warn("Could not increment order usage:", e.message);
  }

  if (payload.tableId) {
    try {
      await setTableStatus(restaurantId, payload.tableId, "occupied", orderRef.id);
    } catch (e) {
      console.warn("Could not update table status:", e.message);
    }
  }

  return orderRef.id;
}

export async function updateOrderStatus(restaurantId, orderId, status) {
  const labels = {
    pending: "Order received",
    preparing: "Kitchen is preparing your order",
    served: "Your order is on its way",
    completed: "Order completed",
  };
  
  // Get the order to find the tableId
  let tableId = null;
  if (status === "completed") {
    try {
      const orderDocSnap = await getDoc(doc(db, `orders/${restaurantId}/orders/${orderId}`));
      if (orderDocSnap.exists()) {
        tableId = orderDocSnap.data().tableId;
      }
    } catch (e) {
      console.warn("Could not fetch order to get tableId:", e.message);
    }
  }
  
  await updateDoc(doc(db, `orders/${restaurantId}/orders/${orderId}`), {
    status,
    updatedAt: serverTimestamp(),
    statusHistory: arrayUnion({
      status,
      label: labels[status] || status,
      changedAt: Date.now(),
    }),
  });
  
  // Auto-release table when order is completed
  if (status === "completed" && tableId) {
    try {
      await setTableStatus(restaurantId, tableId, "available", null);
    } catch (e) {
      console.warn("Could not release table:", e.message);
    }
  }
}

async function saveBill(restaurantId, orderId, orderData) {
  const items = normalizeOrderItems(orderData?.items).map((item) => ({
    ...item,
    total: Number(item.price || 0) * Number(item.quantity || 0),
  }));

  const totalAmount = Number(orderData?.totalAmount ?? orderData?.total ?? 0);
  const tax = Number(orderData?.tax || 0);
  const discount = Number(orderData?.discount || 0);
  const serviceCharge = Number(orderData?.serviceCharge || 0);
  const finalAmount = Number(
    orderData?.finalAmount ?? totalAmount + tax + serviceCharge - discount
  );

  const billData = {
    orderId,
    tableId: orderData?.tableId || null,
    tableNumber: Number(orderData?.tableNumber || 0),
    items,
    totalAmount,
    tax,
    gstPercent: Number(orderData?.gstPercent || 5),
    gstNumber: (orderData && orderData.gstNumber) ? orderData.gstNumber : "",
    discount,
    serviceCharge,
    serviceChargePercent: Number(orderData?.serviceChargePercent || 0),
    finalAmount,
    paymentMethod: orderData?.paymentMethod || "cash",
    paymentStatus: "paid",
    status: String(orderData?.status || "").trim().toLowerCase(),
    createdAt: orderData?.createdAt || serverTimestamp(),
    paidAt: serverTimestamp(),
    waiterName: orderData?.waiterName || "Admin",
  };

  await addDoc(collection(db, `restaurants/${restaurantId}/bills`), billData);
}

export async function updateOrderPaymentStatus(restaurantId, orderId, paymentStatus, orderData) {
  const normalizedStatus = normalizePaymentStatus(paymentStatus);
  
  // Update order payment status
  await updateDoc(doc(db, `orders/${restaurantId}/orders/${orderId}`), {
    paymentStatus: normalizedStatus,
    updatedAt: serverTimestamp(),
  });

  // If payment marked as paid, create bill record
  if (normalizedStatus === "paid" && orderData) {
    await saveBill(restaurantId, orderId, orderData);
    
    // Auto-reset table if order is completed AND paid
    if (orderData.status === "completed" && orderData.tableId) {
      try {
        await setTableStatus(restaurantId, orderData.tableId, "available", null);
      } catch (e) {
        console.warn("Could not reset table status:", e.message);
      }
    }
  }
}

export async function updateOrderBillDetails(restaurantId, orderId, billDetails) {
  const updatePayload = {
    totalAmount: Number(billDetails.totalAmount || 0),
    tax: Number(billDetails.tax || 0),
    discount: Number(billDetails.discount || 0),
    finalAmount: Number(billDetails.finalAmount || 0),
    serviceCharge: Number(billDetails.serviceCharge || 0),
    gstPercent: Number(billDetails.gstPercent || 5),
    serviceChargePercent: Number(billDetails.serviceChargePercent || 0),
    paymentMethod: billDetails.paymentMethod || "cash",
    billUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Handle items update if provided
  if (billDetails.items !== undefined) {
    updatePayload.items = normalizeOrderItems(billDetails.items);
  }

  // Handle discountType if provided
  if (billDetails.discountType !== undefined) {
    updatePayload.discountType = billDetails.discountType;
  }

  await updateDoc(doc(db, `orders/${restaurantId}/orders/${orderId}`), updatePayload);
}

// Create a manual bill (no order) for POS usage
export async function createManualBill(restaurantId, payload) {
  // Normalize items if provided
  const items = normalizeOrderItems(payload.items || [])
  // Compute total if not provided
  const totalAmount = Number(payload.total ?? items.reduce((sum, it) => sum + it.price * (it.quantity || 1), 0))

  const billData = {
    tableNumber: Number(payload.tableNumber ?? 0),
    items,
    totalAmount,
    tax: Number(payload.tax ?? 0),
    gstPercent: Number(payload.gstPercent ?? 5),
    discount: Number(payload.discount ?? 0),
    serviceCharge: Number(payload.serviceCharge ?? 0),
    serviceChargePercent: Number(payload.serviceChargePercent ?? 0),
    finalAmount: Number(payload.finalAmount ?? totalAmount),
    paymentMethod: payload.paymentMethod ?? 'cash',
    paymentStatus: payload.paymentStatus ?? 'paid',
    status: String(payload.status ?? 'paid'),
    createdAt: serverTimestamp(),
    restaurantId,
    waiterName: payload.waiterName ?? 'Admin',
  }

  const billRef = await addDoc(collection(db, `restaurants/${restaurantId}/bills`), billData)
  return billRef.id
}

export async function fetchOrdersByRestaurant(restaurantId) {
  const ordersSnap = await getDocs(query(collection(db, `orders/${restaurantId}/orders`), orderBy("createdAt", "desc")));
  return ordersSnap.docs.map((item) => normalizeOrder({ id: item.id, ...item.data() }));
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

export async function updateRestaurant(restaurantId, updates) {
  const restaurantRef = doc(db, "restaurants", restaurantId);
  await updateDoc(restaurantRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
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

export function subscribeToBills(restaurantId, onData, onError) {
  const billsQuery = query(
    collection(db, `restaurants/${restaurantId}/bills`),
    orderBy("createdAt", "desc"),
    limit(500)
  );
  return onSnapshot(
    billsQuery,
    (snapshot) => onData(snapshot.docs.map((bill) => ({ id: bill.id, ...bill.data() }))),
    onError
  );
}

export async function deleteBill(restaurantId, billId) {
  await deleteDoc(doc(db, `restaurants/${restaurantId}/bills/${billId}`));
}

// BILLING & USAGE TRACKING
export async function incrementOrderUsage(restaurantId) {
  const rest = await getRestaurant(restaurantId);
  const currentUsage = rest?.currentUsage || 0;
  await updateDoc(doc(db, "restaurants", restaurantId), {
    currentUsage: currentUsage + 1,
    updatedAt: serverTimestamp(),
  });
}

export async function updateRestaurantPlan(restaurantId, plan) {
  const planDetails = {
    basic: { orderLimit: 500, price: 199 },
    growth: { orderLimit: 1000, price: 499 },
    pro: { orderLimit: 2000, price: 899 },
    scale: { orderLimit: 999999, price: 1499 },
  };
  const detail = planDetails[plan] || planDetails.basic;
  await updateDoc(doc(db, "restaurants", restaurantId), {
    plan,
    orderLimit: detail.orderLimit,
    currentUsage: 0,
    billingStartDate: serverTimestamp(),
    billingEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    updatedAt: serverTimestamp(),
  });
}

export async function resetMonthlyUsage(restaurantId) {
  await updateDoc(doc(db, "restaurants", restaurantId), {
    currentUsage: 0,
    billingStartDate: serverTimestamp(),
    billingEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteOrder(restaurantId, orderId) {
  await deleteDoc(doc(db, `orders/${restaurantId}/orders/${orderId}`));
}

export async function getBillById(restaurantId, billId) {
  const billRef = doc(db, `restaurants/${restaurantId}/bills/${billId}`);
  const billSnap = await getDoc(billRef);
  if (!billSnap.exists()) return null;
  return { id: billSnap.id, ...billSnap.data() };
}
