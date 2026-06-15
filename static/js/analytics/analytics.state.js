/**
 * ============================================================================
 * ANALYTICS STATE — analytics.state.js
 * Save as: /static/js/analytics/analytics.state.js
 *
 * Mirrors the ProfileState class pattern from profile.state.js
 * Single source of truth for all analytics data + loaded flags.
 * ============================================================================
 */

class AnalyticsState {
  constructor() {
    this._initialized = false;

    // ── Cached API responses ─────────────────────────────────────────────────
    this.overview   = null;   // /analytics/overview
    this.heatmap    = null;   // /analytics/activity-heatmap
    this.engagement = null;   // /analytics/engagement
    this.impact     = null;   // /analytics/impact
    this.insights   = null;   // /analytics/insights
    this.comparison = null;   // /analytics/comparison

    // ── Which endpoints have already been fetched ────────────────────────────
    this.loaded = {
      overview   : false,
      heatmap    : false,
      engagement : false,
      impact     : false,
      insights   : false,
      comparison : false,
    };
  }

  // ── Initialization flag ──────────────────────────────────────────────────

  setInitialized(val) { this._initialized = val; }
  isInitialized()     { return this._initialized; }

  // ── Loaded flags ─────────────────────────────────────────────────────────

  markLoaded(key)  { this.loaded[key] = true; }
  isLoaded(key)    { return this.loaded[key] === true; }

  /** Force a re-fetch for a specific endpoint (e.g. after manual refresh) */
  invalidate(key)  { this.loaded[key] = false; }

  /** Full reset — wipes all cache and flags, forces a fresh load */
  invalidateAll() {
    Object.keys(this.loaded).forEach(k => (this.loaded[k] = false));
    this._initialized = false;
    this.overview   = null;
    this.heatmap    = null;
    this.engagement = null;
    this.impact     = null;
    this.insights   = null;
    this.comparison = null;
  }
}

export const analyticsState = new AnalyticsState();
