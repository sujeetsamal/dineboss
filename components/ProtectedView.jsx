'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasPermission } from '@/lib/permissions';

/**
 * Protected route/component wrapper
 * Checks user permissions and shows access denied if insufficient
 */
export function ProtectedView({ requiredPermission, children, fallback = null }) {
  const { user, role, permissions, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Check permission
  const hasAccess = hasPermission({ role, permissions }, requiredPermission);

  if (!hasAccess) {
    return (
      fallback || (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <p className="text-sm">Access Denied: You do not have permission to access this page.</p>
        </div>
      )
    );
  }

  return children;
}
