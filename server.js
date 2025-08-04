const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Enable compression
app.use(compression());

// Add mobile-friendly headers and caching
app.use((req, res, next) => {
  // Prevent mobile browsers from trying to use HTTPS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Allow mobile browsers to access the site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Prevent HTTPS redirects
  res.setHeader('Strict-Transport-Security', 'max-age=0');
  
  // Add caching headers for static assets
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    res.setHeader('ETag', `"${Date.now()}"`);
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  
  next();
});

// Serve static files with caching
app.use(express.static(path.join(__dirname, './'), {
  etag: true,
  lastModified: true,
  maxAge: '1y'
}));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/changelog', (req, res) => {
  res.sendFile(path.join(__dirname, 'changelog.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.1.30',
    name: 'X Touch Controller'
  });
});

// API endpoints for future features
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: require('./package.json').version
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
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
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
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
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