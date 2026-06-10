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
  requireAuth = true, 
  redirectTo = "/" 
}) {
  const { hasAccess, loading } = usePageAccess();
  const token = localStorage.getItem('token');

  // If authentication is required but no token, redirect to login
  if (requireAuth && !token) {
    return <Navigate to="/login" replace />;
  }

  // If still loading permissions, show loading state
  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>در حال بارگذاری...</div>;
  }

  // If pageKey is provided, check access
  if (pageKey) {
    if (!hasAccess(pageKey)) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  // Access granted, render the element
  return element;
}
