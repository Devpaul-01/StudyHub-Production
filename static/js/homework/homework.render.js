/**
 * ============================================================================
 * HOMEWORK RENDER FUNCTIONS
 * DOM manipulation and rendering logic
 * ============================================================================
 */

import { homeworkState } from './homework.state.js';
import { homeworkAPI } from './homework.api.js';
import {
  renderHomeworkSection,
  renderMyHomeworkList,
  renderMyHomeworkCard,
  renderConnectionsHomeworkList,
  renderLoadingState
} from './homework.templates.js';
import { showHomeworkToast } from './homework.utils.js';
import { loadStatsTab, loadDynamicStatsComponents} from './homework.stats.js';

function renderMyHomeworkFromCache() {
  const container = document.getElementById('my-homework-container');
  if (!container) return;

  container.innerHTML = renderMyHomeworkList(
    homeworkState.myAssignments,
    homeworkState.myAssignmentsStats
  );
}

/**
 * Render connections homework from cached state
 */
function renderConnectionsHomeworkFromCache() {
  const container = document.getElementById('connections-homework-container');
  if (!container) return;

  container.innerHTML = renderConnectionsHomeworkList(
    homeworkState.connectionsHomework
  );
}

/**
 * Render stats from cached state
 */
function renderStatsFromCache() {
  const container = document.getElementById('stats-container');
  if (!container) return;

  const statsData = homeworkState.getStatsData();
  if (statsData) {
    container.innerHTML = renderStatsDashboard(statsData);
    // Load dynamic components
    loadDynamicStatsComponents();
  }
}


/**
 * Initialize homework section
 */
export async function initializeHomeworkSection() {
  const homeworkSection = document.getElementById('homework');
  
  if (!homeworkSection) {
    console.error('Homework section not found');
    return;
  }

  // Render main structure
  

  // Load initial data
  await loadMyHomework();
}

/**
 * Switch between tabs
 */
export function switchTab(tab) {
  // Update state
  homeworkState.setActiveTab(tab);

  // Update tab buttons
  document.querySelectorAll('.hw-tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
    }
  });

  // Update tab panels
  document.querySelectorAll('.hw-tab-panel').forEach(panel => {
    panel.classList.remove('active');
    if (panel.dataset.tabPanel === tab) {
      panel.classList.add('active');
    }
  });

  // Load data for active tab (with caching)
  if (tab === 'my-homework') {
    // Only fetch if not already loaded
    if (!homeworkState.isDataLoaded('myHomework')) {
      loadMyHomework();
    } else {
      // Render from cache
      renderMyHomeworkFromCache();
    }
  } else if (tab === 'connections-homework') {
    // Only fetch if not already loaded
    if (!homeworkState.isDataLoaded('connectionsHomework')) {
      loadConnectionsHomework();
    } else {
      // Render from cache
      renderConnectionsHomeworkFromCache();
    }
  } else if (tab === 'stats') {
    // Only fetch if not already loaded
    if (!homeworkState.isDataLoaded('stats')) {
      loadStatsTab();
    } else {
      // Render from cache
      renderStatsFromCache();
    }
  }
}
/**
 * Load my homework
 */
export async function loadMyHomework() {
  const container = document.getElementById('my-homework-container');
  
  if (!container) return;
  

  try {
    // Show loading
    container.innerHTML = renderLoadingState();
    homeworkState.setLoading('myHomework', true);

    // Fetch data
    const response = await homeworkAPI.getMyAssignments({
      status: homeworkState.filters.status
    });

    homeworkState.setLoading('myHomework', false);

    if (response.status === 'success') {
      homeworkState.setMyAssignments(response.data);
      container.innerHTML = renderMyHomeworkList(
        response.data.assignments,
        response.data.stats
      );
    } else {
      throw new Error(response.message || 'Failed to load homework');
    }
  } catch (error) {
    console.error('Error loading my homework:', error);
    homeworkState.setLoading('myHomework', false);
    container.innerHTML = `
      <div class="hw-error-state">
        <p>Failed to load homework. Please try again.</p>
        <button class="hw-btn hw-btn-primary" data-action="reload-my-homework">
          Retry
        </button>
      </div>
    `;
  }
}

/**
 * Load connections homework
 */
export async function loadConnectionsHomework() {
  const container = document.getElementById('connections-homework-container');
  
  if (!container) return;

  try {
    // Show loading
    container.innerHTML = renderLoadingState();
    homeworkState.setLoading('connectionsHomework', true);

    // Fetch data
    const response = await homeworkAPI.getConnectionsHomework();

    homeworkState.setLoading('connectionsHomework', false);

    if (response.status === 'success') {
      homeworkState.setConnectionsHomework(response.data);
      container.innerHTML = renderConnectionsHomeworkList(response.data.homework);
    } else {
      throw new Error(response.message || 'Failed to load connections homework');
    }
  } catch (error) {
    console.error('Error loading connections homework:', error);
    homeworkState.setLoading('connectionsHomework', false);
    container.innerHTML = `
      <div class="hw-error-state">
        <p>Failed to load homework. Please try again.</p>
        <button class="hw-btn hw-btn-primary" data-action="reload-connections-homework">
          Retry
        </button>
      </div>
    `;
  }
}

/**
 * Refresh current tab
 */
export function refreshCurrentTab() {
  const activeTab = homeworkState.getActiveTab();
  
  // Force refresh by clearing cache
  if (activeTab === 'my-homework') {
    homeworkState.forceRefresh('myHomework');
    loadMyHomework();
  } else if (activeTab === 'connections-homework') {
    homeworkState.forceRefresh('connectionsHomework');
    loadConnectionsHomework();
  } else if (activeTab === 'stats') {
    homeworkState.forceRefresh('stats');
    loadStatsTab();
  }
}

/**
 * Update assignment card UI
 */
export function updateAssignmentCard(assignmentId, updates) {
  const card = document.querySelector(`[data-assignment-id="${assignmentId}"]`);
  
  if (!card) return;

  // Update status badge
  if (updates.status) {
    const statusBadge = card.querySelector('.hw-badge.hw-status');
    if (statusBadge) {
      statusBadge.className = `hw-badge ${getStatusBadgeClass(updates.status)}`;
      statusBadge.textContent = getStatusDisplayText(updates.status);
    }
  }

  // Update shared indicator
  if (updates.is_shared !== undefined) {
    // Refresh the card
    refreshCurrentTab();
  }
}

/**
 * Remove assignment card from UI
 */
export function removeAssignmentCard(assignmentId) {
  const card = document.querySelector(`[data-assignment-id="${assignmentId}"]`);
  
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      card.remove();
      
      // Check if list is empty
      const list = document.querySelector('#my-homework-container .hw-list');
      if (list && list.children.length === 0) {
        refreshCurrentTab();
      }
    }, 300);
  }
}

/**
 * Add assignment card to UI
 */
export function addAssignmentCard(assignment) {
  const list = document.querySelector('#my-homework-container .hw-list');
  
  if (list) {
    const card = renderMyHomeworkCard(assignment);
    list.insertAdjacentHTML('afterbegin', card);
    
    // Animate in
    const newCard = list.firstElementChild;
    newCard.style.opacity = '0';
    newCard.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
      newCard.style.opacity = '1';
      newCard.style.transform = 'translateY(0)';
    }, 10);
  } else {
    // No list exists, refresh
    refreshCurrentTab();
  }
}
