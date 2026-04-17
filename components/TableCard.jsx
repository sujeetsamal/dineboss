"use client";

export default function TableCard({ table, isSelected, onSelect }) {
  const occupied = table.status === "occupied" || table.isOccupied;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(table)}
      className={`card w-full p-4 text-left transition ${
        isSelected ? "border-gold shadow-[0_0_24px_rgba(245,158,11,0.18)]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Table {table.tableNumber}</h3>
        <span className={occupied ? "badge-amber" : "badge-green"}>{occupied ? "Occupied" : "Available"}</span>
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        {occupied ? "Serving an active order" : "Ready for a new order"}
      </p>
    </button>
  );
}
