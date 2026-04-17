import { NextResponse } from 'next/server';
import { extractHostname } from '@/lib/domains';

/**
 * Middleware for multi-tenant domain routing
 * 
 * CRITICAL DESIGN: This middleware does NOT make Firestore calls
 * Reasons:
 * - Firestore calls in middleware can fail with permission errors
 * - Middleware has limited context and different auth flow
 * - Restaurant page already handles all DB lookups
 * - This keeps middleware lightweight and fast
 * 
 * Instead, middleware:
 * 1. Extracts the hostname from the request
 * 2. Converts it to a slug (subdomain or custom domain)
 * 3. Rewrites to /restaurant/[slug] 
 * 4. Lets the page component do the actual DB lookup
 * 
 * Flow:
 * - abc.dineboss.app → /restaurant/abc (middleware rewrites)
 * - example.com → /restaurant/example.com (middleware rewrites)
 * - Page verifies it exists in Firestore
 * - localhost:3000 → direct to admin/public routes (no rewrite)
 */

export function middleware(request) {
  const host = request.headers.get('host');
  const pathname = request.nextUrl.pathname;
  
  console.log('\n[MIDDLEWARE] Incoming request:', {
    host,
    pathname,
    method: request.method,
    timestamp: new Date().toISOString(),
  });
  
  // Handle localhost - allow direct access to admin, login, etc.
  if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
    console.log('[MIDDLEWARE] Local environment - allowing direct access');
    return NextResponse.next();
  }

  const hostname = extractHostname(host);
  console.log('[MIDDLEWARE] Extracted hostname:', hostname);

  // Allow API routes and public assets
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/images') ||
    pathname.includes('.') // files with extensions
  ) {
    console.log('[MIDDLEWARE] Special route - allowing direct access');
    return NextResponse.next();
  }

  // Allow auth pages on any domain (signup, login)
  if (pathname.startsWith('/signup') || pathname.startsWith('/login')) {
    console.log('[MIDDLEWARE] Auth page - allowing direct access');
    return NextResponse.next();
  }

  // Allow admin routes on main domain (dineboss.app)
  if (hostname === 'dineboss.app' || hostname === 'www.dineboss.app') {
    console.log('[MIDDLEWARE] Main domain - allowing admin access');
    return NextResponse.next();
  }

  // Special handling: if already on /restaurant/[slug], don't redirect
  if (pathname.startsWith('/restaurant/')) {
    console.log('[MIDDLEWARE] Already on restaurant route - allowing direct access');
    return NextResponse.next();
  }

  // IMPORTANT: Do NOT make Firestore calls here
  // Only handle subdomains: abc.dineboss.app or abc.dineboss.vercel.app
  
  console.log('[MIDDLEWARE] Parsing hostname for subdomain:', hostname);
  
  let slug = null;
  
  // Extract subdomain from: [slug].dineboss.app or [slug].dineboss.vercel.app  
  if (hostname.includes('.dineboss.')) {
    slug = hostname.split('.dineboss.')[0].toLowerCase();
    console.log('[MIDDLEWARE] ✓ Detected subdomain - slug:', slug);
  } else {
    console.log('[MIDDLEWARE] ✗ No subdomain pattern found - platform domain:', hostname);
    return NextResponse.next();
  }
  
  if (!slug || slug === 'www') {
    console.log('[MIDDLEWARE] ✗ Invalid slug:', slug);
    return NextResponse.next();
  }
  
  const rewriteUrl = new URL(`/restaurant/${slug}${pathname === '/' ? '' : pathname}`, request.url);
  console.log('[MIDDLEWARE] Rewriting to:', `/restaurant/${slug}`);
  
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-restaurant-slug', slug);
  
  return NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  });
}

/**
 * Configure which routes the middleware should run on
 * 
 * Key points:
 * - Exclude _next, public, api
 * - Match all dynamic routes
 * - Handle both subdomain and custom domain patterns
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
