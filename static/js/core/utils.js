
/** * ============================================================================ * StudyHub - Core Utilities * Helper functions used across the application * ============================================================================ */
/**
============================================================================
DATE & TIME FORMATTING
============================================================================
*/
/**
Format date to relative time (e.g., "2h ago", "3 days ago")
@param {string|Date} dateString - Date to format
@returns {string} Formatted relative time
*/
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Less than a minute
    if (diff < 60000) {
        return 'Just now';
    }
    
    // Less than an hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;  // ✅ Fixed
    }
    
    // Less than a day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;  // ✅ Fixed
    }
    
    // Less than a week
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;  // ✅ Fixed
    }
    
    // Less than a month
    if (diff < 2592000000) {
        const weeks = Math.floor(diff / 604800000);
        return `${weeks}w ago`;  // ✅ Fixed
    }
    
    // Format as date
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}
/**
Format date to full readable format
@param {string|Date} dateString - Date to format
@returns {string} Formatted date (e.g., "January 15, 2024")
*/
function formatFullDate(dateString) {
const date = new Date(dateString);
return date.toLocaleDateString('en-US', {
month: 'long',
day: 'numeric',
year: 'numeric'
});
}
/**
Format time (e.g., "3:45 PM")
@param {string|Date} dateString - Date to format
@returns {string} Formatted time
*/
function formatTime(dateString) {
const date = new Date(dateString);
return date.toLocaleTimeString('en-US', {
hour: 'numeric',
minute: '2-digit',
hour12: true
});
}
/**
============================================================================
VALIDATION FUNCTIONS
============================================================================
*/
/**
Validate email format
@param {string} email - Email to validate
@returns {boolean} True if valid
*/
function isValidEmail(email) {
const regex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
return regex.test(email);
}
/**
Validate username format (3-20 chars, lowercase alphanumeric)
@param {string} username - Username to validate
@returns {boolean} True if valid
*/
function isValidUsername(username) {
const regex = /^[a-z0-9]{3,20}$/;
return regex.test(username);
}
/**
Validate password strength
@param {string} password - Password to check
@returns {object} { strength: string, score: number, feedback: string }
*/
function checkPasswordStrength(password) {
let score = 0;
let feedback = [];
// Length check
if (password.length >= 6) score++;
if (password.length >= 10) score++;
if (password.length >= 14) score++;
// Character variety
if (/[a-z]/.test(password)) score++;
if (/[A-Z]/.test(password)) score++;
if (/[0-9]/.test(password)) score++;
if (/[^a-zA-Z0-9]/.test(password)) score++;
// Determine strength
let strength = 'weak';
if (score <= 3) {
strength = 'weak';
feedback.push('Use at least 8 characters');
feedback.push('Mix uppercase and lowercase');
} else if (score <= 5) {
strength = 'medium';
feedback.push('Add numbers or symbols for better security');
} else {
strength = 'strong';
feedback.push('Great password!');
}
return {
strength,
score,
feedback: feedback[0] || 'Enter a password'
};
}
/**
============================================================================
UI HELPER FUNCTIONS
============================================================================
*/
/**
Show loading spinner on button
@param {HTMLElement} button - Button element
@param {boolean} isLoading - Show/hide loading state
@param {string} loadingText - Text to show while loading
*/
function setButtonLoading(button, isLoading, loadingText = 'Loading...') {
if (!button) return;
if (isLoading) {
// Store original content
button.dataset.originalContent = button.innerHTML;
button.dataset.originalDisabled = button.disabled;
// Set loading state
button.innerHTML = `<span class="spinner"></span> ${loadingText}`;
button.disabled = true;
button.classList.add('loading');
} else {
// Restore original state
button.innerHTML = button.dataset.originalContent || button.innerHTML;
button.disabled = button.dataset.originalDisabled === 'true';
button.classList.remove('loading');
}
}
/**
Show loading state on element
@param {HTMLElement} element - Element to show loading on
@param {boolean} isLoading - Show/hide loading
*/
function setElementLoading(element, isLoading) {
if (!element) return;
if (isLoading) {
element.classList.add('loading');
element.style.opacity = '0.6';
element.style.pointerEvents = 'none';
} else {
element.classList.remove('loading');
element.style.opacity = '1';
element.style.pointerEvents = 'auto';
}
}
/**
Smooth scroll to element
@param {HTMLElement|string} target - Element or selector
@param {number} offset - Offset from top in pixels
*/
function scrollToElement(target, offset = 0) {
const element = typeof target === 'string'
? document.querySelector(target)
: target;
if (!element) return;
const elementPosition = element.getBoundingClientRect().top;
const offsetPosition = elementPosition + window.pageYOffset - offset;
window.scrollTo({
top: offsetPosition,
behavior: 'smooth'
});
}
/**
============================================================================
STRING MANIPULATION
============================================================================
*/
/**
Truncate text to specified length
@param {string} text - Text to truncate
@param {number} length - Max length
@param {string} suffix - Suffix to add (default: '...')
@returns {string} Truncated text
*/
function truncateText(text, length, suffix = '...') {
if (!text || text.length <= length) return text;
return text.substring(0, length).trim() + suffix;
}
/**
Escape HTML to prevent XSS
@param {string} text - Text to escape
@returns {string} Escaped text
*/
function escapeHtml(text) {
const map = {
'&': '&',
'<': '<',
'>': '>',
'"': '"',
"'": '''
};
return text.replace(/[&<>"']/g, m => map[m]);
}
/**
Convert text to URL-friendly slug
@param {string} text - Text to slugify
@returns {string} URL-friendly slug
*/
function slugify(text) {
return text
.toString()
.toLowerCase()
.trim()
.replace(/\s+/g, '-')
.replace(/[^\w-]+/g, '')
.replace(/--+/g, '-')
.replace(/^-+/, '')
.replace(/-+$/, '');
}
/**
Capitalize first letter of string
@param {string} text - Text to capitalize
@returns {string} Capitalized text
*/
function capitalize(text) {
if (!text) return '';
return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
/**
============================================================================
DEBOUNCE & THROTTLE
============================================================================
*/
/**
Debounce function execution
@param {Function} func - Function to debounce
@param {number} wait - Wait time in milliseconds
@returns {Function} Debounced function
*/
function debounce(func, wait = 300) {
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
Throttle function execution
@param {Function} func - Function to throttle
@param {number} limit - Time limit in milliseconds
@returns {Function} Throttled function
*/
function throttle(func, limit = 300) {
let inThrottle;
return function(...args) {
if (!inThrottle) {
func.apply(this, args);
inThrottle = true;
setTimeout(() => inThrottle = false, limit);
}
};
}
/**
============================================================================
LOCAL STORAGE HELPERS
============================================================================
*/
/**
Store data in localStorage with JSON encoding
@param {string} key - Storage key
@param {any} value - Value to store
*/
function storeLocal(key, value) {
try {
localStorage.setItem(key, JSON.stringify(value));
} catch (error) {
console.error('localStorage error:', error);
}
}
/**
Get data from localStorage with JSON decoding
@param {string} key - Storage key
@param {any} defaultValue - Default value if not found
@returns {any} Stored value or default
*/
function getLocal(key, defaultValue = null) {
try {
const item = localStorage.getItem(key);
return item ? JSON.parse(item) : defaultValue;
} catch (error) {
console.error('localStorage error:', error);
return defaultValue;
}
}
/**
Remove item from localStorage
@param {string} key - Storage key
*/
function removeLocal(key) {
try {
localStorage.removeItem(key);
} catch (error) {
console.error('localStorage error:', error);
}
}
/**
Clear all localStorage
*/
function clearLocal() {
try {
localStorage.clear();
} catch (error) {
console.error('localStorage error:', error);
}
}
/**
============================================================================
FILE HANDLING
============================================================================
*/
/**
Format file size to human-readable format
@param {number} bytes - File size in bytes
@returns {string} Formatted size (e.g., "2.5 MB")
*/
function formatFileSize(bytes) {
if (bytes === 0) return '0 Bytes';
const k = 1024;
const sizes = ['Bytes', 'KB', 'MB', 'GB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
/**
Get file extension from filename
@param {string} filename - Filename
@returns {string} Extension (lowercase)
*/
function getFileExtension(filename) {
return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
}
/**
Check if file is image
@param {string} filename - Filename or extension
@returns {boolean} True if image
*/
function isImageFile(filename) {
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const ext = getFileExtension(filename);
return imageExtensions.includes(ext);
}
/**
Check if file is video
@param {string} filename - Filename or extension
@returns {boolean} True if video
*/
function isVideoFile(filename) {
const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
const ext = getFileExtension(filename);
return videoExtensions.includes(ext);
}
/**
============================================================================
ARRAY HELPERS
============================================================================
*/
/**
Remove duplicates from array
@param {Array} array - Array with duplicates
@returns {Array} Array without duplicates
*/
function uniqueArray(array) {
return [...new Set(array)];
}
/**
Chunk array into smaller arrays
@param {Array} array - Array to chunk
@param {number} size - Chunk size
@returns {Array} Array of chunks
*/
function chunkArray(array, size) {
const chunks = [];
for (let i = 0; i < array.length; i += size) {
chunks.push(array.slice(i, i + size));
}
return chunks;
}
/**
Shuffle array randomly
@param {Array} array - Array to shuffle
@returns {Array} Shuffled array
*/
function shuffleArray(array) {
const shuffled = [...array];
for (let i = shuffled.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
return shuffled;
}
/**
============================================================================
URL HELPERS
============================================================================
*/
/**
Get query parameter from URL
@param {string} param - Parameter name
@returns {string|null} Parameter value
*/
function getUrlParam(param) {
const urlParams = new URLSearchParams(window.location.search);
return urlParams.get(param);
}
/**
Update URL without page reload
@param {string} url - New URL
@param {string} title - Page title
*/
function updateUrl(url, title = '') {
window.history.pushState({}, title, url);
}
/**
Copy text to clipboard
@param {string} text - Text to copy
@returns {Promise} Success status
*/
async function copyToClipboard(text) {
try {
await navigator.clipboard.writeText(text);
showToast('Copied to clipboard!', 'success', 2000);
return true;
} catch (error) {
console.error('Clipboard error:', error);
showToast('Failed to copy', 'error');
return false;
}
}
/**
============================================================================
FORM HELPERS
============================================================================
*/
/**
Get form data as object
@param {HTMLFormElement} form - Form element
@returns {Object} Form data as key-value pairs
*/
function getFormData(form) {
const formData = new FormData(form);
const data = {};
for (const [key, value] of formData.entries()) {
// Handle multiple values (checkboxes with same name)
if (data[key]) {
if (!Array.isArray(data[key])) {
data[key] = [data[key]];
}
data[key].push(value);
} else {
data[key] = value;
}
}
return data;
}
/**
Reset form and clear errors
@param {HTMLFormElement} form - Form element
*/
function resetForm(form) {
form.reset();
// Clear error messages
form.querySelectorAll('.form-error').forEach(error => {
error.classList.add('hidden');
error.textContent = '';
});
// Remove error classes from inputs
form.querySelectorAll('.form-input, .form-textarea, .form-select').forEach(input => {
input.classList.remove('error');
});
}
/**
Show field error
@param {string} fieldId - Field ID
@param {string} message - Error message
*/
function showFieldError(fieldId, message) {
const field = document.getElementById(fieldId);
const errorSpan = document.getElementById(${fieldId}_error);
if (field) {
field.classList.add('error');
}
if (errorSpan) {
errorSpan.classList.remove('hidden');
errorSpan.textContent = message;
}
}
/**
Clear field error
@param {string} fieldId - Field ID
*/
function clearFieldError(fieldId) {
const field = document.getElementById(fieldId);
const errorSpan = document.getElementById(${fieldId}_error);
if (field) {
field.classList.remove('error');
}
if (errorSpan) {
errorSpan.classList.add('hidden');
errorSpan.textContent = '';
}
}
/**
============================================================================
EXPORT (for modules)
============================================================================
*/
// If using modules, export functions
if (typeof module !== 'undefined' && module.exports) {
module.exports = {
formatDate,
formatFullDate,
formatTime,
isValidEmail,
isValidUsername,
checkPasswordStrength,
setElementLoading,
scrollToElement,
truncateText,
escapeHtml,
slugify,
capitalize,
debounce,
throttle,
storeLocal,
getLocal,
removeLocal,
clearLocal,
formatFileSize,
getFileExtension,
isImageFile,
isVideoFile,
uniqueArray,
chunkArray,
shuffleArray,
getUrlParam,
updateUrl,
copyToClipboard,
getFormData,
resetForm,
showFieldError,
clearFieldError
};
}




3️⃣ Modal Component
�
/** * ============================================================================ * StudyHub - Reusable Modal Component * Flexible modal system with various configurations * ============================================================================ */
class Modal {
constructor(options = {}) {
this.config = {
id: options.id || modal-${Date.now()},
title: options.title || '',
content: options.content || '',
size: options.size || 'medium', // small, medium, large, full
closeable: options.closeable !== false,
closeOnOverlay: options.closeOnOverlay !== false,
closeOnEscape: options.closeOnEscape !== false,
showFooter: options.showFooter !== false,
buttons: options.buttons || [],
onOpen: options.onOpen || null,
onClose: options.onClose || null,
customClass: options.customClass || ''
};
this.element = null;
this.isOpen = false;
this.create();
}
/**
Create modal element
*/
create() {
// Create overlay
const overlay = document.createElement('div');
overlay.className = 'modal-overlay hidden';
overlay.id = this.config.id;
if (this.config.customClass) {
overlay.classList.add(this.config.customClass);
}
// Create modal
const modal = document.createElement('div');
modal.className = `modal modal-${this.config.size}`;

// Prevent click propagation
modal.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Build modal content
let modalHTML = '';

// Header
if (this.config.title || this.config.closeable) {
  modalHTML += `
    <div class="modal-header">
      <h3 class="modal-title">${this.config.title}</h3>
      ${this.config.closeable ? '<button class="modal-close" data-modal-close>&times;</button>' : ''}
    </div>
  `;
}

// Body
modalHTML += `
  <div class="modal-body">
    ${this.config.content}
  </div>
`;

// Footer
if (this.config.showFooter && this.config.buttons.length > 0) {
  modalHTML += '<div class="modal-footer">';
  this.config.buttons.forEach(button => {
    const btnClass = button.class || 'btn-secondary';
    const btnText = button.text || 'Button';
    const btnId = button.id || '';
    modalHTML += `
      <button class="btn ${btnClass}" ${btnId ? `id="${btnId}"` : ''} data-modal-action="${button.action || ''}">
        ${btnText}
      </button>
    `;
  });
  modalHTML += '</div>';
}

modal.innerHTML = modalHTML;
overlay.appendChild(modal);

// Add event listeners
this.attachEventListeners(overlay);

// Add to DOM
document.body.appendChild(overlay);
this.element = overlay;

return this;
}
/**
Attach event listeners
*/
attachEventListeners(overlay) {
// Close on overlay click
if (this.config.closeOnOverlay) {
overlay.addEventListener('click', (e) => {
if (e.target === overlay) {
this.close();
}
});
}
// Close button
const closeBtn = overlay.querySelector('[data-modal-close]');
if (closeBtn) {
  closeBtn.addEventListener('click', () => this.close());
}

// Action buttons
const actionBtns = overlay.querySelectorAll('[data-modal-action]');
actionBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const action = btn.dataset.modalAction;
    const button = this.config.buttons.find(b => b.action === action);
    
    if (button && button.onClick) {
      const shouldClose = button.onClick(e);
      if (shouldClose !== false) {
        this.close();
      }
    }
  });
});

// Escape key
if (this.config.closeOnEscape) {
  this.escapeHandler = (e) => {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  };
  document.addEventListener('keydown', this.escapeHandler);
}
}
/**
Open modal
*/
open() {
if (this.isOpen) return;
this.element.classList.remove('hidden');
this.isOpen = true;

// Prevent body scroll
document.body.style.overflow = 'hidden';

// Call onOpen callback
if (this.config.onOpen) {
  this.config.onOpen(this);
}

// Focus first input
setTimeout(() => {
  const firstInput = this.element.querySelector('input, textarea, select');
  if (firstInput) {
    firstInput.focus();
  }
}, 100);

return this;
}
/**
Close modal
*/
close() {
if (!this.isOpen) return;
this.element.classList.add('hidden');
this.isOpen = false;

// Restore body scroll
document.body.style.overflow = '';

// Call onClose callback
if (this.config.onClose) {
  this.config.onClose(this);
}

return this;
}
/**
Toggle modal
*/
toggle() {
return this.isOpen ? this.close() : this.open();
}
/**
Update modal content
*/
setContent(content) {
const body = this.element.querySelector('.modal-body');
if (body) {
body.innerHTML = content;
}
return this;
}
/**
Update modal title
*/
setTitle(title) {
const titleElement = this.element.querySelector('.modal-title');
if (titleElement) {
titleElement.textContent = title;
}
return this;
}
/**
Show loading state
*/
setLoading(isLoading, message = 'Loading...') {
const body = this.element.querySelector('.modal-body');
if (!body) return;
if (isLoading) {
  body.innerHTML = `
    <div class="text-center" style="padding: var(--spacing-2xl);">
      <div class="spinner spinner-primary" style="width: 40px; height: 40px; margin: 0 auto var(--spacing-md);"></div>
      <p class="text-muted">${message}</p>
    </div>
  `;
}

return this;
}
/**
Destroy modal
*/
destroy() {
this.close();
// Remove event listeners
if (this.escapeHandler) {
  document.removeEventListener('keydown', this.escapeHandler);
}

// Remove element
if (this.element) {
  this.element.remove();
}

return this;
}
}
/**
============================================================================
MODAL PRESETS - Quick modal creation
============================================================================
*/
/**
Alert modal (OK button only)
*/
function modalAlert(title, message, options = {}) {
return new Modal({
title: title,
content: <p>${message}</p>,
size: 'small',
buttons: [
{
text: options.buttonText || 'OK',
class: 'btn-primary',
action: 'ok',
onClick: options.onOk || null
}
],
...options
}).open();
}
/**
Confirm modal (Yes/No buttons)
*/
function modalConfirm(title, message, options = {}) {
return new Promise((resolve) => {
new Modal({
title: title,
content: <p>${message}</p>,
size: 'small',
buttons: [
{
text: options.cancelText || 'Cancel',
class: 'btn-secondary',
action: 'cancel',
onClick: () => {
resolve(false);
}
},
{
text: options.confirmText || 'Confirm',
class: options.confirmClass || 'btn-primary',
action: 'confirm',
onClick: () => {
resolve(true);
}
}
],
onClose: () => resolve(false),
...options
}).open();
});
}
/**
Prompt modal (input field)
*/
function modalPrompt(title, message, options = {}) {
return new Promise((resolve) => {
const inputId = prompt-input-${Date.now()};
const modal = new Modal({
title: title,
content: <p>${message}</p> <div class="form-group" style="margin-top: var(--spacing-lg);"> <input type="text"  id="${inputId}"  class="form-input"  placeholder="${options.placeholder || ''}" value="${options.defaultValue || ''}"> </div>,
size: 'small',
buttons: [
{
text: 'Cancel',
class: 'btn-secondary',
action: 'cancel',
onClick: () => {
resolve(null);
}
},
{
text: 'Submit',
class: 'btn-primary',
action: 'submit',
onClick: () => {
const input = document.getElementById(inputId);
resolve(input ? input.value : null);
}
}

],
onClose: () => resolve(null),
...options
}).open();
});
}
/**
Loading modal
*/
function modalLoading(message = 'Loading...') {
return new Modal({
content: `
�
${message}

`, size: 'small', closeable: false, closeOnOverlay: false, closeOnEscape: false, showFooter: false
}).open();
}
/**
Success modal
*/
function modalSuccess(title, message, options = {}) {
return modalAlert(
title,
`
�
✅

${message}

`, options
);
}
/**
Error modal
*/
function modalError(title, message, options = {}) {
return modalAlert(
title,
`
�
❌

${message}

`, options
);
}
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
module.exports = {
Modal,
modalAlert,
modalConfirm,
modalPrompt,
modalLoading,
modalSuccess,
modalError
};
}

4️⃣ Enhanced Components CSS
�
/* ============================================================================ StudyHub - Reusable Components CSS Buttons, badges, cards, modals, and more ============================================================================ */
/* ===== ENHANCED MODAL STYLES ===== */
.modal-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.6);
backdrop-filter: blur(4px);
display: flex;
align-items: center;
justify-content: center;
z-index: 1000;
animation: fadeIn 0.2s ease;
padding: var(--spacing-lg);
}
.modal {
background: white;
border-radius: var(--radius-lg);
box-shadow: var(--shadow-xl);
max-height: 90vh;
overflow-y: auto;
animation: slideUp 0.3s ease;
position: relative;
}
/* Modal Sizes */
.modal-small {
max-width: 400px;
width: 100%;
}
.modal-medium {
max-width: 600px;
width: 100%;
}
.modal-large {
max-width: 900px;
width: 100%;
}
.modal-full {
max-width: 95vw;
width: 100%;
max-height: 95vh;
}
/* Modal Parts */
.modal-header {
padding: var(--spacing-lg);
border-bottom: 2px solid var(--gray-100);
display: flex;
align-items: center;
justify-content: space-between;
position: sticky;
top: 0;
background: white;
z-index: 10;
border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.modal-title {
font-size: 1.5rem;
font-weight: 700;
margin: 0;
color: var(--gray-900);
}
.modal-close {
background: none;
border: none;
font-size: 2rem;
color: var(--gray-400);
cursor: pointer;
padding: 0;
width: 32px;
height: 32px;
display: flex;
align-items: center;
justify-content: center;
border-radius: var(--radius-sm);
transition: all var(--transition-fast);
line-height: 1;
}
.modal-close:hover {
background: var(--gray-100);
color: var(--gray-600);
}
.modal-body {
padding: var(--spacing-lg);
max-height: calc(90vh - 200px);
overflow-y: auto;
}
.modal-footer {
padding: var(--spacing-lg);
border-top: 2px solid var(--gray-100);
display: flex;
gap: var(--spacing-md);
justify-content: flex-end;
position: sticky;
bottom: 0;
background: white;
border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}
/* ===== LOADING SPINNER ===== */
.spinner {
display: inline-block;
width: 20px;
height: 20px;
border: 3px solid rgba(255, 255, 255, 0.3);
border-top-color: white;
border-radius: 50%;
animation: spin 0.8s linear infinite;
}
.spinner-primary {
border: 3px solid var(--gray-200);
border-top-color: var(--primary-blue);
}
.spinner-large {
width: 40px;
height: 40px;
border-width: 4px;
}
/* ===== LOADING STATES ===== */
.loading {
position: relative;
pointer-events: none;
}
.loading::after {
content: '';
position: absolute;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(255, 255, 255, 0.8);
display: flex;
align-items: center;
justify-content: center;
border-radius: inherit;
}
/* ===== SKELETON LOADERS ===== */
.skeleton {
background: linear-gradient(
90deg,
var(--gray-200) 25%,
var(--gray-100) 50%,
var(--gray-200) 75%
);
background-size: 200% 100%;
animation: skeleton-loading 1.5s ease-in-out infinite;
border-radius: var(--radius-sm);
}
@keyframes skeleton-loading {
0% {
background-position: 200% 0;
}
100% {
background-position: -200% 0;
}
}
.skeleton-text {
height: 16px;
margin-bottom: 8px;
border-radius: 4px;
}
.skeleton-text.short {
width: 60%;
}
.skeleton-avatar {
width: 48px;
height: 48px;
border-radius: 50%;
}
.skeleton-card {
height: 200px;
border-radius: var(--radius-lg);
}
/* ===== EMPTY STATES ===== */
.empty-state {
text-align: center;
padding: var(--spacing-2xl);
}
.empty-state-icon {
font-size: 4rem;
margin-bottom: var(--spacing-lg);
opacity: 0.3;
}
.empty-state-title {
font-size: 1.25rem;
font-weight: 700;
color: var(--gray-900);
margin-bottom: var(--spacing-sm);
}
.empty-state-message {
color: var(--gray-500);
margin-bottom: var(--spacing-lg);
}
/* ===== DROPDOWN MENU ===== */
.dropdown {
position: relative;
display: inline-block;
}
.dropdown-toggle {
cursor: pointer;
}
.dropdown-menu {
position: absolute;
top: calc(100% + 8px);
right: 0;
min-width: 200px;
background: white;
border-radius: var(--radius-md);
box-shadow: var(--shadow-lg);
padding: var(--spacing-sm);
z-index: 100;
animation: slideDown 0.2s ease;
}
.dropdown-menu.left {
right: auto;
left: 0;
}
.dropdown-item {
display: flex;
align-items: center;
gap: var(--spacing-sm);
padding: 10px 12px;
border-radius: var(--radius-sm);
text-decoration: none;
color: var(--gray-800);
font-size: 0.95rem;
transition: background var(--transition-fast);
cursor: pointer;
border: none;
background: none;
width: 100%;
text-align: left;
}
.dropdown-item:hover {
background: var(--gray-100);
}
.dropdown-item.danger {
color: var(--error-red);
}
.dropdown-divider {
margin: var(--spacing-sm) 0;
border: none;
border-top: 1px solid var(--gray-200);
}
/* ===== TABS ===== */
.tabs {
display: flex;
gap: var(--spacing-sm);
border-bottom: 2px solid var(--gray-200);
margin-bottom: var(--spacing-lg);
}
.tab {
padding: 12px 24px;
background: none;
border: none;
border-bottom: 2px solid transparent;
margin-bottom: -2px;
font-weight: 600;
color: var(--gray-500);
cursor: pointer;
transition: all var(--transition-fast);
}
.tab:hover {
color: var(--gray-700);
}
.tab.active {
color: var(--primary-blue);
border-bottom-color: var(--primary-blue);
}
.tab-content {
display: none;
}
.tab-content.active {
display: block;
animation: fadeIn 0.3s ease;
}
/* ===== PROGRESS BAR ===== */
.progress {
height: 8px;
background: var(--gray-200);
border-radius: var(--radius-full);
overflow: hidden;
}
.progress-bar {
height: 100%;
background: var(--primary-blue);
border-radius: var(--radius-full);
transition: width 0.3s ease;
background: linear-gradient(90deg, var(--primary-blue), var(--primary-blue-light));
}
.progress-bar.success {
background: linear-gradient(90deg, var(--success-green), #34D399);
}
.progress-bar.warning {
background: linear-gradient(90deg, var(--warning-orange), #FBBF24);
}
.progress-bar.error {
background: linear-gradient(90deg, var(--error-red), #F87171);
}
/* ===== TOOLTIPS ===== */
data-tooltip {
position: relative;
cursor: help;
}
data-tooltip::before {
content: attr(data-tooltip);
position: absolute;
bottom: calc(100% + 8px);
left: 50%;
transform: translateX(-50%);
padding: 8px 12px;
background: var(--gray-900);
color: white;
font-size: 0.875rem;
border-radius: var(--radius-sm);
white-space: nowrap;
opacity: 0;
pointer-events: none;
transition: opacity var(--transition-fast);
z-index: 1000;
}
data-tooltip::after {
content: '';
position: absolute;
bottom: calc(100% + 2px);
left: 50%;
transform: translateX(-50%);
border: 6px solid transparent;
border-top-color: var(--gray-900);
opacity: 0;
pointer-events: none;
transition: opacity var(--transition-fast);
}
data-tooltip:hover::after {
opacity: 1;
}
/* ===== AVATAR COMPONENT ===== */
.avatar {
display: inline-block;
position: relative;
}
.avatar-image {
width: 40px;
height: 40px;
border-radius: 50%;
object-fit: cover;
border: 2px solid white;
box-shadow: var(--shadow-sm);
}
.avatar-small .avatar-image {
width: 32px;
height: 32px;
}
.avatar-large .avatar-image {
width: 64px;
height: 64px;
}
.avatar-badge {
position: absolute;
bottom: 0;
right: 0;
width: 12px;
height: 12px;
border-radius: 50%;
border: 2px solid white;
}
.avatar-badge.online {
background: var(--success-green);
}
.avatar-badge.offline {
background: var(--gray-400);
}
.avatar-badge.busy {
background: var(--error-red);
}
/* ===== PAGINATION ===== */
.pagination {
display: flex;
gap: var(--spacing-sm);
align-items: center;
justify-content: center;
margin: var(--spacing-xl) 0;
}
.pagination-btn {
padding: 8px 16px;
background: white;
border: 2px solid var(--gray-200);
border-radius: var(--radius-md);
font-weight: 600;
color: var(--gray-700);
cursor: pointer;
transition: all var(--transition-fast);
}
.pagination-btn:hover:not(:disabled) {
border-color: var(--primary-blue);
color: var(--primary-blue);
}
.pagination-btn:disabled {
opacity: 0.4;
cursor: not-allowed;
}
.pagination-btn.active {
background: var(--primary-blue);
border-color: var(--primary-blue);
color: white;
}
/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
.modal {
max-height: 95vh;
}
.modal-header {
padding: var(--spacing-md);
}
.modal-body {
padding: var(--spacing-md);
}
.modal-footer {
padding: var(--spacing-md);
flex-direction: column;
}
.modal-footer .btn {
width: 100%;
}
}




  