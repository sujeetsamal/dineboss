/**
 * Date filtering utilities for order analytics
 * All functions use LOCAL TIMEZONE (not UTC)
 */

/**
 * Get human-readable time since creation
 * @param {Firestore Timestamp|Date|number} createdAt - Creation timestamp
 * @returns {string} - Time string like "5 min ago"
 */
export function getMinutesAgo(createdAt) {
  const value = createdAt?.toDate ? createdAt.toDate().getTime() : Number(createdAt?.seconds || 0) * 1000 || new Date(createdAt).getTime();
  if (!value || isNaN(value)) return "just now";
  const diff = Math.max(0, Date.now() - value);
  const mins = Math.floor(diff / 60000);
  if (mins <= 0) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  return "older";
}

/**
 * Get start of day (00:00:00) for a given date
 * @param {Date} date - Input date (defaults to now)
 * @returns {Date} - Start of day in local timezone
 */
export function getStartOfDay(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  );
}

/**
 * Get end of day (23:59:59.999) for a given date
 * @param {Date} date - Input date (defaults to now)
 * @returns {Date} - End of day in local timezone
 */
export function getEndOfDay(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

/**
 * Check if an order was created today
 * Safe for Firestore Timestamp objects
 * @param {Object} order - Order object with createdAt field
 * @returns {boolean} - True if order created today
 */
export function isOrderToday(order) {
  if (!order || !order.createdAt) return false;
  
  try {
    // Handle Firestore Timestamp objects
    const createdDate = order.createdAt.toDate 
      ? order.createdAt.toDate() 
      : new Date(order.createdAt);
    
    if (!(createdDate instanceof Date) || isNaN(createdDate)) {
      return false;
    }
    
    const startOfDay = getStartOfDay();
    const endOfDay = getEndOfDay();
    
    return createdDate >= startOfDay && createdDate <= endOfDay;
  } catch (error) {
    console.warn("Error checking if order is today:", error);
    return false;
  }
}

/**
 * Get all orders from today
 * @param {Array} orders - Array of order objects
 * @returns {Array} - Filtered orders from today only
 */
export function getOrdersToday(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.filter(isOrderToday);
}

/**
 * Calculate total revenue from orders
 * @param {Array} orders - Array of order objects
 * @returns {number} - Total revenue
 */
export function calculateRevenue(orders) {
  if (!Array.isArray(orders)) return 0;
  return orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
}

/**
 * Get today's revenue
 * @param {Array} orders - Array of order objects
 * @returns {number} - Today's revenue
 */
export function getRevenueToday(orders) {
  return calculateRevenue(getOrdersToday(orders));
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} - True if same day
 */
export function sameDay(date1, date2) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}
