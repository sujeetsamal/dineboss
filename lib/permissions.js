/**
 * Permission engine for DineBoss
 * Centralized permission checks for all roles
 */

// Default permissions by role
const ROLE_PERMISSIONS = {
  owner: {
    canManageMenu: true,
    canManageStaff: true,
    canViewAnalytics: true,
    canManageTables: true,
    canProcessOrders: true,
    canAccessAdmin: true,
    canManageSettings: true,
  },
  manager: {
    canManageMenu: true,
    canManageStaff: true,
    canViewAnalytics: true,
    canManageTables: true,
    canProcessOrders: true,
    canAccessAdmin: true,
    canManageSettings: false,
  },
  waiter: {
    canManageMenu: false,
    canManageStaff: false,
    canViewAnalytics: false,
    canManageTables: false,
    canProcessOrders: true,
    canAccessAdmin: false,
    canManageSettings: false,
  },
  kitchen: {
    canManageMenu: false,
    canManageStaff: false,
    canViewAnalytics: false,
    canManageTables: false,
    canProcessOrders: true,
    canAccessAdmin: false,
    canManageSettings: false,
  },
};

/**
 * Check if user has a specific permission
 * @param {Object} user - User object with role and permissions
 * @param {string} permissionKey - Permission key to check
 * @returns {boolean}
 */
export function hasPermission(user, permissionKey) {
  if (!user) return false;

  // Use user's custom permissions if available, otherwise use role defaults
  const userPermissions = user.permissions || ROLE_PERMISSIONS[user.role] || {};
  return userPermissions[permissionKey] === true;
}

/**
 * Check if user has multiple permissions (all required)
 * @param {Object} user - User object
 * @param {string[]} permissionKeys - Array of permission keys
 * @returns {boolean}
 */
export function hasAllPermissions(user, permissionKeys) {
  if (!user || !Array.isArray(permissionKeys)) return false;
  return permissionKeys.every((key) => hasPermission(user, key));
}

/**
 * Check if user has any of the permissions
 * @param {Object} user - User object
 * @param {string[]} permissionKeys - Array of permission keys
 * @returns {boolean}
 */
export function hasAnyPermission(user, permissionKeys) {
  if (!user || !Array.isArray(permissionKeys)) return false;
  return permissionKeys.some((key) => hasPermission(user, key));
}

/**
 * Get all permissions for a user
 * @param {Object} user - User object
 * @returns {Object}
 */
export function getUserPermissions(user) {
  if (!user) return {};
  return user.permissions || ROLE_PERMISSIONS[user.role] || {};
}

/**
 * Check if user is admin-level (owner or manager)
 * @param {Object} user - User object
 * @returns {boolean}
 */
export function isAdminUser(user) {
  if (!user) return false;
  return user.role === 'owner' || user.role === 'manager';
}

/**
 * Check if user is owner
 * @param {Object} user - User object
 * @returns {boolean}
 */
export function isOwner(user) {
  if (!user) return false;
  return user.role === 'owner';
}

/**
 * Get default permissions for a role
 * @param {string} role - User role
 * @returns {Object}
 */
export function getDefaultPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || {};
}

/**
 * Validate if a permission key is valid
 * @param {string} permissionKey - Permission key to validate
 * @returns {boolean}
 */
export function isValidPermissionKey(permissionKey) {
  const validKeys = Object.keys(ROLE_PERMISSIONS.owner);
  return validKeys.includes(permissionKey);
}
