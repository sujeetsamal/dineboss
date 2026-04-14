"use client";

import { Minus, Plus, Pencil, Trash2 } from "lucide-react";

export default function MenuItem({
  item,
  quantity = 0,
  adminMode = false,
  onAdd,
  onRemove,
  onToggleAvailable,
  onEdit,
  onDelete,
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{item.name}</h3>
          <p className="mt-1 text-xs text-text-secondary">{item.category}</p>
        </div>
        <p className="text-sm font-bold text-gold">₹{Number(item.price || 0).toFixed(0)}</p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className={item.available ? "badge-green" : "badge-red"}>
          {item.available ? "Available" : "Unavailable"}
        </span>

        {adminMode ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleAvailable?.(item)}
              className="rounded-lg border border-border-theme px-2 py-1 text-xs"
            >
              Toggle
            </button>
            <button
              type="button"
              onClick={() => onEdit?.(item)}
              className="rounded-lg border border-border-theme p-1 text-gold"
              aria-label="Edit item"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(item)}
              className="rounded-lg border border-border-theme p-1 text-danger"
              aria-label="Delete item"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!item.available || quantity <= 0}
              onClick={() => onRemove?.(item)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-theme disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <span className="min-w-8 text-center text-sm font-semibold">{quantity}</span>
            <button
              type="button"
              disabled={!item.available}
              onClick={() => onAdd?.(item)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold text-gold disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
