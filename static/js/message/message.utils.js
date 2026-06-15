/**
 * Message System Utilities — PRODUCTION
 * Pure helper functions — no side-effects, no DOM access.
 */

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Short time label for conversation list rows.
 * Today         → "8:19 AM"
 * Yesterday     → "Yesterday"
 * This week     → "Mon", "Tue", …
 * This year     → "Mar 5"
 * Older         → "Mar 5, 2023"
 */
export function formatConversationTime(timestamp) {
  if (!timestamp) return '';
  const date      = new Date(timestamp);
  const now       = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    // Today — show clock time
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays < 7) {
    // Within the last week — show day name
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const diff    = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  const weeks   = Math.floor(days / 7);
  const months  = Math.floor(days / 30);
  const years   = Math.floor(days / 365);

  if (seconds < 60)  return 'Just now';
  if (minutes < 60)  return `${minutes}m ago`;
  if (hours   < 24)  return `${hours}h ago`;
  if (days    < 7)   return `${days}d ago`;
  if (weeks   < 4)   return `${weeks}w ago`;
  if (months  < 12)  return `${months}mo ago`;
  return `${years}y ago`;
}

/**
 * Short human-readable time for message bubbles.
 * Today → "3:42 PM"
 * Yesterday → "Yesterday 3:42 PM"
 * This year → "Mar 5  3:42 PM"
 * Older → "Mar 5, 2023  3:42 PM"
 */
export function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date      = new Date(timestamp);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  if (date.toDateString() === today.toDateString())     return timeStr;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;

  const dateOpts = date.getFullYear() === today.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' };

  return `${date.toLocaleDateString('en-US', dateOpts)}  ${timeStr}`;
}

// ============================================================================
// FILE HANDLING
// ============================================================================

export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function isValidFileType(file) {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  return allowed.includes(file.type);
}

export function isValidFileSize(file, maxSizeMB = 50) {
  return file.size <= maxSizeMB * 1024 * 1024;
}

export function getFileCategory(file) {
  if (file.type.startsWith('image/'))  return 'image';
  if (file.type.startsWith('video/'))  return 'video';
  if (file.type.startsWith('audio/'))  return 'audio';
  if (file.type === 'application/pdf') return 'pdf';
  if (
    file.type.includes('word') ||
    file.type.includes('powerpoint') ||
    file.type.includes('excel') ||
    file.type.includes('spreadsheet')
  ) return 'document';
  return 'file';
}

// ============================================================================
// TEXT UTILITIES
// ============================================================================

export function truncateText(text, maxLength = 50) {
  if (!text) return '';
  return text.length <= maxLength ? text : `${text.substring(0, maxLength)}…`;
}

export function linkifyText(text) {
  if (!text) return '';
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

export function sanitizeMessageBody(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return linkifyText(div.innerHTML);
}

// ============================================================================
// SCROLL UTILITIES
// ============================================================================

export function scrollToBottom(element, smooth = true) {
  if (!element) return;
  element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

export function isScrolledToBottom(element, threshold = 60) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

export function isScrolledToTop(element, threshold = 50) {
  if (!element) return false;
  return element.scrollTop < threshold;
}

// ============================================================================
// DEBOUNCE / THROTTLE
// ============================================================================

export function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================================
// ID GENERATION
// ============================================================================

export function generateMessageId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function generateFileId() {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// MESSAGE GROUPING
// ============================================================================

export function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate  = null;
  let currentGroup = [];

  messages.forEach(message => {
    const msgDate = new Date(message.sent_at).toDateString();
    if (msgDate !== currentDate) {
      if (currentGroup.length > 0) groups.push({ date: currentDate, messages: currentGroup });
      currentDate  = msgDate;
      currentGroup = [message];
    } else {
      currentGroup.push(message);
    }
  });

  if (currentGroup.length > 0) groups.push({ date: currentDate, messages: currentGroup });
  return groups;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidMessageBody(body, maxLength = 5000) {
  if (!body || typeof body !== 'string') return false;
  if (body.trim().length === 0) return false;
  if (body.length > maxLength) return false;
  return true;
}

export function canDeleteForEveryone(sentAt) {
  if (!sentAt) return false;
  return (Date.now() - new Date(sentAt).getTime()) < 5 * 60 * 1000;
}

// ============================================================================
// DRAFTS  (localStorage)
// ============================================================================

export function saveDraft(partnerId, text) {
  try {
    const drafts = JSON.parse(localStorage.getItem('msg_drafts') || '{}');
    drafts[partnerId] = text;
    localStorage.setItem('msg_drafts', JSON.stringify(drafts));
  } catch { /* storage might be unavailable */ }
}

export function getDraft(partnerId) {
  try {
    const drafts = JSON.parse(localStorage.getItem('msg_drafts') || '{}');
    return drafts[partnerId] || '';
  } catch {
    return '';
  }
}

export function clearDraft(partnerId) {
  try {
    const drafts = JSON.parse(localStorage.getItem('msg_drafts') || '{}');
    delete drafts[partnerId];
    localStorage.setItem('msg_drafts', JSON.stringify(drafts));
  } catch { /* ignore */ }
}

// ============================================================================
// NETWORK STATUS
// ============================================================================

export function isOnline() {
  return navigator.onLine;
}

export function watchNetworkStatus(onOnline, onOffline) {
  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online',  onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

// ============================================================================
// PAGE VISIBILITY
// ============================================================================

export function isPageVisible() {
  return document.visibilityState === 'visible';
}

export function watchVisibility(callback) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}
