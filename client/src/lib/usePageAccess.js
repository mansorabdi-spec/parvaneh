import { useState, useEffect } from 'react';

/**
 * Hook to check if the current user has access to specific pages
 * @returns {Object} { accessiblePages, hasAccess, loading, error }
 */
export function usePageAccess() {
  const [accessiblePages, setAccessiblePages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Listen for storage changes (when token is updated by role switch)
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event when token changes in same tab
    const handleTokenChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('tokenChanged', handleTokenChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenChanged', handleTokenChange);
    };
  }, []);

  useEffect(() => {
    const fetchAccessiblePages = async () => {
      try {
        if (!token) {
          console.log('📋 usePageAccess: No token, clearing pages');
          setAccessiblePages([]);
          setLoading(false);
          return;
        }

        console.log('📋 usePageAccess: Fetching accessible pages with token:', token.substring(0, 20) + '...');
        setError(null);
        setLoading(true);
        const res = await fetch('/api/permissions/my-pages', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          console.error('📋 usePageAccess: Failed to fetch pages, status:', res.status);
          throw new Error('خطا در دریافت صفحات قابل دسترسی');
        }

        const data = await res.json();
        console.log('📋 usePageAccess: Received pages:', data.pages);
        setAccessiblePages(data.pages || []);
      } catch (err) {
        console.error('📋 usePageAccess: Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAccessiblePages();
  }, [token]); // Re-fetch when token changes

  /**
   * Check if user has access to a specific page by key or path
   * @param {string} pageKeyOrPath - Page key (e.g., 'admin_users') or path (e.g., '/admin/users')
   * @returns {boolean}
   */
  const hasAccess = (pageKeyOrPath) => {
    if (!pageKeyOrPath) return false;
    
    return accessiblePages.some(
      page => page.PageKey === pageKeyOrPath || page.PagePath === pageKeyOrPath
    );
  };

  return {
    accessiblePages,
    hasAccess,
    loading,
    error
  };
}

/**
 * Get page access map for easy lookup
 * @param {Array} pages - Array of accessible pages
 * @returns {Object} Map of pageKey -> boolean
 */
export function getPageAccessMap(pages) {
  const map = {};
  pages.forEach(page => {
    map[page.PageKey] = true;
    map[page.PagePath] = true;
  });
  return map;
}
