# DineBoss Multi-Tenant Custom Domain System

## Overview

This is a complete multi-tenant domain system for DineBoss that allows each restaurant to:

1. **Use a free subdomain** (e.g., `abc.dineboss.app`)
2. **Connect their own custom domain** (e.g., `example.com`)

The system automatically handles domain registration, routing, and verification.

---

## Architecture

### Core Components

#### 1. **Firestore Schema Updates**

Each restaurant document now includes:

```javascript
{
  name: string,
  subdomain: string,           // e.g., "abc"
  customDomain: string | null, // e.g., "example.com" (optional)
  domainVerified: boolean,     // true only if DNS is configured
  domainsCreatedAt: timestamp,
  domainAddedAt: timestamp,    // when custom domain was added
  domainVerifiedAt: timestamp, // when domain became verified
  ...other fields
}
```

#### 2. **Database Functions** (`lib/domains.js`)

Core utilities for domain management:

- `generateSubdomain(restaurantName)` - Create slug from name
- `getUniqueSubdomain(restaurantName)` - Auto-generate unique subdomain
- `isSubdomainTaken(subdomain)` - Check if subdomain exists
- `isCustomDomainTaken(domain, excludeId)` - Check if custom domain exists
- `isValidDomain(domain)` - Validate domain format
- `initializeDomainFields(restaurantId, restaurantName)` - Setup during signup
- `updateCustomDomain(restaurantId, domain)` - Add custom domain
- `markDomainAsVerified(restaurantId)` - Mark verified after DNS setup
- `getRestaurantBySubdomain(subdomain)` - Lookup by free subdomain
- `getRestaurantByCustomDomain(domain)` - Lookup by custom domain
- `getRestaurantByHost(hostname)` - Universal lookup (either type)
- `getDNSInstructions(domain)` - Get DNS setup instructions
- `extractHostname(host)` - Parse hostname from request

#### 3. **Vercel API Integration** (`lib/vercel-api.js`)

Communicates with Vercel to register and verify domains:

- `addDomainToProject(domain)` - Register domain with Vercel
- `removeDomainFromProject(domain)` - Unregister domain
- `getDomainFromVercel(domain)` - Check domain status
- `isDomainVerified(domain)` - Check if DNS is working
- `listProjectDomains()` - List all project domains
- `updateDomainConfig(domain, config)` - Update domain settings

#### 4. **API Routes**

##### `POST /api/domains/add`

Add a custom domain to a restaurant.

Request:
```json
{
  "domain": "example.com",
  "restaurantId": "resto123"
}
```

Response:
```json
{
  "success": true,
  "domain": "example.com",
  "subdomain": "abc",
  "dnsInstructions": {
    "domain": "example.com",
    "records": [
      {
        "type": "A",
        "name": "@",
        "value": "76.76.21.21",
        "ttl": 3600
      },
      {
        "type": "CNAME",
        "name": "www",
        "value": "cname.vercel-dns.com",
        "ttl": 3600
      }
    ]
  },
  "message": "Domain added successfully. Please update your DNS records."
}
```

##### `POST /api/domains/verify`

Verify a domain after DNS configuration.

Request:
```json
{
  "restaurantId": "resto123"
}
```

Response:
```json
{
  "success": true,
  "domain": "example.com",
  "verified": true,
  "message": "Domain verified successfully!"
}
```

##### `GET /api/domains/dns?restaurantId=...`

Get DNS instructions for a restaurant.

Response:
```json
{
  "success": true,
  "domain": "example.com",
  "subdomain": "abc",
  "dnsInstructions": {...},
  "isVerified": false
}
```

##### `GET /api/restaurants/[id]`

Get public restaurant data.

Response:
```json
{
  "id": "resto123",
  "name": "My Restaurant",
  "subdomain": "abc",
  "customDomain": "example.com",
  "domainVerified": true,
  "theme": "light",
  "acceptingOrders": true
}
```

#### 5. **Middleware** (`middleware.js`)

The critical routing layer that:

1. Extracts hostname from request
2. Determines if it's a free subdomain or custom domain
3. Looks up restaurant in Firestore
4. Rewrites request to `/restaurant/[slug]` route
5. Attaches restaurant context via headers

Flow:
```
abc.dineboss.app → middleware → getRestaurantByHost("abc.dineboss.app")
                              → restaurant found
                              → rewrite to /restaurant/abc
                              → attach headers: x-restaurant-id, x-restaurant-slug

example.com → middleware → getRestaurantByHost("example.com")
                        → restaurant found (if verified)
                        → rewrite to /restaurant/example.com
                        → attach headers: x-restaurant-id, x-restaurant-slug
```

#### 6. **Dynamic Restaurant Route** (`app/restaurant/[slug]/page.js`)

Serves the restaurant's public menu page.

- Accepts both free subdomains and custom domains
- Resolves restaurant by slug
- Verifies domain status
- Returns PublicMenuPage component

#### 7. **Frontend Components**

##### `DomainSettings` Component (`components/DomainSettings.jsx`)

Admin UI for domain management with:

- **Free Subdomain Display**
  - Shows `abc.dineboss.app`
  - Copy button
  - Instant access

- **Custom Domain Section**
  - Domain input field
  - Verification status
  - DNS setup instructions
  - One-click verify button

- **DNS Instructions Modal**
  - Displays A/CNAME records
  - Copy buttons for easy setup
  - TTL information

##### `PublicMenuPage` Component (`components/PublicMenuPage.jsx`)

Public-facing restaurant menu page that:

- Displays restaurant info
- Shows menu items
- Handles orders (extensible)
- Works on both subdomain and custom domain

#### 8. **Signup Integration**

When a restaurant signs up (`app/signup/page.js`):

1. Firebase account created
2. Restaurant document created
3. `initializeDomainFields()` called
4. Unique subdomain auto-assigned
5. Ready to use instantly

---

## Setup Instructions

### 1. Environment Variables

Create `.env.local`:

```env
VERCEL_TOKEN=<your-vercel-token>
VERCEL_PROJECT_ID=<your-project-id>
NEXT_PUBLIC_MAIN_DOMAIN=dineboss.app
NEXT_PUBLIC_MAIN_URL=https://dineboss.app
DEBUG_DOMAIN_ROUTING=false
```

**Getting Vercel credentials:**

1. Go to https://vercel.com/account/tokens
2. Create new token (recommended: add to `.env.local` only)
3. Go to Project Settings → General → Project ID

### 2. Vercel Configuration

**Add custom domains to Vercel project:**

1. Go to Vercel Dashboard
2. Select DineBoss project
3. Settings → Domains
4. Add main domain: `dineboss.app`
5. Add wildcard subdomain: `*.dineboss.app`

OR use the API (automatic via `/api/domains/add`):

```bash
curl -X POST https://api.vercel.com/v9/projects/{PROJECT_ID}/domains \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -d '{"name": "example.com"}'
```

### 3. Firestore Security Rules

```javascript
match /restaurants/{restaurantId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == resource.data.ownerId;
  
  // Public read for domain routing
  allow read: if true;
}
```

### 4. Database Migration (if needed)

For existing restaurants, run one-time migration:

```javascript
// Initialize domains for all existing restaurants
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { getUniqueSubdomain } from "@/lib/domains";

async function migrateRestaurants() {
  const restaurantsRef = collection(db, "restaurants");
  const snapshot = await getDocs(restaurantsRef);
  
  for (const restaurantDoc of snapshot.docs) {
    if (!restaurantDoc.data().subdomain) {
      const subdomain = await getUniqueSubdomain(restaurantDoc.data().name);
      await updateDoc(doc(db, "restaurants", restaurantDoc.id), {
        subdomain,
        customDomain: null,
        domainVerified: false,
      });
    }
  }
}
```

---

## Usage Flow

### For Customers

1. **Free Subdomain (Instant)**
   ```
   Visit: https://myrestaurant.dineboss.app
   → Accessible immediately after signup
   → Share with QR code, etc.
   ```

2. **Custom Domain (After Setup)**
   ```
   Admin adds domain in Settings → Domain & Multi-Tenant Access
   → Configure DNS records (shown in UI)
   → Wait 24-48 hours for DNS propagation
   → Click "Verify Domain"
   → Visit: https://myrestaurant.com
   ```

### For Admin

**Setting up custom domain:**

1. Go to Admin Dashboard → Settings
2. Scroll to "Domain & Multi-Tenant Access"
3. Enter custom domain: `example.com`
4. Click "Connect Custom Domain"
5. System shows DNS records needed
6. Admin configures DNS at registrar:
   - Add A record: `@` → `76.76.21.21`
   - Add CNAME record: `www` → `cname.vercel-dns.com`
7. Return and click "Verify Domain"
8. Once verified, domain is live

---

## Domain Routing Logic

### Request Flow

```
1. User visits: example.com
   ↓
2. Middleware extracts hostname: "example.com"
   ↓
3. Middleware calls getRestaurantByHost("example.com")
   ↓
4a. If subdomain pattern (*.dineboss.app):
    - Extract subdomain: "abc"
    - Query: { subdomain: "abc" }
    - Return restaurant
   
4b. If custom domain:
    - Query: { customDomain: "example.com", domainVerified: true }
    - Return restaurant (only if verified)
   
4c. If not found:
    - Rewrite to /error/restaurant-not-found
   ↓
5. If found, rewrite to: /restaurant/[slug]
   ↓
6. Route receives restaurant context
7. Page renders public menu
```

### Request Headers (added by middleware)

```
x-restaurant-id: resto123
x-restaurant-slug: abc
```

These can be accessed in Server Components via `request.headers`.

---

## DNS Setup Guide

### For A Record (Root Domain)

**If connecting `example.com` (not www):**

| Field | Value |
|-------|-------|
| Type | A |
| Name | @ (or leave blank) |
| Value | 76.76.21.21 |
| TTL | 3600 |

### For CNAME Record (www subdomain)

**Both cases need this:**

| Field | Value |
|-------|-------|
| Type | CNAME |
| Name | www |
| Value | cname.vercel-dns.com |
| TTL | 3600 |

### Common Registrars

- **GoDaddy**: DNS Menu → Manage DNS
- **Namecheap**: Advanced DNS Tab
- **Bluehost**: Zone Editor
- **AWS Route 53**: Hosted Zones → Create Record
- **Cloudflare**: DNS App

### Verification

```bash
# Check A record
nslookup example.com

# Check CNAME record
nslookup www.example.com

# Check all records
dig example.com +short
dig www.example.com +short
```

---

## Security Considerations

### 1. Admin-Only Domain Management

Only admins can:
- Add custom domains
- Verify domains
- Remove domains

```javascript
// In API route
const user = await getUserProfile(userId);
if (user.role !== 'admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### 2. Domain Ownership Verification

- System uses Vercel's DNS verification
- Requires actual DNS control
- Custom domain only active after `domainVerified = true`
- Prevents unauthorized domain hijacking

### 3. Preventing Domain Spoofing

```javascript
// Only verified custom domains are accessible
const verified = restaurant.domainVerified === true;
if (restaurant.customDomain && !verified) {
  return notFound();
}
```

### 4. Data Isolation

Each restaurant sees only their own:
- Menu items
- Orders
- Settings
- Domain configuration

Middleware strips unauthorized paths automatically.

---

## Performance Optimization

### 1. ISR (Incremental Static Regeneration)

```javascript
// app/restaurant/[slug]/page.js
export const revalidate = 60;  // Revalidate every 60 seconds
```

### 2. Firestore Query Optimization

```javascript
// Index hint for domain lookups
// subdomain + customDomain queries use indexes

// Firestore automatically creates:
// - Index for { subdomain }
// - Index for { customDomain, domainVerified }
```

### 3. Middleware Performance

- Runs on CDN edge
- Minimal Firestore queries
- Cached restaurant lookups (consider Redis in future)

---

## Troubleshooting

### Custom Domain Not Working

**Symptoms:** 404 or "Restaurant not found"

**Solutions:**
1. Check DNS records use correct values
2. Wait 24-48 hours for DNS propagation
3. Click "Verify Domain" button
4. Check Vercel project settings for domain
5. Verify `domainVerified: true` in Firestore

### Subdomain Not Accessible

**Symptoms:** "Restaurant not found" on abc.dineboss.app

**Solutions:**
1. Check `subdomain` field in Firestore
2. Verify Vercel wildcard domain: `*.dineboss.app`
3. Check middleware routing logic
4. Enable `DEBUG_DOMAIN_ROUTING=true`

### Domain Verification Fails

**Symptoms:** Verification button returns error

**Solutions:**
1. DNS records may not be fully propagated
2. Try again in 24-48 hours
3. Check DNS records on registrar
4. Verify VERCEL_TOKEN is valid
5. Check Vercel project ID

### Permission Errors on Domain API

**Symptoms:** 403 Unauthorized

**Solutions:**
1. Add admin role check in API route
2. Verify restaurantId ownership
3. Check Firebase authentication

---

## Future Enhancements

### Phase 2
- [ ] Domain redirect chains (multiple domains → one restaurant)
- [ ] SSL certificate auto-renewal
- [ ] Domain transfer/migration tool
- [ ] Bulk domain operations
- [ ] Domain analytics

### Phase 3
- [ ] Redis caching for restaurant lookups
- [ ] Failover domain system
- [ ] White-label support
- [ ] Multi-language domain support (IDN)
- [ ] Subdomain marketplace

---

## API Reference

### Domain Functions

**`initializeDomainFields(restaurantId, restaurantName)`**
- Called during signup
- Auto-generates unique subdomain
- Returns: `{ subdomain: string }`

**`updateCustomDomain(restaurantId, domain)`**
- Validates domain format
- Checks for duplicates
- Updates Firestore
- Throws: Domain validation errors

**`getRestaurantByHost(hostname)`**
- Universal lookup function
- Supports both subdomain and custom domain
- Returns: `Restaurant | null`

**`getDNSInstructions(domain)`**
- Returns: DNS records to configure
- Format: `{ domain, records: [ { type, name, value, ttl } ] }`

### Middleware

**Routing Priority:**
1. localhost → pass through
2. API routes → pass through
3. Static assets → pass through
4. Auth pages → pass through
5. Main domain → pass through
6. Restaurant domain → rewrite to `/restaurant/[slug]`
7. Not found → `/error/restaurant-not-found`

### Firestore Indexes

Required indexes:
```
Collection: restaurants
- Field: subdomain (Ascending)
- Field: customDomain (Ascending)
- Field: domainVerified (Ascending)
```

---

## Configuration Files

### Environment Variables (.env.local)

```env
# Vercel Integration
VERCEL_TOKEN=your_token_here
VERCEL_PROJECT_ID=your_project_id

# Public URLs
NEXT_PUBLIC_MAIN_DOMAIN=dineboss.app
NEXT_PUBLIC_MAIN_URL=https://dineboss.app

# Debugging
DEBUG_DOMAIN_ROUTING=false
```

### Next.js Config (next.config.mjs)

- Multi-domain support enabled
- Security headers configured
- Image optimization for remote sources
- Middleware configured

### Firestore Rules (firestore.rules)

```javascript
match /restaurants/{restaurantId} {
  allow read: if true;  // Public read for domain routing
  allow write: if request.auth.uid == resource.data.ownerId;
}
```

---

## Support

For issues or questions:
- Check Firestore documents for `subdomain` and `customDomain` fields
- Verify Vercel token and project ID
- Check browser console for errors
- Enable debug logging with `DEBUG_DOMAIN_ROUTING=true`
- Check Vercel dashboard for domain status

---

## Summary

This multi-tenant system provides:

✅ Instant free subdomains for all restaurants
✅ Custom domain support via Vercel
✅ Automatic DNS verification
✅ Secure domain routing via middleware
✅ Admin-friendly domain management UI
✅ Zero manual setup for customers
✅ Scalable to thousands of restaurants
