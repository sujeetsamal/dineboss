import { doc, updateDoc, getDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Generate a unique subdomain from restaurant name
 * @param {string} restaurantName - The restaurant name
 * @returns {string} - Slugified subdomain
 */
export function generateSubdomain(restaurantName) {
  return restaurantName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20) || 'restaurant';
}

/**
 * Check if subdomain is already taken
 * @param {string} subdomain - The subdomain to check
 * @returns {Promise<boolean>}
 */
export async function isSubdomainTaken(subdomain) {
  const subdomainQuery = query(
    collection(db, 'restaurants'),
    where('subdomain', '==', subdomain.toLowerCase())
  );
  const snapshot = await getDocs(subdomainQuery);
  return !snapshot.empty;
}

/**
 * Generate a unique subdomain with suffix if needed
 * @param {string} restaurantName - The restaurant name
 * @returns {Promise<string>} - Unique subdomain
 */
export async function getUniqueSubdomain(restaurantName) {
  let subdomain = generateSubdomain(restaurantName);
  let counter = 1;
  let taken = await isSubdomainTaken(subdomain);
  
  while (taken && counter < 1000) {
    subdomain = generateSubdomain(restaurantName) + counter;
    taken = await isSubdomainTaken(subdomain);
    counter++;
  }
  
  return subdomain;
}

/**
 * Check if custom domain is already taken
 * @param {string} customDomain - The custom domain to check
 * @param {string} excludeRestaurantId - Restaurant ID to exclude from check
 * @returns {Promise<boolean>}
 */
export async function isCustomDomainTaken(customDomain, excludeRestaurantId = null) {
  const domainQuery = query(
    collection(db, 'restaurants'),
    where('customDomain', '==', customDomain.toLowerCase())
  );
  const snapshot = await getDocs(domainQuery);
  
  if (snapshot.empty) return false;
  if (excludeRestaurantId) {
    return !snapshot.docs.every(doc => doc.id === excludeRestaurantId);
  }
  return true;
}

/**
 * Validate domain format
 * @param {string} domain - The domain to validate
 * @returns {boolean}
 */
export function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  // Also allow root domains like "example.com"
  const simpleDomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*[a-z0-9]$/i;
  
  return domainRegex.test(domain) || simpleDomainRegex.test(domain);
}

/**
 * Initialize domain fields for a restaurant during signup
 * @param {string} restaurantId - The restaurant ID
 * @param {string} restaurantName - The restaurant name
 * @returns {Promise<{subdomain: string}>}
 */
export async function initializeDomainFields(restaurantId, restaurantName) {
  const subdomain = await getUniqueSubdomain(restaurantName);
  
  await updateDoc(doc(db, 'restaurants', restaurantId), {
    subdomain,
    customDomain: null,
    domainVerified: false,
    domainsCreatedAt: serverTimestamp(),
  });
  
  return { subdomain };
}

/**
 * Update custom domain for restaurant
 * @param {string} restaurantId - The restaurant ID
 * @param {string} customDomain - The custom domain
 * @returns {Promise<void>}
 */
export async function updateCustomDomain(restaurantId, customDomain) {
  if (!isValidDomain(customDomain)) {
    throw new Error('Invalid domain format');
  }
  
  const isTaken = await isCustomDomainTaken(customDomain, restaurantId);
  if (isTaken) {
    throw new Error('Domain is already in use');
  }
  
  await updateDoc(doc(db, 'restaurants', restaurantId), {
    customDomain: customDomain.toLowerCase(),
    domainVerified: false,
    domainAddedAt: serverTimestamp(),
  });
}

/**
 * Mark domain as verified
 * @param {string} restaurantId - The restaurant ID
 * @returns {Promise<void>}
 */
export async function markDomainAsVerified(restaurantId) {
  await updateDoc(doc(db, 'restaurants', restaurantId), {
    domainVerified: true,
    domainVerifiedAt: serverTimestamp(),
  });
}

/**
 * Get restaurant by subdomain
 * @param {string} subdomain - The subdomain
 * @returns {Promise<Object|null>}
 */
export async function getRestaurantBySubdomain(subdomain) {
  const subdomainQuery = query(
    collection(db, 'restaurants'),
    where('subdomain', '==', subdomain.toLowerCase())
  );
  const snapshot = await getDocs(subdomainQuery);
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Get restaurant by custom domain
 * @param {string} customDomain - The custom domain
 * @returns {Promise<Object|null>}
 */
export async function getRestaurantByCustomDomain(customDomain) {
  const domainQuery = query(
    collection(db, 'restaurants'),
    where('customDomain', '==', customDomain.toLowerCase()),
    where('domainVerified', '==', true)
  );
  const snapshot = await getDocs(domainQuery);
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Get restaurant by either subdomain or custom domain
 * @param {string} host - The hostname (subdomain.dineboss.app or custom-domain.com)
 * @returns {Promise<Object|null>}
 */
export async function getRestaurantByHost(host) {
  // Check if it's a subdomain
  if (host.includes('.dineboss.app')) {
    const subdomain = host.split('.')[0];
    return getRestaurantBySubdomain(subdomain);
  }
  
  // Check if it's a custom domain
  return getRestaurantByCustomDomain(host);
}

/**
 * Get DNS instructions for a domain
 * @param {string} domain - The domain
 * @returns {Object} - DNS instructions
 */
export function getDNSInstructions(domain) {
  const isWildcard = domain.startsWith('www.');
  const baseInstructions = {
    domain,
    records: [],
  };
  
  if (isWildcard) {
    baseInstructions.records.push({
      type: 'CNAME',
      name: 'www',
      value: 'cname.vercel-dns.com',
      ttl: 3600,
    });
  } else {
    baseInstructions.records.push({
      type: 'A',
      name: '@',
      value: '76.76.21.21',
      ttl: 3600,
    });
    baseInstructions.records.push({
      type: 'CNAME',
      name: 'www',
      value: 'cname.vercel-dns.com',
      ttl: 3600,
    });
  }
  
  return baseInstructions;
}

/**
 * Extract hostname from request (strips port and localhost)
 * @param {string} host - The host header value
 * @returns {string}
 */
export function extractHostname(host) {
  if (!host) return '';
  
  // Remove port
  let hostname = host.split(':')[0];
  
  // Handle localhost development
  if (hostname === 'localhost') {
    return 'localhost';
  }
  
  return hostname.toLowerCase();
}
