// Notification State Management
class NotificationState {
  constructor() {
    this.hasMore = true;
    this.loading = false;
    this.lastCursor = null;
  }

  updateHasMore(value) {
    this.hasMore = value;
  }

  updateCursor(cursor) {
    this.lastCursor = cursor;
  }

  getLastCursor() {
    return this.lastCursor;
  }

  setLoading(value) {
    this.loading = value;
  }

  isLoading() {
    return this.loading;
  }

  canLoadMore() {
    return this.hasMore && !this.loading;
  }

  reset() {
    this.hasMore = true;
    this.loading = false;
    this.lastCursor = null;
  }
}

// Export singleton instance
export const notificationState = new NotificationState();