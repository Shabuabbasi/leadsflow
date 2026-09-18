import jwt from 'jsonwebtoken';

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

function requireApiSecret(req, res, next) {
  const token = getBearerToken(req);
  if (!token || token !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireJwt(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireApiSecretOrJwt(req, res, next) {
  const token = getBearerToken(req);
  if (token && token === process.env.API_SECRET) {
    req.authType = 'wordpress';
    return next();
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    req.authType = 'dashboard';
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export { requireApiSecret, requireApiSecretOrJwt, requireJwt };
