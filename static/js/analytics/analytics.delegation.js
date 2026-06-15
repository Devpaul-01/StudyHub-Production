/**
 * ============================================================================
 * ANALYTICS DELEGATION — analytics.delegation.js
 * Save as: /static/js/analytics/analytics.delegation.js
 *
 * Exports:
 *   AnalyticsHandlers  — spread into UNIFIED_ACTIONS in app.unified.js
 *   initAnalytics      — called by analytics.init.js MutationObserver
 *
 * FIX: Renderers now target the granular element IDs that actually exist in
 * the HTML, instead of container IDs (an-engagement-card, an-impact-card,
 * an-comparison-card, an-heatmap-body) that don't exist.
 * ============================================================================
 */

import { analyticsState } from './analytics.state.js';
import * as analyticsApi  from './analytics.api.js';
import {
  buildHeroStats,
  buildInsights,
  buildAnalyticsSkeleton,
} from './analytics.templates.js';

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE DOM HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function $id(id) { return document.getElementById(id); }

function setText(id, val) {
  const el = $id(id);
  if (el) el.textContent = val;
}

function setHTML(id, html) {
  const el = $id(id);
  if (el) el.innerHTML = html;
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  n = Number(n);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

async function renderOverview(force = false) {
  if (analyticsState.isLoaded('overview') && !force) return;

  const data = await analyticsApi.fetchOverview();
  analyticsState.overview = data;
  analyticsState.markLoaded('overview');

  // renderOverview replaces the whole an-hero-grid — this ID exists in HTML ✅
  setHTML('an-hero-grid', buildHeroStats(data));
}

async function renderHeatmap(force = false) {
  if (analyticsState.isLoaded('heatmap') && !force) return;

  const data = await analyticsApi.fetchActivityHeatmap(90);
  analyticsState.heatmap = data;
  analyticsState.markLoaded('heatmap');

  if (!data) return;

  const { heatmap, summary } = data;

  // ── Month labels → an-heatmap-months ──────────────────────────────────────
  let lastMonth = null;
  const monthLabels = heatmap.map(day => {
    const m = new Date(day.date).getMonth();
    if (m !== lastMonth) {
      lastMonth = m;
      return `<span class="an-month-lbl">${new Date(day.date).toLocaleString('default', { month: 'short' })}</span>`;
    }
    return '';
  }).join('');
  setHTML('an-heatmap-months', monthLabels);

  // ── Heat cells → an-heatmap-grid ─────────────────────────────────────────
  const cells = heatmap.map(day => {
    const tooltip = [
      new Date(day.date).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' }),
      `Score: ${day.score}`,
      `Posts: ${day.posts} · Comments: ${day.comments}`,
    ].join('|');
    return `<div class="an-heat-cell an-heat-${day.level}" data-tip="${tooltip}"></div>`;
  }).join('');
  setHTML('an-heatmap-grid', cells);

  // ── Summary stats → individual IDs ───────────────────────────────────────
  setText('an-active-days', summary.active_days);
  setText('an-streak',      summary.current_streak);
  setText('an-avg-score',   summary.avg_daily_score);

  _bindHeatmapTooltips();
}

async function renderInsights(force = false) {
  if (analyticsState.isLoaded('insights') && !force) return;

  const data = await analyticsApi.fetchInsights();
  analyticsState.insights = data;
  analyticsState.markLoaded('insights');

  // an-insights-list exists in HTML ✅
  setHTML('an-insights-list', buildInsights(data));
}

async function renderEngagement(force = false) {
  if (analyticsState.isLoaded('engagement') && !force) return;

  const data = await analyticsApi.fetchEngagement();
  analyticsState.engagement = data;
  analyticsState.markLoaded('engagement');

  if (!data) return;

  const p = data.posts;
  const c = data.comments;
  const t = data.threads;
  const totalLikes = (p.total_likes || 0) + (c.total_likes || 0);

  // Engagement grid values
  setText('an-eng-posts',        fmt(p.total_created));
  setText('an-eng-posts-sub',    `${fmt(p.total_views)} views total`);
  setText('an-eng-comments',     fmt(c.total_created));
  setText('an-eng-comments-sub', `${fmt(c.marked_helpful)} marked helpful`);
  setText('an-eng-threads',      fmt(t.joined));
  setText('an-eng-threads-sub',  `${fmt(t.messages_sent)} messages`);
  setText('an-eng-likes',        fmt(totalLikes));
  setText('an-eng-likes-sub',    `${fmt(c.marked_solution)} solutions`);

  // Engagement rate label (in the card sub-header)
  if (p.engagement_rate) {
    setText('an-engagement-rate-label', `${p.engagement_rate}% eng. rate`);
  }

  // Best post (if the container exists in the HTML)
  if (p.best_post) {
    const bestPostEl = $id('an-best-post');
    if (bestPostEl) {
      bestPostEl.innerHTML = `
        <div class="an-best-post-label">🌟 Best Post</div>
        <div class="an-best-post-title">${p.best_post.title}</div>
        <div class="an-best-post-stats">
          ${fmt(p.best_post.views)} views · ${fmt(p.best_post.likes)} likes · ${fmt(p.best_post.comments)} comments
        </div>`;
    }
  }
}

async function renderImpact(force = false) {
  if (analyticsState.isLoaded('impact') && !force) return;

  const data = await analyticsApi.fetchImpact();
  analyticsState.impact = data;
  analyticsState.markLoaded('impact');

  if (!data) return;

  const imp = data.impact;

  setText('an-imp-reached',     fmt(imp.people_reached));
  setText('an-imp-answered',    fmt(imp.questions_answered));
  setText('an-imp-solved',      fmt(imp.questions_solved));
  setText('an-imp-resources',   fmt(imp.resources_shared));
  setText('an-imp-bookmarked',  fmt(imp.times_bookmarked));
  setText('an-imp-connections', fmt(imp.active_connections));
  setText('an-impact-score',    `Score: ${fmt(data.impact_score)}`);
}

async function renderComparison(force = false) {
  if (analyticsState.isLoaded('comparison') && !force) return;

  const data = await analyticsApi.fetchComparison();
  analyticsState.comparison = data;
  analyticsState.markLoaded('comparison');

  if (!data) return;

  const y = data.your_stats;
  const a = data.average_stats;
  const c = data.comparison;

  // Helper to populate one comparison row
  function fillRow(key, youVal, avgVal, cmpEntry, barId, youId, avgId, badgeId) {
    const { status, multiplier } = cmpEntry;
    const pct      = Math.min((multiplier / 2) * 100, 100);
    const bar      = $id(barId);
    if (bar) {
      bar.className = `an-compare-bar ${status === 'above' ? 'an-bar--above' : 'an-bar--below'}`;
      // Animate bar
      bar.style.width = '0%';
      requestAnimationFrame(() => { bar.style.width = `${pct}%`; });
    }
    setText(youId,   fmt(youVal));
    setText(avgId,   fmt(avgVal));
    const badge = $id(badgeId);
    if (badge) {
      badge.className = `an-cmp-badge ${status === 'above' ? 'an-badge--pos' : 'an-badge--neg'}`;
      badge.textContent = status === 'above' ? `${multiplier}× avg` : 'below avg';
    }
  }

  fillRow('posts',       y.posts,       a.posts,       c.posts,       'an-cmp-posts-bar', 'an-cmp-posts-you',    'an-cmp-posts-avg',    'an-cmp-posts-badge');
  fillRow('reputation',  y.reputation,  a.reputation,  c.reputation,  'an-cmp-rep-bar',   'an-cmp-rep-you',      'an-cmp-rep-avg',      'an-cmp-rep-badge');
  fillRow('helpful',     y.helpful,     a.helpful,     c.helpful,     'an-cmp-helpful-bar','an-cmp-helpful-you', 'an-cmp-helpful-avg',  'an-cmp-helpful-badge');
  fillRow('connections', y.connections, a.connections, c.connections, 'an-cmp-conn-bar',  'an-cmp-conn-you',     'an-cmp-conn-avg',     'an-cmp-conn-badge');
}

// ─────────────────────────────────────────────────────────────────────────────
// HEATMAP TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

function _bindHeatmapTooltips() {
  const tip = $id('an-tooltip');
  if (!tip) return;

  document.querySelectorAll('.an-heat-cell[data-tip]').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      const [date, score, activity] = cell.dataset.tip.split('|');
      tip.innerHTML = `<strong>${date}</strong><br>${score}<br>${activity}`;
      tip.style.display = 'block';
    });
    cell.addEventListener('mousemove', e => {
      tip.style.left = `${e.clientX + 12}px`;
      tip.style.top  = `${e.clientY - 36}px`;
    });
    cell.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function doExport(type) {
  const data = await analyticsApi.fetchExportData(type);
  if (!data?.records?.length) {
    showToast('No data to export', 'info');
    return;
  }

  const keys = Object.keys(data.records[0]);
  const csv  = [
    keys.join(','),
    ...data.records.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(',')),
  ].join('\n');

  const blob = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a    = Object.assign(document.createElement('a'), {
    href:     blob,
    download: `analytics_${type}_${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(blob);
  showToast('Export ready ✅', 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD ALL — parallel fetch of every section
// ─────────────────────────────────────────────────────────────────────────────

async function loadAll(force = false) {
  await Promise.all([
    renderOverview(force),
    renderHeatmap(force),
    renderInsights(force),
    renderEngagement(force),
    renderImpact(force),
    renderComparison(force),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: initAnalytics — called by analytics.init.js MutationObserver
// ─────────────────────────────────────────────────────────────────────────────

// Tracks whether the direct DOM listeners have been bound (survive re-visits)
let _listenersBound = false;

function _bindDirectListeners() {
  if (_listenersBound) return;
  _listenersBound = true;

  // ── Export select (fires 'change', not 'click' — can't use UNIFIED_ACTIONS) ──
  const exportSelect = $id('an-export-select');
  if (exportSelect) {
    exportSelect.addEventListener('change', async () => {
      const type = exportSelect.value;
      if (!type) return;                       // user picked the placeholder option
      await doExport(type);
      exportSelect.value = '';                 // reset back to "Export data…" after download
    });
  }

  // ── Refresh button (no data-action in HTML — wire it up directly) ──────────
  const refreshBtn = $id('an-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('an-spinning');
      analyticsState.invalidateAll();
      analyticsState.setInitialized(false);

      await loadAll(true);

      analyticsState.setInitialized(true);    // re-arm after forced reload
      refreshBtn.classList.remove('an-spinning');
      showToast('Analytics refreshed', 'success');
    });
  }
}

export async function initAnalytics() {
  if (analyticsState.isInitialized()) {
    console.log('[analytics] Re-activated (already loaded)');
    return;
  }

  analyticsState.setInitialized(true);
  console.log('[analytics] Initializing...');

  // Bind the export select + refresh button (safe to call multiple times)
  _bindDirectListeners();

  // Show skeleton while data loads (an-hero-grid exists ✅)
  setHTML('an-hero-grid', buildAnalyticsSkeleton());

  await loadAll();

  console.log('[analytics] ✅ Initialized');
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: AnalyticsHandlers — spread into UNIFIED_ACTIONS in app.unified.js
// ─────────────────────────────────────────────────────────────────────────────

export const AnalyticsHandlers = {

  // ── Manual refresh button ──────────────────────────────────────────────────
  'analytics-refresh': async (target) => {
    target.classList.add('an-spinning');
    analyticsState.invalidateAll();
    analyticsState.setInitialized(false);

    await loadAll(true);

    target.classList.remove('an-spinning');
    showToast('Analytics refreshed', 'success');
  },

  // ── Export dropdown ────────────────────────────────────────────────────────
  'analytics-export': async (target) => {
    const type = target.dataset.exportType;
    if (!type) return;
    await doExport(type);
  },
};
