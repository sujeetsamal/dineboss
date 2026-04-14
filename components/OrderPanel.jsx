"use client";

const STATUS_BORDERS = {
  pending: "border-l-amber-500",
  preparing: "border-l-sky-500",
  served: "border-l-emerald-500",
};

function getMinutesAgo(createdAt) {
  const value = createdAt?.toDate ? createdAt.toDate().getTime() : Number(createdAt?.seconds || 0) * 1000;
  if (!value) return "just now";
  const diff = Math.max(0, Date.now() - value);
  const mins = Math.floor(diff / 60000);
  if (mins <= 0) return "just now";
  return `${mins} min ago`;
}

export default function OrderPanel({ order, onStatusChange, showActions = false }) {
  return (
    <div className={`card border-l-4 p-4 ${STATUS_BORDERS[order.status] || STATUS_BORDERS.pending}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="badge-amber">Table {order.tableNumber}</span>
          <span className="text-xs text-text-muted">{getMinutesAgo(order.createdAt)}</span>
        </div>
        <span className={`capitalize ${order.status === "served" ? "badge-green" : "badge-amber"}`}>
          {order.status}
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

      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === "pending" ? (
            <button type="button" onClick={() => onStatusChange?.("preparing")} className="btn-gold px-3 py-2 text-xs">
              Start Preparing
            </button>
          ) : null}
          {order.status === "preparing" ? (
            <button type="button" onClick={() => onStatusChange?.("served")} className="btn-gold px-3 py-2 text-xs">
              Mark Served
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
