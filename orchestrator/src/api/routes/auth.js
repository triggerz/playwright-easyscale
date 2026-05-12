/**
 * Authentication routes
 */

const express = require('express');
const router = express.Router();

/**
 * POST /api/auth/login
 * Verify passphrase and return token
 */
router.post('/login', (req, res) => {
  const { passphrase } = req.body;
  const secret = process.env.AUTH_SECRET;

  console.log('🔐 Login attempt:');
  console.log('   Received passphrase:', passphrase);
  console.log('   Expected secret:', secret);
  console.log('   Match:', passphrase === secret);

  if (!secret) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Authentication not configured'
    });
  }

  if (!passphrase) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Passphrase is required'
    });
  }

  if (passphrase !== secret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid passphrase'
    });
  }

  // Return the secret as the token (simple approach)
  res.json({
    token: secret,
    message: 'Authentication successful'
  });
});

module.exports = router;
