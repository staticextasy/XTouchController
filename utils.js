// Shared utilities for X Touch Controller
// This file contains common functions used across multiple scripts

// Theme management utilities
const ThemeManager = {
  cache: {
    buttons: null,
    savedTheme: null
  },

  init() {
    if (!this.cache.buttons) {
      this.cache.buttons = document.querySelectorAll('.theme-btn');
    }
    
    this.cache.savedTheme = localStorage.getItem('obs-theme') || 'ocean';
    this.applyTheme(this.cache.savedTheme);
    
    this.cache.buttons.forEach(btn => {
      btn.removeEventListener('click', this.handleThemeClick);
      btn.removeEventListener('touchstart', this.handleThemeTouch);
      
      btn.addEventListener('click', this.handleThemeClick);
      btn.addEventListener('touchstart', this.handleThemeTouch, { passive: false });
    });
  },

  handleThemeClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const theme = e.currentTarget.getAttribute('data-theme');
    ThemeManager.setTheme(theme);
  },

  handleThemeTouch(e) {
    e.preventDefault();
    e.stopPropagation();
    const theme = e.currentTarget.getAttribute('data-theme');
    ThemeManager.setTheme(theme);
    
    // Add visual feedback for mobile
    e.currentTarget.style.transform = 'scale(0.95)';
    setTimeout(() => {
      e.currentTarget.style.transform = '';
    }, 150);
  },

  setTheme(theme) {
    if (theme === this.cache.savedTheme) return; // Skip if same theme
    
    this.applyTheme(theme);
    localStorage.setItem('obs-theme', theme);
    this.cache.savedTheme = theme;
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.updateActiveThemeButton(theme);
  },

  updateActiveThemeButton(activeTheme) {
    if (!this.cache.buttons) return;
    
    this.cache.buttons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-theme') === activeTheme) {
        btn.classList.add('active');
      }
    });
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
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, PerformanceUtils, ErrorHandler };
} 