import jwt from 'jsonwebtoken';

export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return res.status(401).json({ message: 'نیاز به احراز هویت' });
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'توکن نامعتبر است' });
  }
}

export function requireRole(roleName) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const primary = req.user?.role;
    if (primary === roleName || roles.includes(roleName)) return next();
    return res.status(403).json({ message: 'دسترسی برای این عملیات ندارید' });
  };
}

export function requireAnyRole(roleNames) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const primary = req.user?.role;
    // Check if primary role or any of the roles matches
    if (roleNames.includes(primary) || roles.some(r => roleNames.includes(r))) {
      return next();
    }
    return res.status(403).json({ message: 'دسترسی برای این عملیات ندارید' });
  };
}
