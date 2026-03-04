/**
 * ============================================================================
 * ANALYTICS INIT — analytics.init.js
 * Save as: /static/js/analytics/analytics.init.js
 *
 * Uses a MutationObserver to watch section#analytics for the "active" class.
 * When the section becomes active for the first time → calls initAnalytics().
 * If the user navigates away and back, initAnalytics() no-ops because
 * analyticsState.isInitialized() stays true (data is cached).
 *
 * Mirrors the exact pattern of profile.init.js.
 * ============================================================================
 */

import { initAnalytics } from './analytics.delegation.js';
import { analyticsState } from './analytics.state.js';

document.addEventListener('DOMContentLoaded', () => {
  const analyticsSection = document.getElementById('analytics');

  if (!analyticsSection) {
    console.error('[analytics.init] section#analytics not found in DOM');
    return;
  }

  // ── MutationObserver: fires whenever classList changes on #analytics ────────

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;

      const isNowActive = analyticsSection.classList.contains('active');

      if (isNowActive) {
        if (!analyticsState.isInitialized()) {
          console.log('[analytics.init] Analytics section became active → initializing...');
          initAnalytics().catch(err => {
            console.error('[analytics.init] initAnalytics failed:', err);
            analyticsState.setInitialized(false); // allow retry on next visit
          });
        } else {
          // Already initialized — user navigated back. All data is in cache.
          console.log('[analytics.init] Analytics re-activated (already loaded)');
        }
      }
    }
  });

  observer.observe(analyticsSection, { attributes: true });

  // ── Edge case: page loaded with analytics already active (e.g. deep-link) ──

  if (analyticsSection.classList.contains('active')) {
    console.log('[analytics.init] Analytics already active on page load → initializing...');
    initAnalytics().catch(err => {
      console.error('[analytics.init] initAnalytics failed:', err);
      analyticsState.setInitialized(false);
    });
  }

  console.log('[analytics.init] ✅ MutationObserver watching section#analytics');
});
