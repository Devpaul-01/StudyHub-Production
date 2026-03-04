/**
 * ============================================================================
 * NOTIFICATION INITIALIZATION (REFINED)
 * Simplified version without cursor pagination and infinite scroll
 * ============================================================================
 */

import { loadNotifications, handleToggleNotification, handleToggleNotificationSound, toggleNotificationSettings } from './notification.events.js';
import { notificationState } from './notification.state.js';

// Pull-to-refresh variables
let startY      = null;
let currentY    = null;
let pulling     = false;
let refreshing  = false;

// ============================================================================
// INITIALIZE NOTIFICATION SYSTEM
// ============================================================================

let isInitialized = false;

function initializeNotifications() {
  // Prevent re-initialization
  if (isInitialized) return;
  isInitialized = true;

  // Load all notifications at once
  loadNotifications();

  // Setup change event listeners (toggles)
  setupNotificationToggles();

  // Setup pull-to-refresh
  setupPullToRefresh();

  // Setup click-outside to close settings
  setupClickOutsideHandler();

  console.log('✅ Notification system initialized');
}

// ============================================================================
// TOGGLE LISTENERS
// ============================================================================

function setupNotificationToggles() {
  const enableNotifToggle = document.getElementById('toggle-notification');
  if (enableNotifToggle) {
    enableNotifToggle.addEventListener('change', (e) => {
      handleToggleNotification(e.target.checked);
    });
  }

  const enableSoundToggle = document.getElementById('toggle-notification-sound');
  if (enableSoundToggle) {
    enableSoundToggle.addEventListener('change', (e) => {
      handleToggleNotificationSound(e.target.checked);
    });
  }
}

// ============================================================================
// CLICK-OUTSIDE HANDLER
// ============================================================================

function setupClickOutsideHandler() {
  /*
  document.addEventListener('click', (e) => {
    const settingsModal = document.getElementById('notification-settings-modal');
    const toggleButton = e.target.closest('[data-action="toggle-notification-options"]');

    if (settingsModal && !settingsModal.contains(e.target) && !toggleButton) {
      settingsModal.classList.add('hidden');
    }
  });
  */
}

// ============================================================================
// PULL-TO-REFRESH
// ============================================================================

function setupPullToRefresh() {
  const indicator = document.getElementById('notification-pull-indicator');
  const container = document.getElementById('notifications-list-container');

  if (!indicator || !container) {
    console.error('Pull-to-refresh elements not found');
    return;
  }

  // ── Shared refresh action ──────────────────────────────────────────────────
  async function triggerRefresh() {
    if (refreshing) return;
    refreshing = true;

    indicator.innerHTML = `
      <svg class="refresh-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
        <polyline points="1 4 1 10 7 10"></polyline>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
      </svg>
      <span>Refreshing...</span>
    `;
    indicator.style.transform = 'translateX(-50%) translateY(10px)';
    indicator.style.opacity   = '1';

    try {
      container.innerHTML = '';
      await loadNotifications();

      indicator.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Updated!</span>
      `;

      setTimeout(() => _resetIndicator(indicator), 500);
    } catch (error) {
      console.error('Refresh error:', error);
      _resetIndicator(indicator);
    } finally {
      refreshing  = false;
      startY      = null;
      currentY    = null;
    }
  }

  // ── Touch events ───────────────────────────────────────────────────────────
  container.addEventListener('touchstart', (e) => {
    if (container.scrollTop !== 0) return;
    startY  = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (refreshing || !pulling || startY === null) return;

    currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY;

    if (pullDistance > 10 && container.scrollTop === 0) {
      indicator.classList.remove('hidden');
      indicator.classList.add('visible', 'pulling');
      indicator.style.transform = `translateX(-50%) translateY(${Math.min(pullDistance / 2, 50)}px)`;
      indicator.style.opacity   = Math.min(pullDistance / 100, 1);

      indicator.innerHTML = pullDistance > 120
        ? `<svg class="refresh-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <polyline points="1 4 1 10 7 10"></polyline>
             <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
           </svg>
           <span>Release to refresh</span>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <line x1="12" y1="5" x2="12" y2="19"></line>
             <polyline points="19 12 12 19 5 12"></polyline>
           </svg>
           <span>Pull to refresh</span>`;
    } else {
      _resetIndicator(indicator);
    }
  }, { passive: false });

  container.addEventListener('touchend', async () => {
    if (!pulling) return;

    const pullDistance = currentY !== null ? currentY - startY : 0;
    pulling = false;

    if (pullDistance > 120 && container.scrollTop === 0) {
      await triggerRefresh();
    } else {
      _resetIndicator(indicator);
      startY   = null;
      currentY = null;
    }
  });

  // ── Mouse events (desktop testing) ─────────────────────────────────────────
  let mouseDown   = false;
  let mouseStartY = null;

  container.addEventListener('mousedown', (e) => {
    if (container.scrollTop !== 0) return;
    mouseDown   = true;
    mouseStartY = e.clientY;
  });

  container.addEventListener('mousemove', (e) => {
    if (!mouseDown || refreshing || mouseStartY === null) return;

    const pullDistance = e.clientY - mouseStartY;

    if (pullDistance > 10 && container.scrollTop === 0) {
      indicator.classList.remove('hidden');
      indicator.classList.add('visible');
      indicator.style.transform = `translateX(-50%) translateY(${Math.min(pullDistance / 2, 50)}px)`;
      indicator.style.opacity   = Math.min(pullDistance / 100, 1);
      indicator.textContent     = pullDistance > 120 ? '↓ Release to refresh' : '↓ Pull to refresh';
    }
  });

  container.addEventListener('mouseup', async (e) => {
    if (!mouseDown) return;

    const pullDistance = e.clientY - mouseStartY;
    mouseDown = false;

    if (pullDistance > 160 && container.scrollTop === 0) {
      await triggerRefresh();
    } else {
      _resetIndicator(indicator);
    }

    mouseStartY = null;
  });
}

// ── Indicator reset helper ─────────────────────────────────────────────────
function _resetIndicator(indicator) {
  indicator.classList.remove('visible', 'pulling');
  indicator.classList.add('hidden');
  indicator.style.transform = 'translateX(-50%) translateY(-50px)';
  indicator.style.opacity   = '0';
}

// ============================================================================
// OBSERVE #notifications FOR active CLASS — INIT ON ACTIVATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const notificationsSection = document.getElementById('notifications');

  if (!notificationsSection) {
    console.error('#notifications element not found');
    return;
  }

  // If already active on load, init immediately
  if (notificationsSection.classList.contains('active')) {
    initializeNotifications();
  }

  // Watch for the active class being added
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (notificationsSection.classList.contains('active')) {
          initializeNotifications();
        }
      }
    }
  });

  observer.observe(notificationsSection, {
    attributes: true,
    attributeFilter: ['class'],
  });
});

export { initializeNotifications };
