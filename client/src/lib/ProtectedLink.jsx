import React from 'react';
import { Link } from 'react-router-dom';
import { usePageAccess } from './usePageAccess';

/**
 * ProtectedLink component that only renders if user has access to the page
 * @param {Object} props
 * @param {string} props.to - The path to link to
 * @param {string} props.pageKey - The page key to check access for
 * @param {React.ReactNode} props.children - The link content
 * @param {Object} props.style - Optional inline styles
 * @param {string} props.className - Optional CSS class
 */
export default function ProtectedLink({ to, pageKey, children, style, className, ...rest }) {
  const { hasAccess, loading } = usePageAccess();

  // If still loading, don't render the link
  if (loading) {
    return null;
  }

  // If pageKey is provided and user doesn't have access, don't render
  if (pageKey && !hasAccess(pageKey)) {
    return null;
  }

  // User has access, render the link
  return (
    <Link to={to} style={style} className={className} {...rest}>
      {children}
    </Link>
  );
}
