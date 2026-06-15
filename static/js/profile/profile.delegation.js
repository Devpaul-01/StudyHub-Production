/**
 * ============================================================================
 * PROFILE DELEGATION — profile.delegation.js
 * Save as: /static/js/profile/profile.delegation.js
 *
 * Exports:
 *   ProfileHandlers  — spread into UNIFIED_ACTIONS in app.unified.js
 *   initProfile      — called by profile.init.js MutationObserver
 * ============================================================================
 */

import { profileState } from './profile.state.js';
import * as profileApi  from './profile.api.js';
import {
  buildSkeleton,
  buildProfileHeader,
  buildPostsTab,
  buildStatsTab,
  buildConnectionsTab,
  buildReputationTab,
  buildGoalsList,
} from './profile.templates.js';

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE DOM HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function $id(id) { return document.getElementById(id); }

function setTabContent(html) {
  const el = $id('profile-tab-content');
  if (el) el.innerHTML = html;
}

function setHeaderContent(html) {
  const el = $id('profile-header-container');
  if (el) el.innerHTML = html;
}

function syncTabButtons(activeTab) {
  document.querySelectorAll('.p-tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === activeTab;
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? 'var(--primary)' : 'var(--bg-tertiary)';
    btn.style.color       = isActive ? '#fff'          : 'var(--text-secondary)';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

async function renderHeaderIfNeeded() {
  if (profileState.isLoaded('profile')) return;
  setHeaderContent(buildSkeleton(1));
  const data = await profileApi.fetchProfileData();
  if (!data) { setHeaderContent('<div style="padding:1rem;color:var(--text-secondary);">Failed to load profile</div>'); return; }
  profileState.profileData = data;
  profileState.markLoaded('profile');
  setHeaderContent(buildProfileHeader(data));
}

async function renderPostsTab(forceReload = false) {
  if (!profileState.isLoaded('posts') || forceReload) {
    setTabContent(buildSkeleton());
    profileState.posts = await profileApi.fetchMyPosts(profileState.postsFilter);
    profileState.markLoaded('posts');
  }
  setTabContent(buildPostsTab(profileState.posts, profileState.postsFilter));
}

async function renderStatsTab() {
  if (!profileState.isLoaded('stats')) {
    setTabContent(buildSkeleton());
    [profileState.stats, profileState.heatmap] = await Promise.all([
      profileApi.fetchMyStats(),
      profileApi.fetchActivityHeatmap(),
    ]);
    profileState.markLoaded('stats');
  }
  setTabContent(buildStatsTab(profileState.stats, profileState.heatmap));
}

async function renderConnectionsTab() {
  if (!profileState.isLoaded('connections')) {
    setTabContent(buildSkeleton());
    profileState.connections = await profileApi.fetchMyConnections();
    profileState.markLoaded('connections');
  }
  setTabContent(buildConnectionsTab(profileState.connections));
}

async function renderReputationTab() {
  if (!profileState.isLoaded('reputation')) {
    setTabContent(buildSkeleton());
    [profileState.reputation, profileState.repHistory] = await Promise.all([
      profileApi.fetchReputation(),
      profileApi.fetchReputationHistory(),
    ]);
    profileState.markLoaded('reputation');
  }
  setTabContent(buildReputationTab(profileState.reputation, profileState.repHistory));
}

async function renderCurrentTab() {
  const tab = profileState.getCurrentTab();
  if (tab === 'posts')       return renderPostsTab();
  if (tab === 'stats')       return renderStatsTab();
  if (tab === 'connections') return renderConnectionsTab();
  if (tab === 'reputation')  return renderReputationTab();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function openProfileModal(id) {
  const modal = $id(id);
  if (modal) modal.classList.add('active');
}

function closeProfileModal(id) {
  const modal = $id(id);
  if (modal) modal.classList.remove('active');
}

function populateEditModal() {
  const d = profileState.profileData;
  if (!d) return;
  const setVal = (id, val) => { const el = $id(id); if (el) el.value = val || ''; };
  setVal('p-edit-name', d.name);
  setVal('p-edit-bio',  d.bio);
  const goalsEl = $id('p-edit-goals-list');
  if (goalsEl) goalsEl.innerHTML = buildGoalsList(d.learning_goals || []);
}

async function populateAcademicModal() {
  const data = await profileApi.fetchAcademicInfo();
  if (!data) return;
  const setChips = (id, arr) => { const el = $id(id); if (el) el.value = (arr || []).join(', '); };
  setChips('p-academic-subjects',   data.subjects);
  setChips('p-academic-strong',     data.strong_subjects);
  setChips('p-academic-help',       data.help_subjects);
  setChips('p-academic-study-prefs',data.study_preferences);
  const styleEl = $id('p-academic-style');
  if (styleEl) styleEl.value = data.learning_style || '';
}

function parseChips(id) {
  const el = $id(id);
  if (!el) return [];
  return el.value.split(',').map(s => s.trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: initProfile (called from profile.init.js MutationObserver)
// ─────────────────────────────────────────────────────────────────────────────

export async function initProfile() {
  if (profileState.isInitialized()) return;  // already loaded, don't re-run
  profileState.setInitialized(true);
  console.log('[profile] Initializing...');

  await renderHeaderIfNeeded();

  // Default to posts tab
  syncTabButtons('posts');
  profileState.setCurrentTab('posts');
  await renderPostsTab();

  console.log('[profile] ✅ Initialized');
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: ProfileHandlers — spread into UNIFIED_ACTIONS in app.unified.js
// ─────────────────────────────────────────────────────────────────────────────

export const ProfileHandlers = {

  // ── Tab switching ──────────────────────────────────────────────────────────

  'profile-tab': async (target) => {
    const tab = target.dataset.tab;
    if (!tab || tab === profileState.getCurrentTab()) return;

    profileState.setCurrentTab(tab);
    syncTabButtons(tab);

    if (tab === 'posts')       await renderPostsTab();
    else if (tab === 'stats')       await renderStatsTab();
    else if (tab === 'connections') await renderConnectionsTab();
    else if (tab === 'reputation')  await renderReputationTab();
  },

  // ── Post filter ───────────────────────────────────────────────────────────

  'profile-filter-posts': async (target) => {
    const filter = target.dataset.filter;
    if (!filter || filter === profileState.postsFilter) return;
    profileState.postsFilter = filter;
    profileState.invalidate('posts');
    await renderPostsTab(true);
  },

  // ── Pin post ──────────────────────────────────────────────────────────────

  'profile-pin-post': async (target) => {
    const postId = target.dataset.postId || target.closest('[data-post-id]')?.dataset.postId;
    if (!postId) return;
    const res = await profileApi.pinPost(postId);
    if (res?.status === 'success') {
      showToast('Post pinned 📌', 'success');
      profileState.invalidate('posts');
      await renderPostsTab(true);
    } else {
      showToast(res?.message || 'Could not pin post', 'error');
    }
  },

  // ── Unpin post ────────────────────────────────────────────────────────────

  'profile-unpin-post': async (target) => {
    const postId = target.dataset.postId || target.closest('[data-post-id]')?.dataset.postId;
    if (!postId) return;
    const res = await profileApi.unpinPost(postId);
    if (res?.status === 'success') {
      showToast('Post unpinned', 'success');
      profileState.invalidate('posts');
      await renderPostsTab(true);
    } else {
      showToast(res?.message || 'Could not unpin post', 'error');
    }
  },

  // ── Delete post ───────────────────────────────────────────────────────────

  'profile-delete-post': async (target) => {
    const postId = target.dataset.postId || target.closest('[data-post-id]')?.dataset.postId;
    if (!postId) return;
    if (!confirm('Delete this post? This cannot be undone.')) return;

    const res = await profileApi.deletePost(postId);
    if (res?.status === 'success') {
      showToast('Post deleted', 'success');
      // Remove from DOM immediately
      const card = document.querySelector(`.profile-post-card[data-post-id="${postId}"]`);
      if (card) card.remove();
      // Update state so re-renders stay consistent
      profileState.posts = profileState.posts.filter(p => String(p.id) !== String(postId));
      // Refresh header stats count
      profileState.invalidate('profile');
      await renderHeaderIfNeeded();
    } else {
      showToast(res?.message || 'Could not delete post', 'error');
    }
  },

  // ── Open modals ───────────────────────────────────────────────────────────

  'profile-open-edit': () => {
    populateEditModal();
    openProfileModal('p-edit-modal');
  },

  'profile-open-avatar': () => {
    openProfileModal('p-avatar-modal');
  },

  'profile-open-academic': () => {
    populateAcademicModal().then(() => openProfileModal('p-academic-modal'));
  },

  // ── Close modals ──────────────────────────────────────────────────────────

  'profile-close-modal': (target) => {
    const id = target.dataset.modalId;
    if (id) closeProfileModal(id);
  },

  // ── Save profile edit ─────────────────────────────────────────────────────

  'profile-save-edit': async (target) => {
    const name = $id('p-edit-name')?.value?.trim();
    const bio  = $id('p-edit-bio')?.value?.trim();
    if (!name) { showToast('Name is required', 'error'); return; }

    target.disabled = true;
    target.textContent = 'Saving…';
    const res = await profileApi.saveProfileEdit({ name, bio });
    target.disabled = false;
    target.textContent = 'Save Changes';

    if (res?.status === 'success') {
      showToast('Profile updated ✅', 'success');
      closeProfileModal('p-edit-modal');
      profileState.invalidate('profile');
      await renderHeaderIfNeeded();
    } else {
      showToast(res?.message || 'Failed to save', 'error');
    }
  },

  // ── Learning goals ────────────────────────────────────────────────────────

  'profile-add-goal': async () => {
    const input = $id('p-edit-goal-input');
    const goal  = input?.value?.trim();
    if (!goal) return;
    const res = await profileApi.addLearningGoal(goal);
    if (res?.status === 'success') {
      if (input) input.value = '';
      const newGoals = res.data?.learning_goals || [];
      if (profileState.profileData) profileState.profileData.learning_goals = newGoals;
      const goalsEl = $id('p-edit-goals-list');
      if (goalsEl) goalsEl.innerHTML = buildGoalsList(newGoals);
    } else {
      showToast(res?.message || 'Could not add goal', 'error');
    }
  },

  'profile-remove-goal': async (target) => {
    const index = parseInt(target.dataset.index, 10);
    if (isNaN(index)) return;
    const res = await profileApi.removeLearningGoal(index);
    if (res?.status === 'success') {
      const newGoals = res.data?.learning_goals || [];
      if (profileState.profileData) profileState.profileData.learning_goals = newGoals;
      const goalsEl = $id('p-edit-goals-list');
      if (goalsEl) goalsEl.innerHTML = buildGoalsList(newGoals);
    } else {
      showToast(res?.message || 'Could not remove goal', 'error');
    }
  },

  // ── Save academic info ────────────────────────────────────────────────────

  'profile-save-academic': async (target) => {
    const payload = {
      subjects          : parseChips('p-academic-subjects'),
      strong_subjects   : parseChips('p-academic-strong'),
      help_subjects     : parseChips('p-academic-help'),
      study_preferences : parseChips('p-academic-study-prefs'),
      learning_style    : $id('p-academic-style')?.value?.trim() || '',
    };
    target.disabled = true;
    target.textContent = 'Saving…';
    const res = await profileApi.saveAcademicInfo(payload);
    target.disabled = false;
    target.textContent = 'Save';
    if (res?.status === 'success') {
      showToast('Academic info saved ✅', 'success');
      closeProfileModal('p-academic-modal');
    } else {
      showToast(res?.message || 'Failed to save', 'error');
    }
  },

  // ── Avatar upload ─────────────────────────────────────────────────────────

  'profile-upload-avatar': async () => {
    const input = $id('p-avatar-file-input');
    if (!input?.files?.length) { showToast('Choose a file first', 'error'); return; }

    const btn = document.querySelector('[data-action="profile-upload-avatar"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

    const res = await profileApi.uploadAvatar(input.files[0]);

    if (btn) { btn.disabled = false; btn.textContent = 'Upload'; }

    if (res?.status === 'success') {
      showToast('Avatar updated ✅', 'success');
      closeProfileModal('p-avatar-modal');
      profileState.invalidate('profile');
      await renderHeaderIfNeeded();
    } else {
      showToast(res?.message || 'Upload failed', 'error');
    }
  },

  // ── Remove avatar ─────────────────────────────────────────────────────────

  'profile-remove-avatar': async () => {
    if (!confirm('Remove your profile picture?')) return;
    const res = await profileApi.removeAvatar();
    if (res?.status === 'success') {
      showToast('Avatar removed', 'success');
      closeProfileModal('p-avatar-modal');
      profileState.invalidate('profile');
      await renderHeaderIfNeeded();
    } else {
      showToast(res?.message || 'Failed', 'error');
    }
  },
};
