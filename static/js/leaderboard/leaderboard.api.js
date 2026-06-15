/**
 * ============================================================================
 * LEADERBOARD API  —  leaderboard.api.js
 * All HTTP calls for the leaderboard feature.
 * Mirrors the exact query-param contracts defined in leaderboard.py.
 * ============================================================================
 */

export const leaderboardAPI = {

  /**
   * GET /leaderboard/global
   * Main ranked list — period + department filtering + pagination.
   */
  async getGlobal({ period = 'all_time', department = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({ period, page, limit });
    if (department) params.append('department', department);
    return api.get(`/leaderboard/global?${params}`);
  },

  /**
   * GET /leaderboard/me
   * Full rank card for the current user.
   */
  async getMyRank({ period = 'weekly', department = '' } = {}) {
    const params = new URLSearchParams({ period });
    if (department) params.append('department', department);
    return api.get(`/leaderboard/me?${params}`);
  },

  /**
   * GET /leaderboard/nearby
   * Users immediately surrounding the current user.
   */
  async getNearby({ period = 'weekly', range = 3, department = '' } = {}) {
    const params = new URLSearchParams({ period, range });
    if (department) params.append('department', department);
    return api.get(`/leaderboard/nearby?${params}`);
  },

  /**
   * GET /leaderboard/connections
   * Leaderboard scoped to accepted connections + self.
   */
  async getConnections({ period = 'weekly' } = {}) {
    const params = new URLSearchParams({ period });
    return api.get(`/leaderboard/connections?${params}`);
  },

  /**
   * GET /leaderboard/rising
   * Users with biggest reputation gain in past 7 days.
   */
  async getRising({ limit = 10, department = '' } = {}) {
    const params = new URLSearchParams({ limit });
    if (department) params.append('department', department);
    return api.get(`/leaderboard/rising?${params}`);
  },

  /**
   * GET /leaderboard/stats
   * Platform-wide engagement stats.
   */
  async getStats() {
    return api.get('/leaderboard/stats');
  },

  /**
   * GET /leaderboard/breakdown
   * Transparent score breakdown for current user.
   */
  async getBreakdown({ period = 'weekly' } = {}) {
    const params = new URLSearchParams({ period });
    return api.get(`/leaderboard/breakdown?${params}`);
  },

  /**
   * GET /leaderboard/filters
   * Valid departments / periods / user defaults — used to populate
   * the department dropdown dynamically so new departments show up
   * automatically.
   */
  async getFilters() {
    return api.get('/leaderboard/filters');
  },
};
