// Notification Utility Functions

export function formatHudTime(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function updateBadgeCount(count) {
  const badge = document.getElementById("notification-badge");
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

export function showEmptyNotifications() {
  return `
    <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-secondary);">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; opacity: 0.3;">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <h3 style="margin-bottom: 0.5rem;">No notifications yet</h3>
      <p>When you get notifications, they'll show up here</p>
    </div>
  `;
}

export function getLoadingSkeletonState() {
  return `
    <div class="notification-skeleton">
      ${Array(3).fill(0).map(() => `
        <div class="skeleton-notification" style="padding: 1rem; border-bottom: 1px solid var(--border);">
          <div class="skeleton-line" style="width: 70%; height: 16px; background: var(--bg-secondary); border-radius: 4px; margin-bottom: 0.5rem;"></div>
          <div class="skeleton-line" style="width: 90%; height: 14px; background: var(--bg-secondary); border-radius: 4px; margin-bottom: 0.5rem;"></div>
          <div class="skeleton-line" style="width: 40%; height: 12px; background: var(--bg-secondary); border-radius: 4px;"></div>
        </div>
      `).join('')}
    </div>
  `;
}