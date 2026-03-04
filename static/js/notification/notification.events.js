import { notificationState } from './notification.state.js';
import { notificationAPI } from './notification.api.js';
import { createNotificationCard } from './notification.templates.js';
import { updateBadgeCount, showEmptyNotifications, getLoadingSkeletonState } from './notification.utils.js';

// Delete a single notification
export async function handleDeleteNotification(id, event) {
  if (event) {
    event.stopPropagation();
  }

  try {
    const response = await notificationAPI.deleteNotification(id);
    
    if (response.status === 'success') {
      const section = document.querySelector("section#notifications");
      const element = section.querySelector(`[data-notification-id="${id}"]`);
      
      if (element) {
        element.style.opacity = '0';
        element.style.transition = 'opacity 0.3s ease';
        setTimeout(() => element.remove(), 300);
      }

      showToast('Notification deleted', 'success');
    } else {
      showToast(response.message || 'Failed to delete notification', 'error');
    }
  } catch (error) {
    console.error('Delete notification error:', error);
    showToast('Failed to delete notification', 'error');
  }
}

/**
 * Load all notifications at once (no cursor/pagination)
 */
export async function loadNotifications() {
  // Prevent duplicate calls
  if (notificationState.isLoading()) {
    console.log('⏸️ Skipping load - already loading');
    return;
  }

  const container = document.getElementById("notifications-list-container");

  console.log('🔄 Loading all notifications...');

  try {
    // Set loading state IMMEDIATELY to prevent duplicate calls
    notificationState.setLoading(true);

    // Show loading skeleton
    container.innerHTML = getLoadingSkeletonState();

    const response = await notificationAPI.getNotifications();
    
    const data = response.data;
    const notifications = data.notifications || [];
    
    console.log(`✅ Loaded ${notifications.length} notifications`);

    // Update settings toggles
    const enableNotifToggle = document.getElementById('toggle-notification');
    const enableSoundToggle = document.getElementById("toggle-notification-sound");
    
    if (enableNotifToggle) {
      enableNotifToggle.checked = data.enable_notification !== false;
    }
    if (enableSoundToggle) {
      enableSoundToggle.checked = data.enable_notification_sound !== false;
    }

    // Update badge count
    updateBadgeCount(data.unread_count || 0);

    // Clear container
    container.innerHTML = '';

    // Show empty state if no notifications
    if (notifications.length === 0) {
      container.innerHTML = showEmptyNotifications();
      return;
    }

    // Render all notifications at once
    const fragment = document.createDocumentFragment();
    notifications.forEach(notification => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = createNotificationCard(notification);
      fragment.appendChild(tempDiv.firstElementChild);
    });

    container.appendChild(fragment);

  } catch (error) {
    console.error('❌ Load notifications error:', error);

    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
        <p>Failed to load notifications. Please try again.</p>
      </div>
    `;

  } finally {
    notificationState.setLoading(false);
  }
}

// Toggle notification settings modal
export function toggleNotificationSettings() {
  const modal = document.getElementById("notification-settings-modal");
  const button = document.querySelector('[data-action="toggle-notification-options"]');
  
  if (modal) {
    const isHidden = modal.classList.contains('hidden');
    modal.classList.toggle('hidden');
    
    // On mobile, position the modal better
    if (!isHidden && window.innerWidth < 768 && button) {
      const buttonRect = button.getBoundingClientRect();
      const modalHeight = modal.offsetHeight;
      const viewportHeight = window.innerHeight;
      
      // Position below button if there's space, otherwise above
      if (buttonRect.bottom + modalHeight + 20 < viewportHeight) {
        modal.style.top = `${buttonRect.bottom + 10}px`;
        modal.style.bottom = 'auto';
      } else {
        modal.style.top = 'auto';
        modal.style.bottom = `${viewportHeight - buttonRect.top + 10}px`;
      }
    }
  }
}

// Handle enable/disable notifications
export async function handleToggleNotification(value) {
  const element = document.getElementById("toggle-notification");
  
  const data = {
    setting: 'enable_notification'
  };

  try {
    const response = await notificationAPI.toggleEnableNotification(data);
    
    if (response.status !== 'success') {
      showToast(response.message || 'Failed to update settings', 'error');
      if (element) {
        element.checked = response.data.new_value;
      }
      return;
    }
    showToast(response.message, 'info');

    showToast('Notification settings updated', 'success');
  } catch (error) {
    console.error('Toggle notification error:', error);
    showToast('Failed to update settings', 'error');
    if (element) {
      element.checked = !value;
    }
  }
}

// Handle enable/disable notification sound
export async function handleToggleNotificationSound(value) {
  const element = document.getElementById("toggle-notification-sound");
  
  const data = {
    setting: 'enable_notification_sound'
  };

  try {
    const response = await notificationAPI.toggleEnableNotificationSound(data);
    
    if (response.status !== 'success') {
      showToast(response.message || 'Failed to update settings', 'error');
      if (element) {
        element.checked = response.data.new_value;
      }
      return;
    }

    showToast('Sound settings updated', 'success');
  } catch (error) {
    console.error('Toggle notification sound error:', error);
    showToast('Failed to update settings', 'error');
    if (element) {
      element.checked = !value;
    }
  }
}

// No longer needed - removed infinite scroll functionality
// All notifications load at getBoundingClientRect