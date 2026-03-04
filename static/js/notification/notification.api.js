// Refined Notification API Calls
// Fetches all notifications at once instead of cursor-based pagination

export const notificationAPI = {
  /**
   * Get all notifications at once
   * No cursor implementation - fetches everything in one call
   */
  async getNotifications() {
    const response = await api.get('/profile/notifications/all');
    return response;
  },

  async toggleEnableNotification(data) {
    const response = await api.post("/profile/notifications/settings", data);
    return response;
  },

  async toggleEnableNotificationSound(data) {
    const response = await api.post("/profile/notifications/settings", data);
    return response;
  },

  async deleteNotification(id) {
    const response = await api.delete(`/profile/notifications/${id}`);
    return response;
  },

  async markAsRead(id) {
    const response = await api.post(`/profile/notifications/${id}/mark-read`);
    return response;
  },

  async getUnreadCount() {
    const response = await api.get("/profile/notifications/unread-count");
    return response.data || {};
  }
};
