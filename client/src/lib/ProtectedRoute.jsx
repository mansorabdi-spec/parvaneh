import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePageAccess } from './usePageAccess';

/**
 * ProtectedRoute component that checks page access permissions
 * @param {Object} props
 * @param {React.ReactElement} props.element - The component to render if access is granted
 * @param {string} props.pageKey - The page key to check access for
 * @param {boolean} props.requireAuth - Whether authentication is required
 * @param {string} props.redirectTo - Where to redirect if access is denied (default: "/")
 */
export default function ProtectedRoute({ 
  element, 
  pageKey, 
  pageKeys,
  requireAuth = true, 
  redirectTo = "/" 
}) {
  const { hasAccess, loading, error } = usePageAccess();
  const token = localStorage.getItem('token');
  const requiredKeys = Array.isArray(pageKeys) && pageKeys.length > 0
    ? pageKeys
    : (pageKey ? [pageKey] : []);
  const allowed = requiredKeys.length === 0 || requiredKeys.some((key) => hasAccess(key));

  // If authentication is required but no token, redirect to login
  if (requireAuth && !token) {
    return <Navigate to="/login" replace />;
  }

  // If still loading permissions, show loading state
  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>در حال بارگذاری...</div>;
  }

  // A failed permission lookup is not the same as a denied page.
  if (!allowed && error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        خطا در بررسی دسترسی. لطفاً چند لحظه بعد دوباره تلاش کنید.
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return element;
}
