'use client';

import { useEffect, useState } from 'react';
import { X, Printer, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { createBillFromOrder } from '@/lib/firestore';

export default function BillModal({
  isOpen,
  onClose,
  order,
  restaurantId,
  userId,
  readOnly = false
}) {
  const [bill, setBill] = useState(null);
  const [isEditing, setIsEditing] = useState(!readOnly);
  const [isSaving, setIsSaving] = useState(false);
  const [restaurantDetails, setRestaurantDetails] = useState(null);

  // Load restaurant details
  useEffect(() => {
    if (!isOpen || !restaurantId) return;
    const loadRestaurant = async () => {
      try {
        const docRef = doc(db, 'restaurants', restaurantId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRestaurantDetails(docSnap.data());
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
      }
    };
    loadRestaurant();
  }, [isOpen, restaurantId]);

  // Initialize bill from order
  useEffect(() => {
    if (!isOpen || !order || !restaurantDetails) return;

    const initBill = async () => {
      try {
        // Calculate amounts
        const items = order.items || [];
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const gstPercent = restaurantDetails.defaultGstPercent || 5;
        const gstAmount = Math.round(subtotal * (gstPercent / 100));
        const total = subtotal + gstAmount;

        setBill({
          billNumber: order.billId || 'Generated on save',
          orderIds: [order.id],
          tableNumber: order.tableNumber,
          waiterName: order.waiterName || 'N/A',
          items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            amount: item.price * item.quantity
          })),
          subtotal,
          gstPercent,
          gstAmount,
          discountAmount: 0,
          total,
          paymentMethod: order.paymentMethod || 'cash',
          paymentStatus: order.paymentStatus || 'unpaid',
          notes: restaurantDetails.billFooterMessage || 'Thank you for dining with us!',
          createdAt: new Date(),
        });
      } catch (err) {
        console.error('Failed to initialize bill:', err);
        toast.error('Failed to load bill details');
      }
    };

    initBill();
  }, [isOpen, order, restaurantDetails, restaurantId]);

  const handleItemEdit = (index, field, value) => {
    const newItems = [...bill.items];
    newItems[index] = { ...newItems[index], [field]: field === 'price' || field === 'quantity' ? parseFloat(value) : value };
    if (field === 'price' || field === 'quantity') {
      newItems[index].amount = newItems[index].price * newItems[index].quantity;
    }
    const subtotal = newItems.reduce((sum, item) => sum + item.amount, 0);
    const gstAmount = Math.round(subtotal * (bill.gstPercent / 100));
    const total = subtotal + gstAmount - bill.discountAmount;
    
    setBill({ ...bill, items: newItems, subtotal, gstAmount, total });
  };

  const handleDiscountChange = (value) => {
    const discountAmount = parseFloat(value) || 0;
    const total = bill.subtotal + bill.gstAmount - discountAmount;
    setBill({ ...bill, discountAmount, total });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveBill = async () => {
    if (!restaurantId || !bill) return;
    setIsSaving(true);
    try {
      const billRecord = await createBillFromOrder(restaurantId, order.id, {
        ...order,
        orderIds: bill.orderIds,
        tableNumber: bill.tableNumber,
        waiterName: bill.waiterName,
        items: (bill.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount: bill.subtotal,
        gstPercent: bill.gstPercent,
        tax: bill.gstAmount,
        discount: bill.discountAmount,
        finalAmount: bill.total,
        paymentMethod: bill.paymentMethod,
        paymentStatus: bill.paymentStatus,
        notes: bill.notes,
        createdBy: order.createdBy || userId,
        createdByName: order.createdByName || null,
        lastUpdatedBy: userId,
        lastUpdatedByName: order.lastUpdatedByName || null,
      }, { uid: userId, name: order.lastUpdatedByName || order.createdByName || 'Admin' });

      // Update order with billId
      if (order?.id) {
        const orderDocRef = doc(db, 'orders', restaurantId, 'orders', order.id);
        await updateDoc(orderDocRef, {
          billId: billRecord.billId,
          billDocId: billRecord.id,
          status: 'completed',
          paymentStatus: bill.paymentStatus || 'unpaid',
          updatedAt: serverTimestamp(),
        });
      }

      toast.success('Bill generated successfully');
      onClose();
    } catch (err) {
      console.error('Failed to save bill:', err);
      toast.error('Failed to generate bill');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!restaurantId || !order?.id || !bill) return;
    setIsSaving(true);
    try {
      const orderDocRef = doc(db, 'orders', restaurantId, 'orders', order.id);
      await updateDoc(orderDocRef, {
        paymentStatus: 'paid',
        updatedAt: serverTimestamp(),
      });
      setBill((prev) => ({
        ...prev,
        paymentStatus: 'paid',
      }));
      toast.success('Payment marked as paid');
    } catch (err) {
      console.error('Failed to mark payment as paid:', err);
      toast.error('Failed to update payment status');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !bill) return null;

  const getStatusBadge = (status) => {
    const badges = {
      unpaid: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      preparing: 'bg-blue-100 text-blue-800',
      served: 'bg-green-100 text-green-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4 backdrop-blur-sm">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 flex justify-between items-center px-6 py-4 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">Invoice</h2>
          <div className="flex gap-2">
            {!readOnly && (
              <button 
                onClick={() => setIsEditing(!isEditing)} 
                className="text-xs font-semibold px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
              >
                {isEditing ? '✓ Save' : '✎ Edit'}
              </button>
            )}
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-700 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Bill Content */}
        {bill ? (
          <div id="bill-print-area" className="p-6 bg-white space-y-4">
          
          {/* Restaurant Header */}
          <div className="text-center">
            {restaurantDetails?.showLogoOnBill && restaurantDetails?.logoUrl && (
              <img 
                src={restaurantDetails.logoUrl} 
                alt="Restaurant logo" 
                className="h-14 w-14 mx-auto object-cover rounded-lg mb-3" 
              />
            )}
            <h3 className="text-xl font-bold text-gray-900">{restaurantDetails?.name || 'Restaurant'}</h3>
            {restaurantDetails?.addressLine1 && (
              <p className="text-xs text-gray-600 mt-1">{restaurantDetails.addressLine1}</p>
            )}
            {restaurantDetails?.phone && (
              <p className="text-xs text-gray-600">{restaurantDetails.phone}</p>
            )}
          </div>

          <div className="h-px bg-gray-300"></div>

          {/* Bill Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bill No</p>
              <p className="text-base font-bold text-gray-900">{bill.billNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date & Time</p>
              <p className="text-sm font-semibold text-gray-900">
                {bill.createdAt.toLocaleDateString()} <br className="hidden md:block" />
                {bill.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Table</p>
              <p className="text-base font-bold text-gray-900">{bill.tableNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Waiter</p>
              <p className="text-sm font-semibold text-gray-900">{bill.waiterName}</p>
            </div>
          </div>

          <div className="h-px bg-gray-300"></div>

          {/* Items Section */}
          <div className="space-y-3">
            {/* Header */}
            <div className="flex justify-between text-xs font-bold text-gray-600 uppercase tracking-wide px-1">
              <span>Item</span>
              <div className="flex gap-4">
                <span className="w-8 text-right">Qty</span>
                <span className="w-16 text-right">Price</span>
              </div>
            </div>

            {/* Items */}
            {bill?.items?.map((item, i) => (
              <div key={i} className="border-b border-gray-100 pb-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemEdit(i, 'name', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-sm font-semibold focus:border-amber-500 outline-none transition"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemEdit(i, 'quantity', e.target.value)}
                        className="px-3 py-2 border-2 border-amber-300 rounded-lg text-sm focus:border-amber-500 outline-none transition"
                        step="0.5"
                        placeholder="Qty"
                      />
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemEdit(i, 'price', e.target.value)}
                        className="px-3 py-2 border-2 border-amber-300 rounded-lg text-sm focus:border-amber-500 outline-none transition"
                        placeholder="Price"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-900 flex-1">{item.name}</span>
                    <div className="flex gap-4 items-center">
                      <span className="text-sm text-gray-600 w-8 text-right">{item.quantity}</span>
                      <span className="text-sm font-bold text-gray-900 w-16 text-right">₹{item.amount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="h-px bg-gray-300"></div>

          {/* Totals Section */}
          <div className="space-y-3 text-sm">
            {/* Subtotal */}
            <div className="flex justify-between">
              <p className="text-gray-600 font-medium">Subtotal</p>
              <p className="text-gray-900 font-semibold">₹{bill.subtotal.toFixed(2)}</p>
            </div>

            {/* GST */}
            {bill.gstPercent > 0 && (
              <div className="flex justify-between">
                <p className="text-gray-600 font-medium">GST ({bill.gstPercent}%)</p>
                <p className="text-gray-900 font-semibold">₹{bill.gstAmount.toFixed(2)}</p>
              </div>
            )}

            {/* Discount Section */}
            {bill.discountAmount > 0 && (
              <div className="flex justify-between">
                <p className="text-gray-600 font-medium">Discount</p>
                <p className="text-red-600 font-semibold">-₹{bill.discountAmount.toFixed(2)}</p>
              </div>
            )}

            {isEditing && (
              <div className="flex gap-2 items-center bg-blue-50 p-3 rounded-lg">
                <label className="text-gray-700 font-semibold text-sm">Discount:</label>
                <input
                  type="number"
                  value={bill.discountAmount}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  className="flex-1 px-3 py-1.5 border-2 border-blue-400 rounded-lg text-sm focus:border-blue-600 outline-none transition"
                  min="0"
                  placeholder="₹0"
                />
              </div>
            )}

            <div className="h-px bg-gray-300"></div>

            {/* Total */}
            <div className="flex justify-between bg-green-50 p-3 rounded-lg">
              <p className="text-lg font-bold text-gray-900">TOTAL</p>
              <p className="text-lg font-bold text-green-700">₹{bill.total.toFixed(2)}</p>
            </div>
          </div>

          <div className="h-px bg-gray-300"></div>

          {/* Payment & Status */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment</p>
              {isEditing ? (
                <select
                  value={bill.paymentMethod}
                  onChange={(e) => setBill({ ...bill, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-sm font-semibold focus:border-amber-500 outline-none transition"
                >
                  <option value="cash">💵 Cash</option>
                  <option value="card">💳 Card</option>
                  <option value="upi">📱 UPI</option>
                </select>
              ) : (
                <div className="inline-block px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full font-semibold text-xs">
                  {bill.paymentMethod === 'cash' && '💵 ' }
                  {bill.paymentMethod === 'card' && '💳 ' }
                  {bill.paymentMethod === 'upi' && '📱 ' }
                  {bill.paymentMethod.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</p>
              <span className={`inline-block px-3 py-1.5 rounded-full font-semibold text-xs ${getStatusBadge(bill.paymentStatus)}`}>
                {String(bill.paymentStatus || 'unpaid').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Footer Message */}
          {!isEditing ? (
            <div className="text-center text-xs text-gray-600 italic p-3 bg-gray-50 rounded-lg">
              {bill.notes}
            </div>
          ) : (
            <textarea
              value={bill.notes}
              onChange={(e) => setBill({ ...bill, notes: e.target.value })}
              className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-xs focus:border-amber-500 outline-none transition"
              rows="2"
              placeholder="Add a message..."
            />
          )}

          {restaurantDetails?.gstNumber && (
            <p className="text-xs text-gray-500 text-center">GST: {restaurantDetails.gstNumber}</p>
          )}

        {/* Action Buttons */}
        {!readOnly && (
          <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 p-4 flex gap-3 rounded-b-2xl no-print">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
            >
              <Printer size={18} /> Print
            </button>
            <button
              onClick={handleMarkPaid}
              disabled={isSaving || bill.paymentStatus === 'paid'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
            >
              {bill.paymentStatus === 'paid' ? 'Paid' : 'Mark as Paid'}
            </button>
            <button
              onClick={handleSaveBill}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
            >
              <Save size={18} /> {isSaving ? 'Saving...' : 'Generate Bill'}
            </button>
          </div>
        )}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            <p>Loading bill details...</p>
          </div>
        )}
      </div>
    </div>
  );
}
