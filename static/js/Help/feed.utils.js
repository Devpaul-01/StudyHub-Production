/**
 * ============================================================================
 * FEED UTILITIES - COMPLETELY FIXED
 * Helper functions - no state, no DOM manipulation
 * Fixed: Added missing exports (openModal, closeModal), improved modal cleanup
 * ============================================================================
 */

/**
 * Format timestamp to human-readable relative time
 */
export function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Debounce function calls
 */
export function debounce(func, wait) {
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
 * Get loading skeleton HTML
 */
export function getLoadingSkeleton() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-text"></div>
      </div>
      <div class="skeleton-content"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-text"></div>
      </div>
      <div class="skeleton-content"></div>
    </div>
  `;
}

/**
 * Check if widget has data
 */
export function hasWidgetData(widgetData) {
  if (Array.isArray(widgetData)) return widgetData.length > 0;
  if (typeof widgetData === 'object') return Object.keys(widgetData).length > 0;
  return false;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Download resource helper
 */
export function downloadResource(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Navigate to profile page
 */
export function viewProfile(username) {
  if (typeof username === 'number') {
    window.location.href = `/profile/${username}`;
  } else {
    window.location.href = `/profile/${username}`;
  }
}

/**
 * Share post helper
 */
export async function sharePost(postId) {
  const shareData = {
    title: 'Check out this post on LearnHub',
    url: `${window.location.origin}/posts/${postId}`
  };
  
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      if (typeof showToast === 'function') {
        showToast('Post shared successfully!', 'success');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share error:', error);
      }
    }
  } else {
    navigator.clipboard.writeText(shareData.url);
    if (typeof showToast === 'function') {
      showToast('Link copied to clipboard!', 'success');
    }
  }
}

/**
 * Open Learnora assistant
 */
export function openLearnora(postId) {
  if (typeof showToast === 'function') {
    showToast('Learnora feature coming soon!', 'info');
  }
}

/**
 * Search tag helper
 */
export function searchTag(tag) {
  if (typeof showToast === 'function') {
    showToast(`Searching for tag: ${tag}`, 'info');
  }
  if (typeof navigateTo === 'function') {
    navigateTo('search');
  }
}

/**
 * Navigate to section helper
 */
export function navigateTo(section) {
  if (typeof window.navigateTo === 'function') {
    window.navigateTo(section);
  }
}

/**
 * Open modal - ADDED EXPORT
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close modal - ADDED EXPORT & ENHANCED CLEANUP
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    
    // Special cleanup for comment modal
    if (modalId === 'post-comments-modal') {
      // Import feedState dynamically to avoid circular dependency
      import('./feed.state.js').then(({ feedState }) => {
        feedState.clearCommentModalHistory();
      });
      
      // Import updatePreviousButton dynamically
      import('./feed.render.js').then(({ updatePreviousButton }) => {
        updatePreviousButton();
      });
      
      const commentInput = document.getElementById('commentInput');
      if (commentInput) {
        commentInput.value = '';
        delete commentInput.dataset.parentId;
        delete commentInput.dataset.postId;
      }
      
      const previewArea = document.getElementById('post-comments-preview-area');
      if (previewArea) {
        previewArea.innerHTML = '';
      }
    }
    
    // Cleanup for thread modal
    if (modalId === 'thread-view-modal') {
      const modalBody = modal.querySelector('#thread-details-content');
      if (modalBody) {
        modalBody.innerHTML = '';
      }
      delete modal.dataset.threadId;
      delete modal.dataset.type;
    }
    
    // Cleanup for refine modal
    if (modalId === 'post-refine-modal' || modalId === 'inline-post-refine-modal') {
      import('./feed.state.js').then(({ feedState }) => {
        feedState.clearRefinement();
      });
    }
    
    // Cleanup for fork modal
    if (modalId === 'post-fork-modal') {
      import('./feed.state.js').then(({ feedState }) => {
        feedState.clearForkTags();
      });
    }
    
    // Generic cleanup for other modals
    if (['post-comments-modal', 'thread-view-modal'].includes(modalId)) {
      const modalBody = modal.querySelector('.modal-body');
      if (modalBody && modalBody.id !== 'comments-container') {
        modalBody.innerHTML = '';
      }
    }
  }
}

/**
 * Toggle post options menu
 */
export function togglePostOptions(postId) {
  const optionsDiv = document.getElementById(`options-${postId}`);
  
  if (!optionsDiv) {
    console.warn(`Options menu not found for post ${postId}`);
    return;
  }
  
  // Close all other option menus
  document.querySelectorAll('.advanced-post-options').forEach(menu => {
    if (menu.id !== `options-${postId}`) {
      menu.classList.add('hidden');
    }
  });
  
  optionsDiv.classList.toggle('hidden');
}

/**
 * Set button loading state - NEW HELPER
 */
export function setButtonLoading(button, isLoading, loadingText = 'Loading...') {
  if (!button) return;
  
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `
      <span class="spinner-small"></span>
      ${loadingText}
    `;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Submit';
    delete button.dataset.originalText;
  }
}

/**
 * Create empty state component - NEW HELPER
 */
export function createEmptyState(config = {}) {
  const {
    icon = '📭',
    title = 'Nothing here yet',
    message = 'Be the first to create something!',
    actionText = null,
    actionHandler = null
  } = config;
  
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h3 class="empty-title">${title}</h3>
      <p class="empty-message">${message}</p>
      ${actionText ? `
        <button class="btn btn-primary" data-action="${actionHandler}">
          ${actionText}
        </button>
      ` : ''}
    </div>
  `;
}

// Export for global use
if (typeof window !== 'undefined') {
  window.viewProfile = viewProfile;
  window.downloadResource = downloadResource;
  window.openModal = openModal;
  window.closeModal = closeModal;
}