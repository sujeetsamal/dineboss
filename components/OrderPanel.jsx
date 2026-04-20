"use client";

const STATUS_BORDERS = {
  pending: "border-l-[#F59E0B]",           // amber
  preparing: "border-l-[#3B82F6]",        // blue
  served: "border-l-[#06B6D4]",           // cyan
  completed: "border-l-[#6B7280]",        // gray (faded)
  rejected: "border-l-[#EF4444]",         // red
};

const STATUS_BADGES = {
  pending: "badge-amber",
  preparing: "badge-blue",
  served: "badge-cyan",
  completed: "badge-gray",
  rejected: "badge-red",
};

function getMinutesAgo(createdAt) {
  const value = createdAt?.toDate ? createdAt.toDate().getTime() : Number(createdAt?.seconds || 0) * 1000;
  if (!value) return "just now";
  const diff = Math.max(0, Date.now() - value);
  const mins = Math.floor(diff / 60000);
  if (mins <= 0) return "just now";
  return `${mins} min ago`;
}

function displayStaffName(name) {
  return name || "Customer (QR)";
}

export default function OrderPanel({ order, onStatusChange, onGenerateBill, showActions = false, showAttribution = false }) {
  return (
    <div className={`card border-l-4 p-4 ${STATUS_BORDERS[order.status] || STATUS_BORDERS.pending}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="badge-amber">Table {order.tableNumber}</span>
          <span className="text-xs text-text-muted">{getMinutesAgo(order.createdAt)}</span>
        </div>
        <span className={`capitalize ${STATUS_BADGES[order.status] || 'badge-amber'}`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>

      <ul className="mt-3 space-y-1 text-sm text-text-secondary">
        {order.items?.map((item) => (
          <li key={`${item.id || item.name}-${item.quantity}`} className="flex items-center justify-between">
            <span>
              {item.quantity}x {item.name}
            </span>
            <span>₹{Number(item.price || 0) * Number(item.quantity || 0)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border-theme pt-2 text-sm font-semibold">
        Total ₹{Number(order.total || 0).toFixed(0)}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        Payment: <span className="capitalize">{order.paymentStatus || "unpaid"}</span>
      </p>
      {showAttribution ? (
        <div className="mt-2 space-y-0.5 text-xs text-text-muted">
          <p>Created by: {displayStaffName(order.createdByName)}</p>
          <p>Last updated by: {displayStaffName(order.lastUpdatedByName)}</p>
        </div>
      ) : null}

      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === "pending" && (
            <button type="button" onClick={() => onStatusChange?.("preparing")} className="btn-gold px-3 py-2 text-xs">
              Start Cooking
            </button>
          )}

          {order.status === "preparing" && (
            <button type="button" onClick={() => onStatusChange?.("served")} className="btn-gold px-3 py-2 text-xs">
              Mark Served
            </button>
          )}

          {order.status === "served" && (
            <>
              <button type="button" onClick={() => onStatusChange?.("completed")} className="btn-gold px-3 py-2 text-xs">
                Complete Order
              </button>
              <button
                type="button"
                onClick={() => onGenerateBill?.()}
                className="px-3 py-2 text-xs border border-gold text-gold rounded hover:bg-gold/10 transition"
              >
                Generate Bill
              </button>
            </>
          )}

          {order.status === "completed" && (
            <>
              <span className="badge-green">✓ Completed</span>
              <button type="button" onClick={() => onGenerateBill?.()} className="px-3 py-2 text-xs border border-gold text-gold rounded hover:bg-gold/10 transition">
                Generate Bill
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
