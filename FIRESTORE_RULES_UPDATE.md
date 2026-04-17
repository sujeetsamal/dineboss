# Firestore Rules Update Guide

## Location
File: `firestore.rules`

## Change Required

Find this section (around line 85-90):

```javascript
// *** NESTED: BILLING (STAFF ONLY) ***
match /bills/{billId} {
  allow read, write: if isStaff(restaurantId);
}
```

Replace with:

```javascript
// *** NESTED: BILLING (STAFF READ/CREATE, ADMIN DELETE) ***
match /bills/{billId} {
  allow read: if isStaff(restaurantId);
  allow create, update: if isStaff(restaurantId);
  allow delete: if isAdmin(restaurantId);  // Only admin can delete bills
}
```

## What This Does

- **Staff can**: Read bills, Create bills, Update bills
- **Admin can**: Do everything above + DELETE bills
- **Everyone else**: Cannot access bills

## Why This Matters

The `deleteBill()` function in `firestore.js` requires:
1. The bills collection to allow delete operations
2. Permission check in rules to restrict to admin only
3. This prevents accidental/malicious bill deletion

## How to Apply

### Option 1: Manual Edit
1. Open `firestore.rules` in VS Code
2. Find the "BILLING" section (Ctrl+F search for "NESTED: BILLING")
3. Replace the `match /bills/{billId}` block with the new code above
4. Save the file

### Option 2: Deploy Updated Rules
1. In Firebase Console
2. Go to Firestore → Rules
3. Replace the entire rules file content with the updated version
4. Click "Publish"

## Testing the Change

After updating rules, verify:
1. Admin can delete bills ✓
2. Waiter cannot delete bills
3. Orders still work normally
4. Menu can be edited by admin
5. Customers can create orders (no auth needed)

## Rollback

If issues occur, revert to:
```javascript
allow read, write: if isStaff(restaurantId);
```

---

**Note**: This is a security-critical change. Test thoroughly in staging before production.
