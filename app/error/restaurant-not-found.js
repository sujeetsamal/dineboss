import { Home, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function RestaurantNotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <AlertTriangle className="w-16 h-16 text-red-500" />
        </div>

        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Restaurant Not Found
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          We couldn't find the restaurant you're looking for. It may not exist, or the domain might not be verified yet.
        </p>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-2">Did you set up a custom domain?</p>
            <p className="text-xs">Custom domains require DNS configuration and verification before they become active.</p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            <Home className="w-4 h-4" />
            Go to DineBoss Home
          </Link>
        </div>

        <div className="mt-12 text-xs text-gray-500 dark:text-gray-400">
          <p>Need help? Contact support@dineboss.app</p>
        </div>
      </div>
    </div>
  );
}
