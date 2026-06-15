/**
 * ============================================================================
 * LEADERBOARD DELEGATION  —  leaderboard.delegation.js
 * Exports click/change handlers that are spread into UNIFIED_ACTIONS
 * in app.unified.js — exactly mirroring the NotificationHandlers pattern.
 * ============================================================================
 */

import {
  switchView,
  setPeriod,
  setDepartment,
  loadMoreLeaderboard,
  toggleBreakdown,
  retryLoad,
} from './leaderboard.events.js';

/**
 * All leaderboard data-action handlers.
 * Spread these into UNIFIED_ACTIONS in app.unified.js.
 */
export const LeaderboardHandlers = {

  /** Switch between global / connections / rising / me views */
  'lb-switch-view': (target, event) => {
    event.stopPropagation();
    const view = target.dataset.view;
    if (view) switchView(view);
  },

  /** Switch period tab (daily / weekly / monthly / all_time) */
  'lb-set-period': (target, event) => {
    event.stopPropagation();
    const period = target.dataset.period;
    if (period) setPeriod(period);
  },

  /** Load next page of results */
  'lb-load-more': (target, event) => {
    event.stopPropagation();
    loadMoreLeaderboard();
  },

  /** Open/close score breakdown panel */
  'lb-toggle-breakdown': (target, event) => {
    event.stopPropagation();
    toggleBreakdown();
  },

  /** Retry after error */
  'lb-retry': (target, event) => {
    event.stopPropagation();
    retryLoad();
  },
};

/**
 * Register the department select change separately
 * (change events don't bubble as click, so we wire it in leaderboard.init.js).
 */
export function setupDeptFilter() {
  const select = document.getElementById('lb-dept-filter');
  if (!select) return;

  select.addEventListener('change', (e) => {
    setDepartment(e.target.value);
  });
}
