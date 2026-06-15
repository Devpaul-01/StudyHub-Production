/**
 * ============================================================================
 * StudyHub API Client
 * Handles all HTTP requests with automatic token management
 * ============================================================================
 */

const API_BASE_URL = '/student'; // Base URL for all student endpoints

/**
 * API Client Class
 */
class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  /**
   * Get authentication token from cookie
   */
  getToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token') {
        return value;
      }
    }
    return null;
  }
  
  /**
 * Get default headers for requests
 */
getHeaders(isJSON = true) {
    const headers = {};
    
    // Add token if available
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add Content-Type for JSON requests
    if (isJSON) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
}
  /**
   * Handle API response
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    
    // Parse JSON response
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      // Check for errors
      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }
      
      return data;
    }
    
    // Handle non-JSON responses
    if (!response.ok) {
      throw new Error('Request failed');
    }
    
    return response;
  }

  /**
   * GET request
   */
  async get(endpoint, params = {}) {
    // Build query string
    const queryString = Object.keys(params).length > 0
      ? '?' + new URLSearchParams(params).toString()
      : '';
    
    const url = `${this.baseURL}${endpoint}${queryString}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'same-origin' // Include cookies
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('GET request failed:', error);
      throw error;
    }
  }

  /**
   * POST request
   */
  async post(endpoint, data = {}, isFormData = false) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const options = {
        method: 'POST',
        credentials: 'same-origin',
        headers: this.getHeaders(!isFormData)
      };
      
      // Handle FormData or JSON
      if (isFormData) {
        options.body = data;
      } else {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(url, options);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('POST request failed:', error);
      throw error;
    }
  }

  /**
   * PATCH request (for updates)
   */
  async patch(endpoint, data = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(data)
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('PATCH request failed:', error);
      throw error;
    }
  }

  /**
   * DELETE request
   */
  async delete(endpoint) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
        credentials: 'same-origin'
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('DELETE request failed:', error);
      throw error;
    }
  }

  /**
   * Upload file (multipart/form-data)
   */
  async uploadFile(endpoint, fileInput, additionalData = {}) {
    const formData = new FormData();
    
    // Add file
    if (fileInput.files && fileInput.files[0]) {
      formData.append('file', fileInput.files[0]);
    }
    
    // Add additional data
    for (const [key, value] of Object.entries(additionalData)) {
      formData.append(key, value);
    }
    
    return await this.post(endpoint, formData, true);
  }
}

// Create global API instance
const api = new APIClient(API_BASE_URL);

/**
 * ============================================================================
 * AUTHENTICATION HELPERS
 * ============================================================================
 */

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return api.getToken() !== null;
}
/**
 * Redirect to login if not authenticated
 */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/student/login';
    return false;
  }
  return true;
}

/**
 * Logout user
 */
async function logout() {
  try {
    await api.post('/logout');
    window.location.href = '/student/login';
  } catch (error) {
    console.error('Logout failed:', error);
    // Force logout even if request fails
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/student/login';
  }
}

/**
 * ============================================================================
 * UI HELPER FUNCTIONS
 * ============================================================================
 */


/**
 * Show loading spinner on button
 */
function setButtonLoading(button, isLoading, originalText = '') {
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner"></span> Loading...';
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalText || originalText;
    button.disabled = false;
  }
}


/**
 * Debounce function (for search, etc.)
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Validate email
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate username
 */
function isValidUsername(username) {
  const regex = /^[a-z0-9]{3,20}$/;
  return regex.test(username);
}

/**
 * ============================================================================
 * ERROR HANDLING
 * ============================================================================
 */

/**
 * Global error handler
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showToast('An error occurred. Please try again.', 'error');
});

/**
 * Handle API errors
 */
function handleAPIError(error) {
  console.error('API Error:', error);
  
  if (error.message.includes('401') || error.message.includes('Authentication')) {
    showToast('Session expired. Please login again.', 'error');
    setTimeout(() => {
      window.location.href = '/student/login';
    }, 2000);
  } else {
    showToast(error.message || 'Something went wrong', 'error');
  }
}

/**
 * ============================================================================
 * StudyHub - Toast Notification System
 * Beautiful, customizable toast notifications
 * ============================================================================
 */

class ToastManager {
    constructor() {
        this.toasts = [];
        this.maxToasts = 3;
        this.defaultDuration = 3000;
        this.container = null;
        this.init();
    }

    /**
     * Initialize toast container
     */
    init() {
        // Create container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
            
            // Add styles
            this.addStyles();
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    /**
     * Add CSS styles for toasts
     */
    addStyles() {
        if (document.getElementById('toast-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            }

            .toast {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                font-family: 'Inter', sans-serif;
                font-weight: 600;
                font-size: 0.95rem;
                max-width: 400px;
                min-width: 250px;
                pointer-events: auto;
                cursor: pointer;
                transition: all 0.3s ease;
                animation: slideIn 0.3s ease;
            }

            .toast:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
            }

            .toast-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
                line-height: 1;
            }

            .toast-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .toast-title {
                font-weight: 700;
                font-size: 1rem;
            }

            .toast-message {
                font-weight: 400;
                opacity: 0.95;
                font-size: 0.9rem;
                line-height: 1.4;
            }

            .toast-close {
                background: none;
                border: none;
                color: inherit;
                opacity: 0.6;
                cursor: pointer;
                font-size: 1.25rem;
                line-height: 1;
                padding: 0;
                margin-left: 8px;
                transition: opacity 0.2s;
                flex-shrink: 0;
            }

            .toast-close:hover {
                opacity: 1;
            }

            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 0 0 12px 12px;
                animation: progressBar var(--duration) linear;
            }

            /* Toast Types */
            .toast-success {
                background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                color: white;
            }

            .toast-error {
                background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
                color: white;
            }

            .toast-warning {
                background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
                color: white;
            }

            .toast-info {
                background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
                color: white;
            }

            /* Animations */
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }

            @keyframes progressBar {
                from {
                    width: 100%;
                }
                to {
                    width: 0%;
                }
            }

            /* Responsive */
            @media (max-width: 768px) {
                .toast-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                }
                .toast {
                    max-width: 100%;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {object} options - Configuration options
     */
    show(message, options = {}) {
        const config = {
            type: options.type || 'info',
            title: options.title || null,
            duration: options.duration || this.defaultDuration,
            closeable: options.closeable !== false,
            showProgress: options.showProgress !== false,
            onClick: options.onClick || null,
            onClose: options.onClose || null
        };

        // Remove oldest toast if at max capacity
        if (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0].element);
        }

        // Create toast element
        const toast = this.createToast(message, config);

        // Add to container
        this.container.appendChild(toast.element);
        this.toasts.push(toast);

        // Auto-remove after duration
        if (config.duration > 0) {
            toast.timeout = setTimeout(() => {
                this.remove(toast.element);
            }, config.duration);
        }

        return toast;
    }

    /**
     * Create toast element
     * @param {string} message - Message text
     * @param {object} config - Configuration
     * @returns {object} Toast object
     */
    createToast(message, config) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${config.type}`;

        // Icon mapping
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        // Build content
        let content = `
            <span class="toast-icon">${icons[config.type] || icons.info}</span>
            <div class="toast-content">
        `;

        if (config.title) {
            content += `<div class="toast-title">${config.title}</div>`;
        }

        content += `
                <div class="toast-message">${message}</div>
            </div>
        `;

        if (config.closeable) {
            content += '<button class="toast-close" aria-label="Close">×</button>';
        }

        toast.innerHTML = content;

        // Add progress bar
        if (config.showProgress && config.duration > 0) {
            const progress = document.createElement('div');
            progress.className = 'toast-progress';
            progress.style.setProperty('--duration', `${config.duration}ms`);
            toast.appendChild(progress);
        }

        // Event listeners
        if (config.closeable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.remove(toast);
            });
        }

        if (config.onClick) {
            toast.style.cursor = 'pointer';
            toast.addEventListener('click', () => {
                config.onClick();
                this.remove(toast);
            });
        }

        return {
            element: toast,
            timeout: null,
            config
        };
    }

    /**
     * Remove a toast
     * @param {HTMLElement} toastElement - Toast element to remove
     */
    remove(toastElement) {
        const toastIndex = this.toasts.findIndex(t => t.element === toastElement);
        if (toastIndex === -1) return;

        const toast = this.toasts[toastIndex];

        // Clear timeout
        if (toast.timeout) {
            clearTimeout(toast.timeout);
        }

        // Animate out
        toastElement.style.animation = 'slideOut 0.3s ease';

        setTimeout(() => {
            toastElement.remove();
            this.toasts.splice(toastIndex, 1);

            // Call onClose callback
            if (toast.config.onClose) {
                toast.config.onClose();
            }
        }, 300);
    }

    /**
     * Clear all toasts
     */
    clearAll() {
        this.toasts.forEach(toast => {
            if (toast.timeout) clearTimeout(toast.timeout);
            toast.element.remove();
        });
        this.toasts = [];
    }

    /**
     * Convenience methods
     */
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }

    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error' });
    }

    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    }

    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }

    /**
     * Show loading toast (no auto-dismiss)
     * @param {string} message - Loading message
     * @returns {object} Toast object (call .remove() to dismiss)
     */
    loading(message = 'Loading...') {
        return this.show(message, {
            type: 'info',
            duration: 0,
            showProgress: false,
            closeable: false
        });
    }

    /**
     * Show promise toast (updates based on promise state)
     * @param {Promise} promise - Promise to track
     * @param {object} messages - Messages for different states
     */
    async promise(promise, messages = {}) {
        const config = {
            loading: messages.loading || 'Loading...',
            success: messages.success || 'Success!',
            error: messages.error || 'Failed!'
        };

        // Show loading toast
        const loadingToast = this.loading(config.loading);

        try {
            const result = await promise;
            
            // Remove loading toast
            this.remove(loadingToast.element);
            
            // Show success toast
            this.success(config.success);
            
            return result;
        } catch (error) {
            // Remove loading toast
            this.remove(loadingToast.element);
            
            // Show error toast
            this.error(config.error);
            
            throw error;
        }
    }
}

// Initialize global toast instance
let toastInstance;

/**
 * Simple showToast function - main entry point
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    // Ensure toast is initialized
    if (!toastInstance) {
        toastInstance = new ToastManager();
    }
    
    return toastInstance.show(message, { type, duration });
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ToastManager, showToast };
}