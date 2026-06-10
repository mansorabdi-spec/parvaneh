/**
 * Permission checking utilities
 * Uses the RolePermissions table to check user permissions
 */

// Global permissions cache
let permissionsCache = null;
let currentUserRole = null;

/**
 * Check if current user has permission for a specific action
 * @param {string} permissionKey - The permission key to check (e.g., 'print_license', 'view_payments')
 * @param {boolean} requireEdit - If true, checks CanEdit; if false, checks CanView (default: false)
 * @returns {boolean} - True if user has permission, false otherwise
 */
export function checkPermission(permissionKey, requireEdit = false) {
  try {
    // Get user from localStorage or sessionStorage
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return false;

    // Decode JWT to get user info (simple base64 decode)
    let payload;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      payload = JSON.parse(atob(base64));
    } catch (decodeError) {
      console.error('Error decoding token:', decodeError);
      return false;
    }
    
    const userRole = payload.role || payload.Role;
    
    if (!userRole) return false;

    // Admin always has full access
    if (userRole === 'Admin') return true;

    // Check if we have permissions loaded for this role
    if (permissionsCache && currentUserRole === userRole) {
      const perm = permissionsCache.find(p => p.PermissionKey === permissionKey);
      
      if (!perm) {
        console.log(`⚠️ Permission not found: ${permissionKey} for role: ${userRole}`);
        return false;
      }
      
      const hasPermission = requireEdit ? perm.CanEdit : perm.CanView;
      console.log(`🔐 Permission check: ${permissionKey} for ${userRole} = ${hasPermission}`);
      return hasPermission;
    }

    // If no cached permissions, try to load from sessionStorage
    const cacheKey = `permissions_${userRole}`;
    const cachedPermissions = sessionStorage.getItem(cacheKey);
    
    if (cachedPermissions) {
      permissionsCache = JSON.parse(cachedPermissions);
      currentUserRole = userRole;
      
      const perm = permissionsCache.find(p => p.PermissionKey === permissionKey);
      if (!perm) return false;
      
      return requireEdit ? perm.CanEdit : perm.CanView;
    }

    console.warn(`⚠️ No permissions loaded for role: ${userRole}. Call loadUserPermissions() first.`);
    return false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Load permissions for current user's role from backend
 * Should be called after login or role switch
 */
export async function loadUserPermissions() {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    // Decode JWT to get user info
    let payload;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      payload = JSON.parse(atob(base64));
    } catch (decodeError) {
      console.error('Error decoding token in loadUserPermissions:', decodeError);
      return;
    }
    
    const userRole = payload.role || payload.Role;
    
    if (!userRole) return;

    // Fetch permissions from backend using the public endpoint
    // Backend will get roleName from JWT token, no need to send it as query parameter
    const response = await fetch(`/api/role-permissions/my-permissions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      // Backend already filtered permissions for current user's role, no need to filter again
      const rolePermissions = data.permissions || [];
      
      // Cache permissions in sessionStorage
      const cacheKey = `permissions_${userRole}`;
      sessionStorage.setItem(cacheKey, JSON.stringify(rolePermissions));
      
      // Also update global cache
      permissionsCache = rolePermissions;
      currentUserRole = userRole;
      
      console.log(`✅ Loaded ${rolePermissions.length} permissions for role: ${userRole}`);
    }
  } catch (error) {
    console.error('Error loading user permissions:', error);
  }
}

/**
 * Clear cached permissions (call on logout)
 */
export function clearPermissions() {
  // Clear all permission caches
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith('permissions_')) {
      sessionStorage.removeItem(key);
    }
  });
}
