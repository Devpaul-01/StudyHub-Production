/**
 * ============================================================================
 * LEADERBOARD STATE  —  leaderboard.state.js
 * Single source of truth for all leaderboard UI state.
 * Follows the NotificationState class pattern from the existing codebase.
 * ============================================================================
 */

class LeaderboardState {
  constructor() {
    // ── View / filter ──────────────────────────────────────────────────────────
    this.activeView       = 'global';   // 'global' | 'connections' | 'rising' | 'me'
    this.activePeriod     = 'weekly';   // 'daily' | 'weekly' | 'monthly' | 'all_time'
    this.activeDepartment = '';         // '' = no filter

    // ── Pagination ─────────────────────────────────────────────────────────────
    this.page    = 1;
    this.hasMore = false;
    this.loading = false;

    // ── Cached data ────────────────────────────────────────────────────────────
    this.entries      = [];   // current list of leaderboard entries rendered
    this.totalUsers   = 0;
    this.myRankData   = null; // latest /leaderboard/me response data
    this.statsData    = null; // latest /leaderboard/stats response data

    // ── Panel visibility ───────────────────────────────────────────────────────
    this.breakdownVisible = false;
    this.nearbyVisible    = false;
  }

  // ── View / filter mutators ───────────────────────────────────────────────────

  setView(view)               { this.activeView = view; }
  setPeriod(period)           { this.activePeriod = period; }
  setDepartment(dept)         { this.activeDepartment = dept; }

  // ── Loading ──────────────────────────────────────────────────────────────────

  setLoading(val)             { this.loading = val; }
  isLoading()                 { return this.loading; }

  // ── Pagination ───────────────────────────────────────────────────────────────

  setPage(p)                  { this.page = p; }
  setHasMore(val)             { this.hasMore = val; }
  canLoadMore()               { return this.hasMore && !this.loading; }

  // ── Entries ──────────────────────────────────────────────────────────────────

  setEntries(entries)         { this.entries = entries; }
  appendEntries(entries)      { this.entries.push(...entries); }
  setTotalUsers(n)            { this.totalUsers = n; }

  // ── Cached data ──────────────────────────────────────────────────────────────

  setMyRankData(data)         { this.myRankData = data; }
  setStatsData(data)          { this.statsData = data; }

  // ── Panel toggles ─────────────────────────────────────────────────────────────

  toggleBreakdown()           { this.breakdownVisible = !this.breakdownVisible; }
  toggleNearby()              { this.nearbyVisible    = !this.nearbyVisible; }
  setBreakdownVisible(v)      { this.breakdownVisible = v; }
  setNearbyVisible(v)         { this.nearbyVisible    = v; }

  // ── Full reset (called on view/filter change) ─────────────────────────────────

  resetPagination() {
    this.page    = 1;
    this.hasMore = false;
    this.entries = [];
  }

  reset() {
    this.resetPagination();
    this.loading          = false;
    this.breakdownVisible = false;
    this.nearbyVisible    = false;
  }
}

// Export singleton — mirrors NotificationState export pattern
export const leaderboardState = new LeaderboardState();
