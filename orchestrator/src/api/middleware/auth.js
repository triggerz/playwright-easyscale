/**
 * Simple authentication middleware
 * Checks for Bearer token matching AUTH_SECRET environment variable
 */

function authMiddleware(req, res, next) {
  // Skip auth for login endpoint
  if (req.path === '/api/auth/login') {
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing or invalid authorization header' 
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    console.error('AUTH_SECRET environment variable not set!');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Authentication not configured' 
    });
  }

  if (token !== secret) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid authentication token' 
    });
  }

  // Token is valid, proceed
  next();
}

module.exports = authMiddleware;
