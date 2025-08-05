const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware with better mobile support
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: false // Disable HSTS to prevent HTTPS redirects
}));

// Enable CORS for development and mobile access
// Fixed: Remove conflicting credentials with wildcard origin
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: false, // Disable credentials when using wildcard origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Enable compression
app.use(compression());

// Simplified mobile-friendly headers (removed redundant CORS headers)
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent HTTPS redirects
  res.setHeader('Strict-Transport-Security', 'max-age=0');
  
  // Simplified caching strategy based on environment
  if (NODE_ENV === 'development') {
    // Development: No caching for easier debugging
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    // Production: Smart caching for static assets
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      // Static assets: 1 hour cache with version-based cache busting
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    } else {
      // HTML and other files: No cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
  
  next();
});

// Serve static files with environment-appropriate caching
app.use(express.static(path.join(__dirname, './'), {
  etag: true,
  lastModified: true,
  maxAge: NODE_ENV === 'development' ? 0 : '1h', // 0 for dev, 1 hour for production
  setHeaders: (res, path) => {
    // Add version-based cache busting for JS and CSS files
    if (path.match(/\.(js|css)$/)) {
      const version = require('./package.json').version;
      res.setHeader('ETag', `"${version}-${path}"`);
    }
  }
}));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/changelog', (req, res) => {
  res.sendFile(path.join(__dirname, 'changelog.html'));
});



// Health check endpoint with version info for cache busting
app.get('/health', (req, res) => {
  const version = require('./package.json').version;
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: version,
    name: 'X Touch Controller',
    environment: NODE_ENV
  });
});

// API endpoints for future features
app.get('/api/status', (req, res) => {
  const version = require('./package.json').version;
  res.json({
    server: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: version,
    environment: NODE_ENV
  });
});

// GitHub API proxy endpoints with rate limiting
const githubRequestCache = new Map();
const GITHUB_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedResponse(cacheKey) {
  const cached = githubRequestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GITHUB_CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedResponse(cacheKey, data) {
  githubRequestCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

app.get('/api/github/releases', async (req, res) => {
  try {
    const cacheKey = 'github-releases';
    const cached = getCachedResponse(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const response = await fetch('https://api.github.com/repos/staticextasy/XTouchController/releases');
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const releases = await response.json();
    setCachedResponse(cacheKey, releases);
    res.json(releases);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch releases from GitHub',
      message: error.message 
    });
  }
});

app.get('/api/github/commits', async (req, res) => {
  try {
    const cacheKey = 'github-commits';
    const cached = getCachedResponse(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const response = await fetch('https://api.github.com/repos/staticextasy/XTouchController/commits?per_page=10');
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const commits = await response.json();
    setCachedResponse(cacheKey, commits);
    res.json(commits);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch commits from GitHub',
      message: error.message 
    });
  }
});

app.get('/api/github/latest', async (req, res) => {
  try {
    const cacheKey = 'github-latest';
    const cached = getCachedResponse(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const response = await fetch('https://api.github.com/repos/staticextasy/XTouchController/releases/latest');
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const latestRelease = await response.json();
    setCachedResponse(cacheKey, latestRelease);
    res.json(latestRelease);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch latest release from GitHub',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 X Touch Controller Server`);
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  console.log(`🚀 Press Ctrl+C to stop the server`);
  console.log(`📱 Mobile access: Use your computer's IP address instead of localhost`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server terminated');
  process.exit(0);
}); 