// Shared utilities for X Touch Controller
// This file contains common functions used across multiple scripts

// Theme management utilities
const ThemeManager = {
  cache: {
    buttons: null,
    savedTheme: null,
    initialized: false
  },

  // Properly bound event handlers using arrow functions
  handleThemeClick: (e) => {
    e.preventDefault();
    e.stopPropagation();
    const theme = e.currentTarget.getAttribute('data-theme');
    ThemeManager.setTheme(theme);
  },

  handleThemeTouch: (e) => {
    // Only prevent default if we're on a button to avoid blocking scrolling
    if (e.currentTarget.classList.contains('theme-btn')) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const theme = e.currentTarget.getAttribute('data-theme');
    ThemeManager.setTheme(theme);
    
    // Add visual feedback for mobile with better error handling
    try {
      e.currentTarget.style.transform = 'scale(0.95)';
      setTimeout(() => {
        if (e.currentTarget && e.currentTarget.style) {
          e.currentTarget.style.transform = '';
        }
      }, 150);
    } catch (error) {
      ErrorHandler.logError(error, 'ThemeManager.handleThemeTouch');
    }
  },

  init() {
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
      return;
    }

    // Prevent multiple initializations
    if (this.cache.initialized) {
      return;
    }

    try {
      // Get theme buttons
      this.cache.buttons = document.querySelectorAll('.theme-btn');
      
      if (!this.cache.buttons || this.cache.buttons.length === 0) {
        console.warn('ThemeManager: No .theme-btn elements found. Retrying in 100ms...');
        setTimeout(() => ThemeManager.init(), 100);
        return;
      }

      // Get saved theme with fallback
      try {
        this.cache.savedTheme = localStorage.getItem('obs-theme') || 'ocean';
      } catch (error) {
        console.warn('ThemeManager: localStorage not available, using default theme');
        this.cache.savedTheme = 'ocean';
      }

      this.applyTheme(this.cache.savedTheme);
      
      // Add event listeners with proper binding
      this.cache.buttons.forEach(btn => {
        // Remove existing listeners to prevent duplicates
        btn.removeEventListener('click', ThemeManager.handleThemeClick);
        btn.removeEventListener('touchstart', ThemeManager.handleThemeTouch);
        
        // Add new listeners
        btn.addEventListener('click', ThemeManager.handleThemeClick);
        btn.addEventListener('touchstart', ThemeManager.handleThemeTouch, { passive: false });
      });

      this.cache.initialized = true;
      console.log('ThemeManager: Initialized successfully');
      
    } catch (error) {
      ErrorHandler.logError(error, 'ThemeManager.init');
      // Retry initialization after a delay
      setTimeout(() => ThemeManager.init(), 500);
    }
  },

  setTheme(theme) {
    if (!theme || theme === this.cache.savedTheme) return; // Skip if same theme or invalid
    
    try {
      this.applyTheme(theme);
      
      // Save to localStorage with error handling
      try {
        localStorage.setItem('obs-theme', theme);
        this.cache.savedTheme = theme;
      } catch (error) {
        console.warn('ThemeManager: Could not save theme to localStorage:', error);
        // Still update the cache even if localStorage fails
        this.cache.savedTheme = theme;
      }
      
    } catch (error) {
      ErrorHandler.logError(error, 'ThemeManager.setTheme');
    }
  },

  applyTheme(theme) {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      this.updateActiveThemeButton(theme);
    } catch (error) {
      ErrorHandler.logError(error, 'ThemeManager.applyTheme');
    }
  },

  updateActiveThemeButton(activeTheme) {
    if (!this.cache.buttons || !activeTheme) return;
    
    try {
      this.cache.buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-theme') === activeTheme) {
          btn.classList.add('active');
        }
      });
    } catch (error) {
      ErrorHandler.logError(error, 'ThemeManager.updateActiveThemeButton');
    }
  },

  // Method to reinitialize if DOM changes
  reinit() {
    this.cache.initialized = false;
    this.cache.buttons = null;
    this.init();
  }
};

// Performance utilities
const PerformanceUtils = {
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Error handling utilities
const ErrorHandler = {
  logError(error, context = '') {
    console.error(`[${context}] Error:`, error);
    // Could be extended to send errors to a logging service
  },

  showUserError(message, duration = 5000) {
    try {
      // Create a temporary error notification
      const errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-danger position-fixed';
      errorDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
      errorDiv.textContent = message;
      
      document.body.appendChild(errorDiv);
      
      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.parentNode.removeChild(errorDiv);
        }
      }, duration);
    } catch (error) {
      console.error('ErrorHandler.showUserError failed:', error);
    }
  }
};

// Auto-initialize ThemeManager when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
  } else {
    // DOM is already ready
    ThemeManager.init();
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, PerformanceUtils, ErrorHandler };
} 