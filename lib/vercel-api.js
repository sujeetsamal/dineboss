/**
 * Vercel API utilities for domain management
 * Requires: VERCEL_TOKEN and VERCEL_PROJECT_ID env variables
 */

const VERCEL_BASE_URL = 'https://api.vercel.com';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

export class VercelDomainError extends Error {
  constructor(message, statusCode, vercelError) {
    super(message);
    this.name = 'VercelDomainError';
    this.statusCode = statusCode;
    this.vercelError = vercelError;
  }
}

/**
 * Call Vercel API
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} body - Request body
 * @returns {Promise<Object>}
 */
async function callVercelAPI(method, endpoint, body = null) {
  if (!VERCEL_TOKEN) {
    throw new VercelDomainError(
      'VERCEL_TOKEN not configured',
      500,
      'Missing environment variable'
    );
  }

  const url = `${VERCEL_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new VercelDomainError(
        data.error?.message || `Vercel API error: ${response.statusText}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof VercelDomainError) throw error;
    throw new VercelDomainError(
      `Failed to call Vercel API: ${error.message}`,
      500,
      error
    );
  }
}

/**
 * Add a domain to the Vercel project
 * @param {string} domain - The domain to add
 * @returns {Promise<Object>} - Domain object from Vercel
 */
export async function addDomainToProject(domain) {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError(
      'VERCEL_PROJECT_ID not configured',
      500,
      'Missing environment variable'
    );
  }

  return callVercelAPI('POST', `/v9/projects/${VERCEL_PROJECT_ID}/domains`, {
    name: domain,
  });
}

/**
 * Remove a domain from the Vercel project
 * @param {string} domain - The domain to remove
 * @returns {Promise<void>}
 */
export async function removeDomainFromProject(domain) {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError(
      'VERCEL_PROJECT_ID not configured',
      500,
      'Missing environment variable'
    );
  }

  return callVercelAPI('DELETE', `/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`);
}

/**
 * Get domain details from Vercel
 * @param {string} domain - The domain to check
 * @returns {Promise<Object>} - Domain object
 */
export async function getDomainFromVercel(domain) {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError(
      'VERCEL_PROJECT_ID not configured',
      500,
      'Missing environment variable'
    );
  }

  return callVercelAPI('GET', `/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`);
}

/**
 * Check if domain is verified/ready in Vercel
 * @param {string} domain - The domain to check
 * @returns {Promise<boolean>}
 */
export async function isDomainVerified(domain) {
  try {
    const domainInfo = await getDomainFromVercel(domain);
    return domainInfo.verified === true;
  } catch (error) {
    if (error instanceof VercelDomainError && error.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get all domains for the project
 * @returns {Promise<Array>}
 */
export async function listProjectDomains() {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError(
      'VERCEL_PROJECT_ID not configured',
      500,
      'Missing environment variable'
    );
  }

  const response = await callVercelAPI('GET', `/v9/projects/${VERCEL_PROJECT_ID}/domains`);
  return response.domains || [];
}

/**
 * Update domain configuration
 * @param {string} domain - The domain
 * @param {Object} config - Configuration updates (e.g., { redirect: 'https://example.com' })
 * @returns {Promise<Object>}
 */
export async function updateDomainConfig(domain, config) {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError(
      'VERCEL_PROJECT_ID not configured',
      500,
      'Missing environment variable'
    );
  }

  return callVercelAPI('PATCH', `/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`, config);
}

/**
 * Get DNS records needed for domain setup
 * @param {string} domain - The domain
 * @returns {Promise<Object>} - DNS records configuration
 */
export async function getDNSRecords(domain) {
  try {
    const domainInfo = await getDomainFromVercel(domain);
    return {
      domain,
      verified: domainInfo.verified,
      nameservers: domainInfo.nameservers,
      records: domainInfo.dnsRecords,
    };
  } catch (error) {
    if (error instanceof VercelDomainError && error.statusCode === 404) {
      throw new VercelDomainError(
        `Domain ${domain} not found in Vercel project`,
        404,
        error.vercelError
      );
    }
    throw error;
  }
}
