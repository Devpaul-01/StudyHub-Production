import { formatHudTime } from './notification.utils.js';

export function createNotificationCard(notification) {
  return `
    <div data-action="view-notification" 
         data-link="${notification.link || ''}" 
         class="hud-notification ${notification.is_read ? 'read' : ''}"
         data-notification-id="${notification.id}">
      
      <button class="cancel-btn" 
              data-action="delete-notification" 
              data-notification-id="${notification.id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      <div class="hud-title">${notification.title}</div>
      <div class="hud-body">${notification.body}</div>
      
      <div class="hud-time">
        ${formatHudTime(notification.created_at)}
      </div>
    </div>
  `;
}