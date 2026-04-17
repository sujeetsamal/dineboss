'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle, Loader2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Domain Settings Component
 * Allows restaurant admin to:
 * - View their free subdomain (e.g., abc.dineboss.app)
 * - Connect a custom domain
 * - View DNS setup instructions
 * - Check domain verification status
 */
export default function DomainSettings({ restaurantId, restaurantName }) {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState('');
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDNSInstructions, setShowDNSInstructions] = useState(false);
  const [dnsInstructions, setDnsInstructions] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Fetch restaurant data on mount
  useEffect(() => {
    fetchRestaurantData();
  }, [restaurantId]);

  async function fetchRestaurantData() {
    try {
      const response = await fetch(`/api/restaurants/${restaurantId}`);
      if (response.ok) {
        const data = await response.json();
        setRestaurant(data);
        setCustomDomain(data.customDomain || '');
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDomain(e) {
    e.preventDefault();
    
    if (!customDomain.trim()) {
      toast.error('Please enter a domain');
      return;
    }

    setIsAddingDomain(true);
    try {
      const response = await fetch('/api/domains/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: customDomain.trim(),
          restaurantId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to add domain');
        return;
      }

      toast.success('Domain added! Please configure your DNS records.');
      setRestaurant(prev => ({
        ...prev,
        customDomain: data.domain,
        domainVerified: false,
      }));
      setDnsInstructions(data.dnsInstructions);
      setShowDNSInstructions(true);
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error('Error adding domain');
    } finally {
      setIsAddingDomain(false);
    }
  }

  async function handleVerifyDomain() {
    setIsVerifying(true);
    try {
      const response = await fetch('/api/domains/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        toast.success('Domain verified successfully!');
        setRestaurant(prev => ({
          ...prev,
          domainVerified: true,
        }));
        setVerificationStatus({ verified: true });
      } else if (response.status === 202) {
        toast.info('Domain not ready yet. Please check your DNS records and try again in a few minutes.');
        setVerificationStatus({ verified: false, message: data.error });
      } else {
        toast.error(data.error || 'Verification failed');
        setVerificationStatus({ verified: false, message: data.error });
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error('Error verifying domain');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleFetchDNSInstructions() {
    try {
      const response = await fetch(`/api/domains/dns?restaurantId=${restaurantId}`);
      const data = await response.json();
      
      if (response.ok) {
        setDnsInstructions(data.dnsInstructions);
        setShowDNSInstructions(true);
      }
    } catch (error) {
      console.error('Error fetching DNS instructions:', error);
      toast.error('Error fetching DNS instructions');
    }
  }

  function copyToClipboard(text, field) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Free Subdomain Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Free Subdomain</h2>
        </div>
        
        {restaurant?.subdomain ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your restaurant is instantly accessible at:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm break-all">
                {restaurant.subdomain}.dineboss.app
              </code>
              <button
                onClick={() => copyToClipboard(`${restaurant.subdomain}.dineboss.app`, 'subdomain')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
              >
                {copiedField === 'subdomain' ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Share this URL with your customers to access the menu
            </p>
          </div>
        ) : (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-200 text-sm">
            Subdomain not initialized. Contact support.
          </div>
        )}
      </div>

      {/* Custom Domain Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Custom Domain</h2>
          <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 px-2 py-1 rounded">BETA</span>
        </div>

        {restaurant?.domainVerified && restaurant?.customDomain ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-100">Domain Verified</p>
                  <p className="text-sm text-green-700 dark:text-green-200 mt-1">
                    Your custom domain <code className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded font-mono text-xs">{restaurant.customDomain}</code> is active!
                  </p>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>Customers can access your menu at:</p>
              <code className="block mt-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded font-mono">
                {restaurant.customDomain}
              </code>
            </div>
          </div>
        ) : restaurant?.customDomain ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-100">Verification Pending</p>
                  <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                    Domain <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded font-mono text-xs">{restaurant.customDomain}</code> added. 
                    Please configure your DNS records below.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleFetchDNSInstructions}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View DNS Instructions →
            </button>

            <button
              onClick={handleVerifyDomain}
              disabled={isVerifying}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded font-medium transition flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Verify Domain'
              )}
            </button>
          </div>
        ) : (
          <form onSubmit={handleAddDomain} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Connect your own domain (e.g., example.com) instead of using the free subdomain.
            </p>

            <div>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="example.com"
                disabled={isAddingDomain}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Enter just the domain name (without https:// or www)
              </p>
            </div>

            <button
              type="submit"
              disabled={isAddingDomain}
              className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded font-medium transition flex items-center justify-center gap-2"
            >
              {isAddingDomain ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding Domain...
                </>
              ) : (
                'Connect Custom Domain'
              )}
            </button>
          </form>
        )}
      </div>

      {/* DNS Instructions Modal */}
      {showDNSInstructions && dnsInstructions && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">DNS Setup Instructions</h3>
            <button
              onClick={() => setShowDNSInstructions(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-4 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Add the following DNS records at your domain registrar:
            </p>

            {dnsInstructions.records.map((record, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-gray-700 p-4 rounded space-y-2">
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
                    <code className="block font-mono bg-white dark:bg-gray-600 px-2 py-1 rounded text-sm mt-1">
                      {record.type}
                    </code>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                    <code className="block font-mono bg-white dark:bg-gray-600 px-2 py-1 rounded text-sm mt-1">
                      {record.name}
                    </code>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Value</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 font-mono bg-white dark:bg-gray-600 px-2 py-1 rounded text-sm break-all">
                        {record.value}
                      </code>
                      <button
                        onClick={() => copyToClipboard(record.value, `record-${idx}`)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        {copiedField === `record-${idx}` ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {record.ttl && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    TTL: {record.ttl}
                  </p>
                )}
              </div>
            ))}

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium mb-2">⏱️ Verification may take 24-48 hours</p>
              <p>After updating your DNS records, click "Verify Domain" to check the status. DNS propagation can take a while.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
