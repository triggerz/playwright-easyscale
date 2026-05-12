/**
 * Express API Server for Playwright EasyScale Orchestrator
 */

const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const testsRoutes = require('./routes/tests');
const runsRoutes = require('./routes/runs');
const statsRoutes = require('./routes/stats');

// Import middleware
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.WEB_UI_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

console.log('🔒 CORS Configuration:');
console.log('   Allowed origin:', process.env.WEB_UI_URL || 'http://localhost:5173');

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'playwright-easyscale-orchestrator'
  });
});

// API routes
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/tests', authMiddleware, testsRoutes);
app.use('/api/runs', authMiddleware, runsRoutes);
app.use('/api/stats', authMiddleware, statsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
async function start() {
  try {
    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n🚀 Playwright EasyScale Orchestrator API`);
      console.log(`   Server running on port ${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(`   API base: http://localhost:${PORT}/api`);
      console.log(`\n   Environment:`);
      console.log(`   - AUTH_SECRET: ${process.env.AUTH_SECRET ? '✓ Set' : '✗ Not set'}`);
      console.log(`   - S3_BUCKET: ${process.env.S3_BUCKET ? '✓ Set' : '✗ Not set'}`);
      console.log(`   - RAILWAY_PROJECT_ID: ${process.env.RAILWAY_PROJECT_ID ? '✓ Set' : '✗ Not set'}`);
      console.log(`   - RAILWAY_SERVICE_ID: ${process.env.RAILWAY_SERVICE_ID ? '✓ Set' : '✗ Not set'}`);
      console.log(`\n   Ready to accept requests!\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
start();

module.exports = app;
