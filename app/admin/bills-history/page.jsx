"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Download,
  Eye,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AdminShell from "@/components/AdminShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { subscribeToBills, getBillById, subscribeToMenu, deleteBill } from "@/lib/firestore";
import { getMinutesAgo } from "@/lib/dateUtils";

export default function BillsHistoryPage() {
  const router = useRouter();
  const { loading, restaurantId, error: userError } = useCurrentUser({
    allowedRoles: ["admin"],
  });
  const [bills, setBills] = useState([]);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedBill, setSelectedBill] = useState(null);
  const [billDetail, setBillDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [printSize, setPrintSize] = useState("80mm");
  const [menuItems, setMenuItems] = useState([]);
  const [showMenuPicker, setShowMenuPicker] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Subscribe to menu items
  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = subscribeToMenu(restaurantId, setMenuItems, (err) => {
      console.error("Failed to load menu:", err);
    });
    return unsubscribe;
  }, [restaurantId]);

  // Filter menu items based on search
  const filteredMenuItems = useMemo(() => {
    if (!menuSearch) return menuItems;
    return menuItems.filter(item =>
      item.name?.toLowerCase().includes(menuSearch.toLowerCase()) ||
      item.category?.toLowerCase().includes(menuSearch.toLowerCase())
    );
  }, [menuItems, menuSearch]);

  // Subscribe to bills
  useEffect(() => {
    if (!restaurantId) return undefined;
    const unsubscribe = subscribeToBills(restaurantId, setBills, (err) => {
      setError(err.message || "Failed to load bills");
    });
    return unsubscribe;
  }, [restaurantId]);

  // Filter bills
  const filteredBills = useMemo(() => {
    let result = [...bills];

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const startDate = new Date();
      if (dateFilter === "today") {
        startDate.setDate(now.getDate());
      } else if (dateFilter === "week") {
        startDate.setDate(now.getDate() - 7);
      } else if (dateFilter === "month") {
        startDate.setDate(now.getDate() - 30);
      }
      result = result.filter((bill) => {
        const billDate = bill.paidAt?.toDate?.() || bill.createdAt?.toDate?.() || new Date(0);
        return billDate >= startDate;
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (bill) =>
          String(bill.tableNumber).includes(query) ||
          String(bill.orderId).toLowerCase().includes(query) ||
          String(bill.paymentMethod).toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => {
      const dateA = b.paidAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      const dateB = a.paidAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      return dateA - dateB;
    });
  }, [bills, searchQuery, dateFilter]);

  const handleViewBill = async (bill) => {
    setSelectedBill(bill);
    setBillDetail(bill);
    setShowDetailModal(true);
  };

  const handleAddItemToBill = (menuItem) => {
    if (!billDetail) return;
    
    const newItem = {
      name: menuItem.name,
      price: menuItem.price,
      quantity: 1,
      category: menuItem.category,
      total: menuItem.price,
    };
    
    const updatedItems = [...(billDetail.items || []), newItem];
    const updatedBill = {
      ...billDetail,
      items: updatedItems,
      totalAmount: updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      finalAmount: updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    };
    
    setBillDetail(updatedBill);
    toast.success(`${menuItem.name} added to bill!`);
    setShowMenuPicker(false);
    setMenuSearch("");
  };

  const handlePrintBill = (bill, size = "80mm") => {
    if (!bill) return;

    const maxWidth = size === "58mm" ? "58mm" : size === "80mm" ? "80mm" : "210mm";
    const items = bill.items || [];
    const billHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bill - Table ${bill.tableNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: ${maxWidth};
            margin: 0;
            padding: 10px;
            background: white;
            color: #000;
          }
          .invoice {
            border: 1px solid #000;
            padding: 15px;
            text-align: center;
          }
          .header {
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .restaurant-name {
            font-size: 16px;
            font-weight: bold;
          }
          .bill-info {
            text-align: left;
            font-size: 12px;
            margin: 10px 0;
          }
          .bill-info p {
            margin: 2px 0;
          }
          .items {
            text-align: left;
            margin: 15px 0;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 10px 0;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin: 5px 0;
          }
          .item-name {
            flex: 1;
          }
          .item-qty {
            width: 30px;
            text-align: center;
          }
          .item-price {
            width: 50px;
            text-align: right;
          }
          .totals {
            text-align: left;
            font-size: 12px;
            margin: 10px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
          }
          .grand-total {
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 5px 0;
            margin: 10px 0;
            font-weight: bold;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            margin-top: 15px;
            border-top: 1px solid #000;
            padding-top: 10px;
          }
          @media print {
            body { margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div class="restaurant-name">DineBoss</div>
            <p style="margin: 5px 0 0 0; font-size: 11px;">BILL COPY</p>
          </div>

          <div class="bill-info">
            <p><strong>Table:</strong> ${bill.tableNumber}</p>
            <p><strong>Bill ID:</strong> ${String(bill.orderId).substring(0, 8).toUpperCase()}</p>
            <p><strong>Date:</strong> ${new Date(bill.paidAt?.toDate?.() || bill.createdAt?.toDate?.() || new Date()).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date(bill.paidAt?.toDate?.() || bill.createdAt?.toDate?.() || new Date()).toLocaleTimeString()}</p>
          </div>

          <div class="items">
            <div style="font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px; display: flex; justify-content: space-between; font-size: 11px;">
              <span style="flex: 1;">Item</span>
              <span style="width: 30px; text-align: center;">Qty</span>
              <span style="width: 50px; text-align: right;">Amount</span>
            </div>
            ${items.map(item => `
              <div class="item-row">
                <div class="item-name">${item.name}</div>
                <div class="item-qty">${item.quantity}</div>
                <div class="item-price">₹${item.total?.toFixed(0) || 0}</div>
              </div>
            `).join('')}
          </div>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₹${bill.totalAmount?.toFixed(0) || 0}</span>
            </div>
            ${bill.tax > 0 ? `
              <div class="total-row">
                <span>GST (${bill.gstPercent}%):</span>
                <span>₹${bill.tax?.toFixed(0) || 0}</span>
              </div>
            ` : ''}
            ${bill.serviceCharge > 0 ? `
              <div class="total-row">
                <span>Service:</span>
                <span>₹${bill.serviceCharge?.toFixed(0) || 0}</span>
              </div>
            ` : ''}
            ${bill.discount > 0 ? `
              <div class="total-row">
                <span>Discount:</span>
                <span>-₹${bill.discount?.toFixed(0) || 0}</span>
              </div>
            ` : ''}
          </div>

          <div class="grand-total">
            <div style="display: flex; justify-content: space-between;">
              <span>TOTAL:</span>
              <span>₹${bill.finalAmount?.toFixed(0) || 0}</span>
            </div>
          </div>

          <div class="bill-info">
            <p><strong>Payment:</strong> ✓ ${bill.paymentMethod || 'Cash'}</p>
          </div>

          ${bill.gstNumber ? `
            <div style="font-size: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #000;">
              <p><strong>GST:</strong> ${bill.gstNumber}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your visit!</p>
            <p style="margin: 5px 0 0 0; font-size: 10px;">Powered by DineBoss</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(billHTML);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDeleteBill = async () => {
    if (!selectedBill || !restaurantId) return;
    setDeleting(true);
    try {
      await deleteBill(restaurantId, selectedBill.id);
      toast.success("Bill deleted successfully");
      setShowDetailModal(false);
      setShowDeleteConfirm(false);
      setSelectedBill(null);
    } catch (err) {
      toast.error(err.message || "Failed to delete bill");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading bills...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      {error && <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">📋 Bill History</h1>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border-theme p-2 hover:bg-bg-card transition"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="card p-5 space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <input
                type="text"
                placeholder="Search by table, bill ID, or payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border-theme bg-bg-primary px-4 py-2.5 text-sm text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </div>
            <div className="flex gap-2">
              {["all", "today", "week", "month"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    dateFilter === filter
                      ? "bg-gold text-bg-primary"
                      : "border border-border-theme text-text-secondary hover:border-gold"
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bills Table */}
        <div className="card overflow-hidden">
          {filteredBills.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-theme bg-bg-card">
                    <th className="px-5 py-4 text-left text-xs font-semibold text-text-secondary">Bill ID</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-text-secondary">Table</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-text-secondary">Date & Time</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-text-secondary">Payment</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-text-secondary">Total</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill, idx) => (
                    <motion.tr
                      key={bill.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-b border-border-theme hover:bg-bg-card/50 transition"
                    >
                      <td className="px-5 py-4 text-sm font-mono text-text-muted">
                        {String(bill.orderId).substring(0, 8).toUpperCase()}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold">Table {bill.tableNumber}</td>
                      <td className="px-5 py-4 text-xs text-text-secondary">
                        {new Date(bill.paidAt?.toDate?.() || bill.createdAt?.toDate?.() || new Date()).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <span className="inline-block rounded-full border border-green-500/50 bg-green-500/10 px-2.5 py-1 text-green-300 font-semibold">
                          ✓ {bill.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gold text-right">
                        ₹{Number(bill.finalAmount || 0).toFixed(0)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewBill(bill)}
                            className="rounded p-2 text-blue-400 hover:bg-blue-500/20 transition"
                            title="View Bill"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintBill(bill, "80mm")}
                            className="rounded p-2 text-gold hover:bg-gold/20 transition"
                            title="Print Bill"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-center">
              <p className="text-text-muted">No bills found</p>
            </div>
          )}
        </div>
      </div>

      {/* Bill Detail Modal */}
      {showDetailModal && billDetail && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl">Bill Details</h2>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded p-2 hover:bg-bg-card transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Bill Header */}
              <div className="border-b border-border-theme pb-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-text-secondary text-xs mb-1">Bill ID</p>
                    <p className="font-mono font-bold text-gold text-sm">{String(billDetail.orderId).substring(0, 8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs mb-1">Table</p>
                    <p className="font-semibold text-sm">Table {billDetail.tableNumber}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs mb-1">Date</p>
                    <p className="text-sm">{new Date(billDetail.paidAt?.toDate?.() || billDetail.createdAt?.toDate?.() || new Date()).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs mb-1">Payment</p>
                    <p className="text-sm">{billDetail.paymentMethod || "Cash"}</p>
                  </div>
                </div>
              </div>

              {/* Items with Add Button */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Items</h3>
                  <button
                    type="button"
                    onClick={() => setShowMenuPicker(!showMenuPicker)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gold/20 text-gold hover:bg-gold/30 transition font-semibold"
                  >
                    <Plus size={14} />
                    Add Item
                  </button>
                </div>

                {/* Menu Picker */}
                {showMenuPicker && (
                  <div className="mb-4 p-3 rounded-lg bg-gold/5 border border-gold/20">
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="w-full mb-3 rounded border border-border-theme bg-bg-primary px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
                    />
                    {filteredMenuItems.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {filteredMenuItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleAddItemToBill(item)}
                            className="text-left p-2 rounded bg-bg-primary border border-border-theme hover:border-gold/50 hover:bg-bg-card transition text-xs"
                          >
                            <p className="font-semibold text-white truncate">{item.name}</p>
                            <p className="text-text-muted">₹{Number(item.price || 0).toFixed(0)}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-xs text-text-muted">No items found</p>
                    )}
                  </div>
                )}

                {/* Items List */}
                <div className="space-y-2 bg-bg-primary/30 rounded-lg p-3">
                  {(billDetail.items || []).length > 0 ? (
                    billDetail.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm border-b border-border-theme pb-2 last:border-0">
                        <span className="text-text-secondary">{item.quantity}x {item.name}</span>
                        <span className="text-gold font-semibold">₹{((item.total || item.price) * item.quantity).toFixed(0)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted text-center py-2">No items</p>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-border-theme pt-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span className="font-semibold">₹{billDetail.totalAmount?.toFixed(0) || 0}</span>
                </div>
                {billDetail.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">GST ({billDetail.gstPercent || 5}%)</span>
                    <span className="font-semibold">₹{billDetail.tax?.toFixed(0) || 0}</span>
                  </div>
                )}
                {billDetail.serviceCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Service</span>
                    <span className="font-semibold">₹{billDetail.serviceCharge?.toFixed(0) || 0}</span>
                  </div>
                )}
                {billDetail.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Discount</span>
                    <span className="text-red-400 font-semibold">-₹{billDetail.discount?.toFixed(0) || 0}</span>
                  </div>
                )}
                <div className="border-t border-border-theme pt-3 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-gold text-lg">₹{billDetail.finalAmount?.toFixed(0) || 0}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => handlePrintBill(billDetail, printSize)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gold py-2.5 text-sm font-semibold text-bg-primary hover:opacity-90 transition"
                >
                  <Printer size={16} />
                  Print
                </button>
                <button
                  type="button"                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-500/20 border border-red-500/50 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
                <button
                  type="button"                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 rounded-lg border border-border-theme py-2.5 text-sm font-semibold transition hover:bg-bg-card"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedBill && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="card w-full max-w-sm p-6"
          >
            <h3 className="font-display text-xl mb-2">Delete Bill?</h3>
            <p className="text-sm text-text-secondary mb-4">
              Are you sure you want to delete Bill #{selectedBill.id?.substring(0, 8).toUpperCase()} from Table {selectedBill.tableNumber}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-border-theme py-2.5 text-sm font-semibold transition hover:bg-bg-card disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBill}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-500/20 border border-red-500/50 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Bill"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AdminShell>
  );
}
