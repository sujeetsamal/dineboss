# DineBoss - Multi-Tenant Restaurant Order Management SaaS

A production-ready, secure, and scalable SaaS platform for restaurant order management built with Next.js 16 and Firebase.

## 🎯 Features

### Admin Dashboard
- **Real-time order management** - Live order board with status tracking
- **Menu management** - Create, edit, and manage menu items with categories
- **Table management** - Configure tables and track occupancy
- **Staff management** - Add and manage waiters and kitchen staff
- **Analytics** - Revenue tracking, order statistics, and customer insights
- **QR code generation** - Generate and download table-specific QR codes
- **Settings** - Restaurant configuration and preferences

### Waiter Interface
- **Table selection** - Quick table assignment
- **Order creation** - Browse menu by category and place orders
- **Cart management** - Add/remove items with real-time calculations
- **Order history** - Track order status in real-time

### Kitchen Screen
- **Live order queue** - Pending, preparing, and served orders
- **Real-time updates** - WebSocket-based order status sync
- **Order management** - Start cooking and mark orders as served

### Customer QR Page
- **Premium mobile UI** - Dark theme with gold accents
- **Menu browsing** - Category-based filtering
- **Order placement** - Direct ordering from table
- **Real-time order status** - Track order from placement to delivery

## 🔐 Security Features

- **Multi-tenant isolation** - Firestore security rules enforce data scoping
- **Role-based access control** - Owner, Manager, Waiter, Kitchen roles
- **Permission system** - Granular, flexible permission engine
- **Secure authentication** - Firebase Auth with email/password verification
- **Input validation** - All user inputs validated before processing
- **XSS protection** - Safe rendering of user-generated content

## 🏗️ Architecture

### Tech Stack
- **Frontend:** Next.js 16.2.3, React, TypeScript
- **Backend:** Firebase (Auth, Firestore)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **UI Components:** Lucide React icons, React Hot Toast notifications
- **Data Visualization:** Recharts for analytics

### Project Structure
```
dineboos/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard routes
│   ├── kitchen/           # Kitchen screen
│   ├── waiter/            # Waiter interface
│   ├── qr/                # Customer QR pages
│   ├── login/             # Authentication
│   └── signup/            # User registration
├── components/            # Reusable React components
├── hooks/                 # Custom React hooks
│   └── useCurrentUser.js  # Global user context
├── lib/                   # Utilities and helpers
│   ├── firebase.js        # Firebase initialization
│   ├── firestore.js       # Firestore helpers
│   ├── permissions.js     # Permission engine
│   └── useCurrentUserProfile.js  # Legacy (deprecated)
├── public/                # Static assets
└── firestore.rules        # Firestore security rules
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Firebase project with Firestore database
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd dineboos
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file with your Firebase credentials:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Deploy Firestore rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Run development server:**
   ```bash
   npm run dev
   ```

6. **Open browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔑 Authentication

### Test Credentials
- **Owner/Admin:** admin@restaurant.com / password123
- **Waiter:** waiter@restaurant.com / password123
- **Kitchen:** kitchen@restaurant.com / password123

### User Roles & Permissions

| Role | Menu | Staff | Analytics | Tables | Orders | Settings |
|------|------|-------|-----------|--------|--------|----------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Waiter | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Kitchen | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

## 📋 Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload

# Production
npm run build            # Build for production (Next.js Turbopack)
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier

# Database
firebase deploy          # Deploy Firestore rules and functions
firebase emulate firestore
```

## 🎨 Design System

### Color Palette
- **Primary (Gold):** #F59E0B
- **Dark Background:** #0D0A06
- **Card Background:** #161009
- **Border:** #2E1F0A
- **Text Primary:** #FFF5E4
- **Text Secondary:** #C4B89A

### Typography
- **Display Font:** Playfair Display (headings)
- **Body Font:** Inter (body text)

## 🔄 Real-Time Features

All real-time updates use Firestore onSnapshot listeners:
- Menu changes (kitchen sees updated items instantly)
- Order status updates (customers see order progress)
- Table availability (automatic occupancy sync)
- Staff presence (kitchen knows when waiters join)

## 🛠️ Core Concepts

### Permission Engine
Located in `/lib/permissions.js`, provides:
- `hasPermission(user, key)` - Check single permission
- `hasAllPermissions(user, keys)` - Check all permissions
- `hasAnyPermission(user, keys)` - Check any permission
- No hardcoded role checks in components

### Global User Hook
`/hooks/useCurrentUser.js` provides:
- User authentication state
- Role and permissions
- Restaurant ID (for multi-tenancy)
- Loading and error states

### Firestore Helpers
Centralized in `/lib/firestore.js`:
- User profile management
- Restaurant data operations
- Menu item CRUD
- Table management
- Order processing
- Real-time subscriptions

## 📱 Mobile Responsiveness

All pages are fully responsive:
- Mobile (320px+)
- Tablet (768px+)
- Desktop (1024px+)

## 🚨 Error Handling

- Try-catch blocks on all async operations
- User-friendly error messages with React Hot Toast
- Graceful fallbacks for missing data
- Connection error recovery

## 🔒 Security Best Practices

1. **Firestore Rules:** All reads/writes scoped by restaurantId
2. **Role Checks:** Permission engine prevents unauthorized access
3. **Input Validation:** Number/string validation on all inputs
4. **XSS Protection:** React auto-escapes user content
5. **CSRF Protection:** Firebase Auth handles tokens
6. **Rate Limiting:** Built into Firebase (production tier)

## 📊 Performance Optimizations

- **Code Splitting:** Automatic with Next.js
- **Image Optimization:** Next/Image component used
- **Caching:** Firestore caches frequently accessed data
- **useMemo:** Prevents unnecessary re-renders
- **useCallback:** Memoized event handlers
- **Turbopack:** Fast builds and HMR

## 🧪 Testing

Manual testing checklist:
- [ ] User signup and email verification
- [ ] Login with different roles (owner, manager, waiter, kitchen)
- [ ] Permission checks (each role sees only allowed pages)
- [ ] Order creation and real-time updates
- [ ] Menu management and availability toggling
- [ ] QR code generation and scanning
- [ ] Analytics calculations
- [ ] Mobile responsiveness

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Push to GitHub
git push origin main

# Connect GitHub repo to Vercel
# Set environment variables in Vercel dashboard
# Deploy button will trigger automatic deployment
```

### Firebase Hosting
```bash
firebase deploy
```

## 📚 Documentation Files

- `PRODUCTION_SYSTEM_UPGRADE.md` - Permission system implementation guide
- `ARCHITECTURE_FIXES_COMPLETE.md` - Core architecture fixes
- `PRODUCTION_AUDIT_REPORT.md` - Security and performance audit

## ⚠️ Known Limitations

1. No offline support (requires internet connection)
2. Payment processing not integrated (manual cash/card handled at table)
3. No customer loyalty/rewards program
4. Multi-language support not implemented
5. Backup/restore not automated in UI

## 🔄 Version History

**v1.0.0** (Production Release)
- Multi-tenant SaaS platform
- Role-based access control
- Real-time order management
- Premium QR customer page
- Security hardening
- Performance optimization

## 📞 Support

For issues or features requests, please create a GitHub issue.

## 📄 License

This project is private and proprietary to DineBoss.

---

## 🎯 Production Checklist

Before deploying to production:

- ✅ All security rules in place (`firestore.rules`)
- ✅ Environment variables configured
- ✅ Database backups enabled
- ✅ Error monitoring set up
- ✅ Performance monitored
- ✅ User roles tested
- ✅ QR code flow tested
- ✅ Real-time updates verified
- ✅ Mobile UI verified
- ✅ Analytics working

---

**Built with ❤️ for modern restaurants**
