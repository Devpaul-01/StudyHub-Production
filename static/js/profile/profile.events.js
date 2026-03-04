/**
 * ============================================================================
 * PROFILE EVENTS  — profile_events.js
 * Export ProfileHandlers to spread into UNIFIED_ACTIONS in app_unified.js
 *
 * HOW TO INTEGRATE:
 *   In app_unified.js add:
 *     import { ProfileHandlers } from '../profile/profile_events.js';
 *   Then inside UNIFIED_ACTIONS:
 *     ...ProfileHandlers,
 *
 * Save as profile_events.js (rename from profile_events.html)
 * ============================================================================
 */

import * as profileApi from './profile.api.js';
import {
  buildProfileHeader,
  buildPostsTab,
  buildStatsTab,
  buildConnectionsTab,
  buildReputationTab,
  buildSkeleton,
} from './profile.templates.js';

// ── Module-level state ────────────────────────────────────────────────────────

const state = {
  profileData:       null,
  posts:             [],
  postsFilter:       'all',
  stats:             null,
  heatmap:           null,
  connections:       [],
  reputation:        null,
  reputationHistory: null,
  currentTab:        'posts',
  loaded: {
    profile:      false,
    posts:        false,
    stats:        false,
    connections:  false,
    reputation:   false,
  },
};

// ── DOM helpers ───────────────────────────────────────────────────────────────

function $id(id) { return document.getElementById(id); }

function setTabContent(html) {
  const el = $id('profile-tab-content');
  if (el) el.innerHTML = html;
}

function setActiveTabBtn(tab) {
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.style.background = isActive ? 'var(--primary)' : 'var(--bg-tertiary)';
    btn.style.color       = isActive ? '#fff'          : 'var(--text-secondary)';
  });
}

// ── Tab renderers ─────────────────────────────────────────────────────────────

async function renderPostsTab(forceReload = false) {
  if (!state.loaded.posts || forceReload) {
    setTabContent(buildSkeleton());
    state.posts = await profileApi.fetchMyPosts(state.postsFilter);
    state.loaded.posts = true;
  }
  setTabContent(buildPostsTab(state.posts, state.postsFilter));
}

async function renderStatsTab() {
  if (!state.loaded.stats) {
    setTabContent(buildSkeleton());
    [state.stats, state.heatmap] = await Promise.all([
      profileApi.fetchMyStats(),
      profileApi.fetchActivityHeatmap(),
    ]);
    state.loaded.stats = true;
  }
  setTabContent(buildStatsTab(state.stats, state.heatmap));
}

async function renderConnectionsTab() {
  if (!state.loaded.connections) {
    setTabContent(buildSkeleton());
    state.connections = await profileApi.fetchMyConnections();
    state.loaded.connections = true;
  }
  setTabContent(buildConnectionsTab(state.connections));
}

async function renderReputationTab() {
  if (!state.loaded.reputation) {
    setTabContent(buildSkeleton());
    [state.reputation, state.reputationHistory] = await Promise.all([
      profileApi.fetchReputation(),
      profileApi.fetchReputationHistory(),
    ]);
    state.loaded.reputation = true;
  }
  setTabContent(buildReputationTab(state.reputation, state.reputationHistory));
}

// ── Profile header loader ─────────────────────────────────────────────────────

async function loadProfileHeader() {
  if (state.loaded.profile) return;
  const data = await profileApi.fetchProfileData();
  if (!data) return;
  state.profileData = data;
  state.loaded.profile = true;

  const wrap = $id('profile-header-container');
  if (wrap) wrap.innerHTML = buildProfileHeader(data);
}

// ── Public init ───────────────────────────────────────────────────────────────

export async function initProfile() {
  await loadProfileHeader();
  setActiveTabBtn('posts');
  await renderPostsTab();
}

// ── Edit Profile modal ────────────────────────────────────────────────────────

function openEditModal() {
  const d = state.profileData;
  if (!d) return;

  // Populate fields
  const setVal = (id, val) => { const el = $id(id); if (el) el.value = val || ''; };
  setVal('edit-profile-name',  d.name);
  setVal('edit-profile-bio',   d.bio);

  // Render learning goals list
  renderGoalsList(d.learning_goals || []);

  const modal = $id('profile-edit-modal');
  if (modal) modal.classList.add('active');
}

function renderGoalsList(goals) {
  const container = $id('edit-goals-list');
  if (!container) return;
  container.innerHTML = goals.map((g, i) => `
    <div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;">
      <span style="flex:1;font-size:0.85rem;color:var(--text-primary);">${g}</span>
      <button
        data-action="profile-remove-goal"
        data-index="${i}"
        style="padding:0.2rem 0.5rem;background:rgba(239,68,68,0.1);border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;color:#ef4444;">✕</button>
    </div>`).join('');
}

// ── Academic modal ────────────────────────────────────────────────────────────

async function openAcademicModal() {
  const data = await profileApi.fetchAcademicInfo();
  if (!data) return;

  const setChips = (id, arr) => {
    const el = $id(id);
    if (el) el.value = (arr || []).join(', ');
  };
  setChips('academic-subjects',       data.subjects);
  setChips('academic-strong',         data.strong_subjects);
  setChips('academic-help',           data.help_subjects);
  setChips('academic-study-prefs',    data.study_preferences);

  const styleEl = $id('academic-learning-style');
  if (styleEl) styleEl.value = data.learning_style || '';

  const modal = $id('profile-academic-modal');
  if (modal) modal.classList.add('active');
}

// ── Avatar modal ──────────────────────────────────────────────────────────────

function openAvatarModal() {
  const modal = $id('profile-avatar-modal');
  if (modal) modal.classList.add('active');
}

// ── Close any profile modal ───────────────────────────────────────────────────

function closeProfileModal(modalId) {
  const modal = $id(modalId);
  if (modal) modal.classList.remove('active');
}

// ── Helpers: parse comma-separated chips ─────────────────────────────────────

function parseChips(id) {
  const el = $id(id);
  if (!el) return [];
  return el.value.split(',').map(s => s.trim()).filter(Boolean);
}

// ── ProfileHandlers — exported to be spread into UNIFIED_ACTIONS ──────────────

export const ProfileHandlers = {

  // ── Tab switching ──────────────────────────────────────────────────────────

  'profile-tab': async (target) => {
    const tab = target.dataset.tab;
    if (!tab || tab === state.currentTab) return;
    state.currentTab = tab;
    setActiveTabBtn(tab);

    if (tab === 'posts')       await renderPostsTab();
    if (tab === 'stats')       await renderStatsTab();
    if (tab === 'connections') await renderConnectionsTab();
    if (tab === 'reputation')  await renderReputationTab();
  },

  // ── Post filtering ─────────────────────────────────────────────────────────

  'profile-filter-posts': async (target) => {
    const filter = target.dataset.filter;
    if (!filter || filter === state.postsFilter) return;
    state.postsFilter = filter;
    state.loaded.posts = false;
    await renderPostsTab(true);
  },

  // ── Pin / Unpin ────────────────────────────────────────────────────────────

  'profile-pin-post': async (target) => {
    const postId = target.dataset.postId || target.closest('[data-post-id]')?.dataset.postId;
    if (!postId) return;

    const res = await profileApi.pinProfilePost(postId);
    if (res?.status === 'success') {
      showToast('Post pinned 📌', 'success');
      state.loaded.posts = false;
      await renderPostsTab(true);
    } else {
      showToast(res?.message || 'Could not pin post', 'error');
    }
  },

  'profile-unpin-post': async (target) => {
    const postId = target.dataset.postId || target.closest('[data-post-id]')?.dataset.postId;
    if (!postId) return;

    const res = await profileApi.unpinProfilePost(postId);
    if (res?.status === 'success') {
      showToast('Post unpinned', 'success');
      state.loaded.posts = false;
      await renderPostsTab(true);
    } else {
      showToast(res?.message || 'Could not unpin post', 'error');
    }
  },

  // ── Delete post ────────────────────────────────────────────────────────────

  'profile-delete-post': async (target) => {
    const postId = target.dataset.postId || target.closest('[data-post-id]')?.dataset.postId;
    if (!postId) return;

    if (!confirm('Delete this post? This cannot be undone.')) return;

    const res = await profileApi.deleteProfilePost(postId);
    if (res?.status === 'success') {
      showToast('Post deleted', 'success');
      // Remove card from DOM immediately without full reload
      const card = document.querySelector(`.profile-post-card[data-post-id="${postId}"]`);
      if (card) card.remove();
      // Also update state
      state.posts = state.posts.filter(p => String(p.id) !== String(postId));
      // Refresh header stats count
      state.loaded.profile = false;
      await loadProfileHeader();
    } else {
      showToast(res?.message || 'Could not delete post', 'error');
    }
  },

  // ── Open modals ────────────────────────────────────────────────────────────

  'profile-open-edit': () => openEditModal(),

  'profile-open-academic': () => openAcademicModal(),

  'profile-open-avatar': () => openAvatarModal(),

  // ── Close modals ───────────────────────────────────────────────────────────

  'profile-close-modal': (target) => {
    const id = target.dataset.modalId;
    if (id) closeProfileModal(id);
  },

  // ── Save profile edit ──────────────────────────────────────────────────────

  'profile-save-edit': async (target) => {
    const name = $id('edit-profile-name')?.value?.trim();
    const bio  = $id('edit-profile-bio')?.value?.trim();

    if (!name) { showToast('Name is required', 'error'); return; }

    target.disabled = true;
    target.textContent = 'Saving…';

    const res = await profileApi.saveProfileEdit({ name, bio });

    target.disabled = false;
    target.textContent = 'Save Changes';

    if (res?.status === 'success') {
      showToast('Profile updated ✅', 'success');
      closeProfileModal('profile-edit-modal');
      // Reload header
      state.loaded.profile = false;
      await loadProfileHeader();
    } else {
      showToast(res?.message || 'Failed to save', 'error');
    }
  },

  // ── Learning goals ─────────────────────────────────────────────────────────

  'profile-add-goal': async () => {
    const input = $id('edit-goal-input');
    const goal = input?.value?.trim();
    if (!goal) return;

    const res = await profileApi.addLearningGoal(goal);
    if (res?.status === 'success') {
      if (input) input.value = '';
      const newGoals = res.data?.learning_goals || [];
      if (state.profileData) state.profileData.learning_goals = newGoals;
      renderGoalsList(newGoals);
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
      if (state.profileData) state.profileData.learning_goals = newGoals;
      renderGoalsList(newGoals);
    } else {
      showToast(res?.message || 'Could not remove goal', 'error');
    }
  },

  // ── Save academic info ─────────────────────────────────────────────────────

  'profile-save-academic': async (target) => {
    const payload = {
      subjects:          parseChips('academic-subjects'),
      strong_subjects:   parseChips('academic-strong'),
      help_subjects:     parseChips('academic-help'),
      study_preferences: parseChips('academic-study-prefs'),
      learning_style:    $id('academic-learning-style')?.value?.trim() || '',
    };

    target.disabled = true;
    target.textContent = 'Saving…';

    const res = await profileApi.saveAcademicInfo(payload);

    target.disabled = false;
    target.textContent = 'Save';

    if (res?.status === 'success') {
      showToast('Academic info saved ✅', 'success');
      closeProfileModal('profile-academic-modal');
    } else {
      showToast(res?.message || 'Failed to save', 'error');
    }
  },

  // ── Avatar upload ──────────────────────────────────────────────────────────

  'profile-upload-avatar': async () => {
    const input = $id('avatar-file-input');
    if (!input?.files?.length) {
      showToast('Please choose a file first', 'error');
      return;
    }

    const btn = document.querySelector('[data-action="profile-upload-avatar"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

    const res = await profileApi.uploadAvatar(input.files[0]);

    if (btn) { btn.disabled = false; btn.textContent = 'Upload'; }

    if (res?.status === 'success') {
      const url = res.data?.avatar_url;
      showToast('Avatar updated ✅', 'success');
      closeProfileModal('profile-avatar-modal');
      // Reload header
      if (state.profileData) state.profileData.avatar = url;
      state.loaded.profile = false;
      await loadProfileHeader();
    } else {
      showToast(res?.message || 'Upload failed', 'error');
    }
  },

  // ── Remove avatar ──────────────────────────────────────────────────────────

  'profile-remove-avatar': async () => {
    if (!confirm('Remove your profile picture?')) return;

    const res = await profileApi.removeAvatar();
    if (res?.status === 'success') {
      showToast('Avatar removed', 'success');
      closeProfileModal('profile-avatar-modal');
      if (state.profileData) state.profileData.avatar = null;
      state.loaded.profile = false;
      await loadProfileHeader();
    } else {
      showToast(res?.message || 'Failed to remove avatar', 'error');
    }
  },

  // ── Navigate to my profile (triggers init) ─────────────────────────────────

  'open-my-profile': async () => {
    // Show the section using the existing navigate-to pattern
    const section = document.querySelector('section#my-profile');
    if (!section) return;
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    section.classList.add('active');
    await initProfile();
  },
};
