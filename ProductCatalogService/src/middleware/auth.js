const jwt = require('jsonwebtoken');

const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE
    });
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    const userRole = req.user?.[ROLE_CLAIM];
    if (userRole !== role) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

function requireInternalSecret(req, res, next) {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SECRET)
    return res.status(403).json({ message: 'Forbidden' });
  next();
}

module.exports = { verifyToken, requireRole, requireInternalSecret };
