/**
 * ============================================================================
 * ANALYTICS API — analytics.api.js
 * Save as: /static/js/analytics/analytics.api.js
 *
 * Uses the global `api` object loaded by /js/core/api.js (non-module script).
 * Uses the global `showToast` — same pattern as profile.api.js / feed.api.js.
 * No imports needed for either.
 * ============================================================================
 */

// ── Overview (hero stats) ────────────────────────────────────────────────────

export async function fetchOverview() {
  try {
    const res = await api.get('/analytics/overview');
    return res?.data || null;
  } catch (e) {
    console.error('[analytics.api] fetchOverview:', e);
    showToast('Failed to load analytics overview', 'error');
    return null;
  }
}

// ── Activity heatmap ─────────────────────────────────────────────────────────

export async function fetchActivityHeatmap(days = 90) {
  try {
    const res = await api.get(`/analytics/activity-heatmap?days=${days}`);
    return res?.data || null;
  } catch (e) {
    console.error('[analytics.api] fetchActivityHeatmap:', e);
    return null;
  }
}

// ── Engagement breakdown ─────────────────────────────────────────────────────

export async function fetchEngagement() {
  try {
    const res = await api.get('/analytics/engagement');
    return res?.data || null;
  } catch (e) {
    console.error('[analytics.api] fetchEngagement:', e);
    return null;
  }
}

// ── Impact metrics ───────────────────────────────────────────────────────────

export async function fetchImpact() {
  try {
    const res = await api.get('/analytics/impact');
    return res?.data || null;
  } catch (e) {
    console.error('[analytics.api] fetchImpact:', e);
    return null;
  }
}

// ── AI Insights ──────────────────────────────────────────────────────────────

export async function fetchInsights() {
  try {
    const res = await api.get('/analytics/insights');
    return res?.data || null;
  } catch (e) {
    console.error('[analytics.api] fetchInsights:', e);
    return null;
  }
}

// ── Platform comparison ──────────────────────────────────────────────────────

export async function fetchComparison() {
  try {
    const res = await api.get('/analytics/comparison');
    return res?.data || null;
  } catch (e) {
    console.error('[analytics.api] fetchComparison:', e);
    return null;
  }
}

// ── Weekly summary ───────────────────────────────────────────────────────────

export async function fetchWeeklySummary() {
  try {
    const res = await api.get('/analytics/weekly-summary');
    return res?.data || null;
  } catch (e) {
    console.error('[analytics.api] fetchWeeklySummary:', e);
    return null;
  }
}

// ── Per-post analytics ───────────────────────────────────────────────────────

export async function fetchPostAnalytics(postId) {
  try {
    const res = await api.get(`/analytics/post/${postId}`);
    return res?.data || null;
  } catch (e) {
    console.error(`[analytics.api] fetchPostAnalytics(${postId}):`, e);
    return null;
  }
}

// ── Export (returns raw JSON for CSV conversion) ─────────────────────────────

export async function fetchExportData(type = 'overview') {
  try {
    const res = await api.get(`/analytics/export?type=${encodeURIComponent(type)}`);
    return res?.data || null;
  } catch (e) {
    console.error(`[analytics.api] fetchExportData(${type}):`, e);
    showToast('Failed to export analytics data', 'error');
    return null;
  }
}
