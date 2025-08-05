// Shared utilities for X Touch Controller
// This file contains common functions used across multiple scripts

console.log('utils.js loading...');
console.log('utils.js: Document readyState at load:', typeof document !== 'undefined' ? document.readyState : 'document not available');
console.log('utils.js: Window object available:', typeof window !== 'undefined');

// Theme management utilities
window.ThemeManager = {
  cache: {
    buttons: null,
    savedTheme: null,
    initialized: false,
    initAttempts: 0,
    maxInitAttempts: 10
  },

  // Mobile-optimized event handlers
  handleThemeClick: (e) => {
    console.log('ThemeManager: Click event triggered');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Clear text selection
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
    
    const theme = e.currentTarget.getAttribute('data-theme');
    if (theme) {
      console.log('ThemeManager: Click event - setting theme:', theme);
      window.ThemeManager.setTheme(theme);
    }
  },

  handleThemeTouch: (e) => {
    console.log('ThemeManager: Touch event triggered');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Clear text selection
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
    
    const theme = e.currentTarget.getAttribute('data-theme');
    if (theme) {
      console.log('ThemeManager: Touch event - setting theme:', theme);
      window.ThemeManager.setTheme(theme);
      
      // Visual feedback
      try {
        e.currentTarget.style.transform = 'scale(0.95)';
        setTimeout(() => {
          if (e.currentTarget && e.currentTarget.style) {
            e.currentTarget.style.transform = '';
          }
        }, 150);
      } catch (error) {
        console.warn('ThemeManager: Error with visual feedback:', error);
      }
    }
  },

  // Mobile-optimized initialization
  init() {
    console.log('ThemeManager: Initialization started');
    
    // Prevent multiple initializations
    if (this.cache.initialized) {
      console.log('ThemeManager: Already initialized, skipping...');
      return;
    }

    // Check if DOM is ready
    if (document.readyState === 'loading') {
      console.log('ThemeManager: DOM still loading, waiting...');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('ThemeManager: DOMContentLoaded fired, initializing...');
        window.ThemeManager.init();
      });
      return;
    }

    // Increment attempt counter
    this.cache.initAttempts++;
    
    if (this.cache.initAttempts > this.cache.maxInitAttempts) {
      console.error('ThemeManager: Max initialization attempts reached');
      return;
    }

    try {
      // Get theme buttons
      this.cache.buttons = document.querySelectorAll('.theme-btn');
      
      if (!this.cache.buttons || this.cache.buttons.length === 0) {
        console.warn(`ThemeManager: No .theme-btn elements found (attempt ${this.cache.initAttempts}/${this.cache.maxInitAttempts}). Retrying in 200ms...`);
        setTimeout(() => window.ThemeManager.init(), 200);
        return;
      }

      console.log('ThemeManager: Found', this.cache.buttons.length, 'theme buttons');

      // Get saved theme
      try {
        this.cache.savedTheme = localStorage.getItem('obs-theme') || 'ocean';
        console.log('ThemeManager: Saved theme from localStorage:', this.cache.savedTheme);
      } catch (error) {
        console.warn('ThemeManager: localStorage not available, using default theme');
        this.cache.savedTheme = 'ocean';
      }

      // Apply the saved theme immediately
      this.applyTheme(this.cache.savedTheme);
      
      // Set up event listeners for each button
      this.cache.buttons.forEach((btn, index) => {
        const theme = btn.getAttribute('data-theme');
        console.log(`ThemeManager: Setting up button ${index + 1} with theme: ${theme}`);
        
        // Remove any existing listeners
        btn.removeEventListener('click', window.ThemeManager.handleThemeClick);
        btn.removeEventListener('touchstart', window.ThemeManager.handleThemeTouch);
        btn.removeEventListener('touchend', window.ThemeManager.handleThemeTouch);
        
        // Add new listeners with proper options for mobile
        btn.addEventListener('click', window.ThemeManager.handleThemeClick, { 
          passive: false, 
          capture: false 
        });
        btn.addEventListener('touchstart', window.ThemeManager.handleThemeTouch, { 
          passive: false, 
          capture: false 
        });
        btn.addEventListener('touchend', window.ThemeManager.handleThemeTouch, { 
          passive: false, 
          capture: false 
        });
        
        // Ensure mobile-friendly styling
        btn.style.userSelect = 'none';
        btn.style.webkitUserSelect = 'none';
        btn.style.mozUserSelect = 'none';
        btn.style.msUserSelect = 'none';
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = 'pointer';
        btn.style.touchAction = 'manipulation';
        btn.style.webkitTapHighlightColor = 'transparent';
        btn.style.webkitTouchCallout = 'none';
        
        // Ensure proper z-index
        btn.style.zIndex = '1060';
        btn.style.position = 'relative';
      });

      this.cache.initialized = true;
      console.log('ThemeManager: Initialized successfully with theme:', this.cache.savedTheme);
      
      // Force a repaint
      document.body.offsetHeight;
      
    } catch (error) {
      console.error('ThemeManager: Error during initialization:', error);
      // Retry initialization after a delay
      setTimeout(() => window.ThemeManager.init(), 500);
    }
  },

  setTheme(theme) {
    if (!theme) {
      console.warn('ThemeManager: No theme provided to setTheme');
      return;
    }
    
    if (theme === this.cache.savedTheme) {
      console.log('ThemeManager: Theme already set to', theme);
      return;
    }
    
    console.log('ThemeManager: Setting theme to:', theme);
    
    try {
      this.applyTheme(theme);
      
      // Save to localStorage
      try {
        localStorage.setItem('obs-theme', theme);
        this.cache.savedTheme = theme;
        console.log('ThemeManager: Theme saved to localStorage:', theme);
      } catch (error) {
        console.warn('ThemeManager: Could not save theme to localStorage:', error);
        this.cache.savedTheme = theme;
      }
      
    } catch (error) {
      console.error('ThemeManager: Error in setTheme:', error);
    }
  },

  applyTheme(theme) {
    if (!theme) {
      console.warn('ThemeManager: No theme provided to applyTheme');
      return;
    }
    
    console.log('ThemeManager: Applying theme:', theme);
    
    try {
      // Set the theme attribute on the document element
      document.documentElement.setAttribute('data-theme', theme);
      
      // Update the active button
      this.updateActiveThemeButton(theme);
      
      // Force multiple repaints to ensure theme is applied
      document.body.offsetHeight;
      document.documentElement.offsetHeight;
      
      console.log('ThemeManager: Theme applied successfully:', theme);
      
      // Verify theme was applied
      const appliedTheme = document.documentElement.getAttribute('data-theme');
      console.log('ThemeManager: Current applied theme:', appliedTheme);
      
      if (appliedTheme !== theme) {
        console.warn('ThemeManager: Theme verification failed. Expected:', theme, 'Got:', appliedTheme);
        // Try again
        setTimeout(() => {
          document.documentElement.setAttribute('data-theme', theme);
          document.body.offsetHeight;
        }, 100);
      }
      
    } catch (error) {
      console.error('ThemeManager: Error in applyTheme:', error);
    }
  },

  updateActiveThemeButton(activeTheme) {
    if (!this.cache.buttons || !activeTheme) {
      console.warn('ThemeManager: Cannot update active button - buttons:', !!this.cache.buttons, 'theme:', activeTheme);
      return;
    }
    
    console.log('ThemeManager: Updating active button for theme:', activeTheme);
    
    try {
      this.cache.buttons.forEach((btn, index) => {
        const btnTheme = btn.getAttribute('data-theme');
        btn.classList.remove('active');
        if (btnTheme === activeTheme) {
          btn.classList.add('active');
          console.log(`ThemeManager: Button ${index + 1} (${btnTheme}) marked as active`);
        }
      });
    } catch (error) {
      console.error('ThemeManager: Error in updateActiveThemeButton:', error);
    }
  },

  reinit() {
    console.log('ThemeManager: Reinitializing...');
    this.cache.initialized = false;
    this.cache.buttons = null;
    this.cache.initAttempts = 0;
    this.init();
  },

  forceInit() {
    console.log('ThemeManager: Force initialization...');
    this.cache.initialized = false;
    this.cache.buttons = null;
    this.cache.initAttempts = 0;
    
    // Force immediate initialization
    setTimeout(() => {
      window.ThemeManager.init();
    }, 100);
  },

  // Utility functions
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
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  },

  showUserError(message, duration = 5000) {
    // Create a temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger position-fixed';
    errorDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, duration);
  }
};

// Auto-initialize ThemeManager when DOM is ready
if (typeof document !== 'undefined') {
  console.log('utils.js: Document available, checking readyState:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('utils.js: DOM still loading, adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('utils.js: DOMContentLoaded fired, auto-initializing ThemeManager');
      window.ThemeManager.init();
    });
  } else {
    console.log('utils.js: DOM already ready, auto-initializing ThemeManager');
    // DOM is already ready
    window.ThemeManager.init();
  }
} else {
  console.log('utils.js: Document not available yet');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager: window.ThemeManager, ErrorHandler };
}

console.log('utils.js loaded successfully, ThemeManager available:', typeof window.ThemeManager !== 'undefined');
console.log('utils.js: ThemeManager object details:', window.ThemeManager);
console.log('utils.js: Global scope check - window.ThemeManager:', typeof window !== 'undefined' ? window.ThemeManager : 'window not available'); 