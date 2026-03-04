/**
 * ============================================================================
 * PROFILE INIT — profile.init.js
 * Save as: /static/js/profile/profile.init.js
 *
 * Uses a MutationObserver to watch section#profile for the "active" class.
 * When the section becomes active for the first time → runs initProfile().
 * Re-running navigate-to after that costs nothing (state guards it).
 * ============================================================================
 */

import { initProfile } from './profile.delegation.js';
import { profileState } from './profile.state.js';

document.addEventListener('DOMContentLoaded', () => {
  const profileSection = document.getElementById('profile');

  if (!profileSection) {
    console.error('[profile.init] section#profile not found in DOM');
    return;
  }

  // ── MutationObserver: fires whenever classList changes on #profile ──────

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;

      const isNowActive = profileSection.classList.contains('active');

      if (isNowActive) {
        if (!profileState.isInitialized()) {
          console.log('[profile.init] Profile section became active → initializing...');
          initProfile().catch(err => {
            console.error('[profile.init] initProfile failed:', err);
            profileState.setInitialized(false); // allow retry
          });
        } else {
          // Already initialised — user navigated back.
          // Header is still rendered; nothing else needed.
          console.log('[profile.init] Profile section re-activated (already loaded)');
        }
      }
    }
  });

  observer.observe(profileSection, { attributes: true });

  // ── Edge case: page loaded with profile already active (e.g. deep-link) ──

  if (profileSection.classList.contains('active')) {
    console.log('[profile.init] Profile already active on page load → initializing...');
    initProfile().catch(err => {
      console.error('[profile.init] initProfile failed:', err);
      profileState.setInitialized(false);
    });
  }

  console.log('[profile.init] ✅ MutationObserver watching section#profile');
});
