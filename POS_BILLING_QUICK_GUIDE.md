# 🚀 POS Billing System - Quick Access Guide

## 📍 Where to Access

### **Admin Panel**
- **URL**: `http://localhost:3000/admin/pos-billing`
- **Sidebar**: Click "**POS Billing**" (CreditCard icon)
- **Access**: Admin role only
- **Permission**: Full control - pricing, payments, everything

### **Waiter Panel**
- **URL**: `http://localhost:3000/waiter/billing`
- **Mobile Nav**: Click "**Billing**" button (CreditCard icon)
- **Access**: Waiter/Staff role only
- **Permission**: View bills, mark paid/served, no pricing control

---

## 🎯 Admin POS Billing Workflow

### Step 1: View Active Orders
```
✓ Live orders display in left panel
✓ See: Table #, Item count, Total, Status, Time elapsed
✓ Use filters: All | Pending | Preparing | Served | Payment Pending | Completed
```

### Step 2: Select Order
```
✓ Click any order card
✓ Full bill details appear on right panel
✓ Shows: Items list, calculations, payment status
```

### Step 3: Adjust Bill (if needed)
```
✓ Modify GST % (default 5%)
✓ Add service charge % (optional)
✓ Apply manual discount amount
System automatically recalculates final total
```

### Step 4: Update Payment Status
```
✓ Green "✓ Mark Paid" button
✓ Yellow "💭 Mark Pending" button
Status updates in Firestore instantly
```

### Step 5: Update Order Status
```
Available buttons (depending on current status):
✓ 👨‍🍳 Start Preparing
✓ 🍽️ Served  
✓ ✓ Completed
Updates sync to kitchen & waiter instantly
```

### Step 6: Generate Bill
```
✓ Print: Opens print dialog
✓ PDF: Download as PDF (ready to implement)
✓ Share: Future feature
```

---

## 🧾 Waiter Billing Workflow

### Step 1: Navigate to Billing
```
From waiter home page → Click "Billing" (CreditCard icon, bottom nav)
OR direct URL: /waiter/billing
```

### Step 2: View All Active Orders
```
✓ Orders list shows all non-completed orders
✓ See: Table #, Item count, Status, Total, Payment status
```

### Step 3: Select Order to View Bill
```
✓ Click any order
✓ Full bill details shown in modal/sheet
✓ Shows items, calculations, payment status
NOTE: Cannot change pricing (read-only)
```

### Step 4: Show QR to Customer
```
✓ Click "Show Payment QR" button
✓ Display QR to customer on mobile
✓ Customer scans → pays via UPI/payment app
```

### Step 5: Mark as Paid
```
✓ After customer pays, click "✓ Mark Paid"
✓ Status updates in real-time
✓ Admin sees it paid in their panel
```

### Step 6: Update Order Status
```
✓ 🍽️ Served - when food is on table
✓ ✓ Completed - when customer finishes
Status updates sync everywhere
```

### Step 7: Print (if needed)
```
✓ Click "Print Bill" button
✓ Receipt prints to default printer
✓ Can print multiple times
```

---

## 💡 Features at a Glance

| Feature | Admin | Waiter |
|---------|-------|--------|
| View orders | ✅ | ✅ |
| View bill details | ✅ | ✅ |
| Edit GST | ✅ | ❌ |
| Edit discount | ✅ | ❌ |
| Edit service charge | ✅ | ❌ |
| Add payment method | ✅ | ✅ |
| Mark paid/pending | ✅ | ✅ |
| Update order status | ✅ | ✅ (limited) |
| Show QR code | ✅ | ✅ |
| Print bill | ✅ | ✅ |
| View history | ✅ | ✅ |

---

## 📊 Bill Calculation Example

```
Order at Table 5:
└── 2x Biryani @ ₹250 = ₹500
└── 1x Raita @ ₹50 = ₹50
└── 1x Lassi @ ₹40 = ₹40
                ──────────
Subtotal:                 ₹590

GST (5%):                 ₹29.50
Service (10%):            ₹59
Discount:                -₹50
                ──────────
Final Total:              ₹637.50
```

Settings from restaurant doc:
- GST: 5% (configurable)
- Service charge: 10% (configurable)
- Can adjust all from admin panel

---

## 🔐 Permissions

### Admin Access:
```
✅ Create/edit/delete orders
✅ Full billing control (pricing, discounts)
✅ Access all filters
✅ View all orders (active + completed)
✅ Manage payment QR
```

### Waiter Access:
```
✅ View active orders only
✅ View bill details (pricing locked)
✅ Mark paid/pending
✅ Update limited status (served/completed)
✅ Show QR to customers
❌ Cannot modify amounts
❌ Cannot delete orders
❌ Cannot change GST/discount
```

---

## 🎨 Color Coding

### Order Status Badges:
- 🟡 **Pending** - Yellow (waiting to prepare)
- 🔵 **Preparing** - Blue (in kitchen)
- 🟣 **Served** - Purple (on table)
- 🟢 **Completed** - Green (done)

### Payment Status:
- 🟢 **Paid** - Green badge
- 🔴 **Unpaid** - Red badge

### Bill Calculations:
- Gold color (₹): Amounts to add
- Red color: Discounts to subtract

---

## 📱 Mobile Experience

### Waiter (Small Screen):
- Full-width order list
- Click → modal billing view
- Easy thumb-tap buttons
- "Back" button to return to list
- Bottom navigation with Billing link

### Admin (Tablet):
- 2-column layout (left: orders, right: bill)
- Touch-friendly button sizes
- Responsive filters

### Admin (Desktop):
- Full 3-column layout
- All features visible
- Optimal spacing

---

## ⚙️ Configuration

### Change Default GST:
1. Go to Admin Settings (`/admin/settings`)
2. Update "Default GST Percent"
3. Applies to all future bills
4. Can override per-bill in POS

### Setup Payment QR:
1. Admin → Settings
2. Upload payment QR image
3. Saved to Firebase Storage
4. Shows in waiter panel automatically

### Customize Service Charge:
1. Settings → Default Service Charge
2. Can disable (set to 0)
3. Override per-bill if needed

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Orders not loading | Check Firestore rules (public read access) |
| Bill not saving | Ensure network connection, check Firestore quota |
| QR not showing | Upload QR image in settings first |
| Payment status stuck | Refresh page or check Firestore permissions |
| Can't modify bill | Check if waiter role (limited access) |
| Print not working | Ensure browser supports print, check printer connection |

---

## 🚨 Important Notes

⚠️ **Data Safety**:
- All calculations done safely (handles missing data)
- Firestore validation ensures data integrity
- No pricing data exposed to public

⚠️ **Real-Time**:
- Updates reflect immediately (Firestore listeners)
- Sync across admin, waiter, kitchen screens
- Changes visible to all users instantly

⚠️ **Mobile**:
- Fully responsive design
- Touch-friendly buttons
- Tested on common screen sizes

---

## 📞 Quick Links

- **Admin POS Billing**: `/admin/pos-billing`
- **Waiter Billing**: `/waiter/billing`
- **Admin Dashboard**: `/admin`
- **Settings**: `/admin/settings`
- **Documentation**: `POS_BILLING_COMPLETE.md`

---

## 🎓 Admin Quick Tips

1. **Filter by Payment Pending**: Quickly find unpaid orders
2. **Sort by Time**: Oldest orders appear first
3. **Real-time Updates**: No need to refresh
4. **Batch Print**: Print multiple bills sequentially
5. **Save Custom Settings**: GST/Service % memorized per restaurant

---

## 👨‍🍳 Waiter Quick Tips

1. **Bookmark Billing**: Quick access from mobile home screen
2. **Share QR Wisely**: Show only to paying customer
3. **Mark Complete**: Helps kitchen track finished orders
4. **Use Print**: Keep receipt for customer
5. **Check Status**: Verify payment before closing bill

---

**Last Updated**: April 16, 2026
**Status**: ✅ Ready to Use
