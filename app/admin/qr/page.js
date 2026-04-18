"use client";

import { useEffect, useMemo, useState } from "react";
import SearchBar from "@/components/SearchBar";
import JSZip from "jszip";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import AdminShell from "@/components/AdminShell";
import { getRestaurant, subscribeToOrders, subscribeToTables, subscribeToMenu } from "@/lib/firestore";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function getDomain() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminQrPage() {
  const { loading, user, role, restaurantId, error, setError } = useCurrentUser({ allowedRoles: ["admin"] });
  const [restaurant, setRestaurant] = useState(null);
  const [tables, setTables] = useState([]);
  const [qrSearch, setQrSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearch, setMenuSearch] = useState("");

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId).then(setRestaurant).catch((e) => setError(e.message));
  }, [restaurantId, setError]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubTables = subscribeToTables(restaurantId, setTables, (e) => setError(e.message));
    const unsubOrders = subscribeToOrders(restaurantId, setOrders, (e) => setError(e.message));
    return () => {
      unsubTables();
      unsubOrders();
    };
  }, [restaurantId, setError]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === "pending" || o.status === "preparing").length,
    [orders]
  );
  const occupied = useMemo(
    () => tables.filter((table) => table.status === "occupied" || table.isOccupied).length,
    [tables]
  );

  function qrValue(tableNumber) {
    return `${getDomain()}/qr/${restaurantId}/${tableNumber}`;
  }

  async function downloadSingle(tableNumber) {
    const canvas = document.getElementById(`qr-${tableNumber}`);
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `table-${tableNumber}.png`);
    });
  }

  async function downloadAllZip() {
    try {
      const zip = new JSZip();
      await Promise.all(
        tables.map(async (table) => {
          const canvas = document.getElementById(`qr-${table.tableNumber}`);
          if (!canvas) return;
          const data = canvas.toDataURL("image/png").split(",")[1];
          zip.file(`table-${table.tableNumber}.png`, data, { base64: true });
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      downloadBlob(content, "dineboss-qr-codes.zip");
      toast.success("ZIP downloaded");
    } catch (zipError) {
      setError(zipError.message || "Unable to download ZIP");
      toast.error("ZIP download failed");
    }
  }

  function printAll() {
    window.print();
  }

  // Compute filteredTables without using extra hooks to avoid hook-order issues
  const filteredTables = (() => {
    if (!restaurantId) return tables;
    if (!qrSearch) return tables;
    const q = String(qrSearch).toLowerCase();
    return tables.filter((t) => String(t.tableNumber).toLowerCase().includes(q));
  })();

  // Dessert menu section (desserts) with search
  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsub = subscribeToMenu(
      restaurantId,
      (items) => setMenuItems(items),
      (err) => {
        // Keep existing error handling through setError
        setError(err?.message || 'Unable to load menu');
      }
    );
    return unsub;
  }, [restaurantId, setError]);

  const desserts = useMemo(() => {
    return menuItems.filter((m) => String((m.category || '').toLowerCase()) === 'dessert');
  }, [menuItems]);
  const dessertsFiltered = useMemo(() => {
    if (!desserts.length) return desserts;
    if (!menuSearch) return desserts;
    const q = menuSearch.toLowerCase();
    return desserts.filter((d) => (d.name || '').toLowerCase().includes(q));
  }, [desserts, menuSearch]);

  if (loading) {
    return (
      <AdminShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading QR center...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  // (duplicate hook removed) ensure single source of truth for filteredTables

  return (
    <AdminShell
      restaurantName={restaurant?.name}
      activeOrders={activeOrders}
      occupiedTables={occupied}
      totalTables={tables.length}
    >
      <div className="mb-4 flex items-center justify-between gap-2 w-full">
        <div className="flex-1"></div>
        <SearchBar placeholder="Search tables" onSearch={setQrSearch} />
      </div>
      <div className="mb-4 flex gap-2">
        <button className="btn-gold" type="button" onClick={downloadAllZip}>
          Download All as ZIP
        </button>
        <button className="rounded-lg border border-border-theme px-4 py-2" type="button" onClick={printAll}>
          Print All
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTables.map((table) => (
          <div key={table.id} className="card text-center">
            <p className="mb-2 font-semibold">Table {table.tableNumber}</p>
            <QRCodeCanvas id={`qr-${table.tableNumber}`} value={qrValue(table.tableNumber)} size={180} includeMargin />
            <button className="btn-gold mt-3 w-full" type="button" onClick={() => downloadSingle(table.tableNumber)}>
              Download PNG
            </button>
            <p className="mt-2 break-all text-xs text-text-muted">{qrValue(table.tableNumber)}</p>
          </div>
        ))}
      </div>
      {!tables.length ? <p className="text-sm text-text-muted">No tables found for QR generation.</p> : null}

      {/* Dessert Menu Section in QR Page */}
      <div className="card p-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-2xl">Desserts</h3>
          <SearchBar placeholder="Search desserts" onSearch={(q)=>setMenuSearch(q)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dessertsFiltered.map((d) => (
            <div key={d.id} className="card p-3">
              <div className="font-semibold mb-1">{d.name}</div>
              {d.description && <div className="text-xs text-text-secondary mb-1" style={{ minHeight: '1.2em' }}>{d.description}</div>}
              <div className="mt-1 font-semibold text-gold">₹{Number(d.price || 0).toFixed(0)}</div>
            </div>
          ))}
        </div>
        {dessertsFiltered.length === 0 ? (
          <div className="text-sm text-text-muted mt-2">No desserts match your search.</div>
        ) : null}
      </div>
    </AdminShell>
  );
}
