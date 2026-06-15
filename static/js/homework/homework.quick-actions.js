/**
 * ============================================================================
 * HOMEWORK QUICK ACTIONS
 * Bulk operations and quick status changes
 * Uses: POST /assignments/<id>/quick-actions endpoint
 * ============================================================================
 */

import { homeworkAPI } from './homework.api.js';
import { showHomeworkToast } from './homework.utils.js';
import { refreshCurrentTab } from './homework.render.js';

/**
 * Handle quick action on assignment
 */
export async function handleQuickAction(assignmentId, action) {
  try {
    const response = await homeworkAPI.quickAction(assignmentId, action);

    if (response.status === 'success') {
      const messages = {
        start: 'Assignment started! 🚀',
        complete: 'Assignment completed! 🎉',
        reopen: 'Assignment reopened',
        share: 'Shared with connections 🤝',
        unshare: 'Unshared from connections'
      };

      showHomeworkToast(messages[action] || response.message, 'success');
      refreshCurrentTab();
    } else {
      throw new Error(response.message || 'Failed to perform action');
    }
  } catch (error) {
    console.error('Error performing quick action:', error);
    showHomeworkToast(error.message || 'Failed to perform action', 'error');
  }
}

/**
 * Render quick action button group
 */
export function renderQuickActions(assignment) {
  const actions = [];

  // Status-based actions
  if (assignment.status === 'not_started') {
    actions.push({
      action: 'start',
      label: 'Start',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>`,
      class: 'hw-quick-action-start'
    });
  } else if (assignment.status === 'in_progress') {
    actions.push({
      action: 'complete',
      label: 'Complete',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>`,
      class: 'hw-quick-action-complete'
    });
  } else if (assignment.status === 'completed') {
    actions.push({
      action: 'reopen',
      label: 'Reopen',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="1 4 1 10 7 10"/>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>`,
      class: 'hw-quick-action-reopen'
    });
  }

  // Share/Unshare
  if (!assignment.is_shared && assignment.status !== 'completed') {
    actions.push({
      action: 'share',
      label: 'Get Help',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>`,
      class: 'hw-quick-action-share'
    });
  } else if (assignment.is_shared) {
    actions.push({
      action: 'unshare',
      label: 'Unshare',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>`,
      class: 'hw-quick-action-unshare'
    });
  }

  return actions.map(action => `
    <button 
      class="hw-quick-action-btn ${action.class}" 
      data-action="quick-action"
      data-assignment-id="${assignment.id}"
      data-quick-action="${action.action}"
      title="${action.label}"
    >
      ${action.icon}
      <span>${action.label}</span>
    </button>
  `).join('');
}

/**
 * Enable bulk selection mode
 */
export function enableBulkMode() {
  const container = document.getElementById('my-homework-container');
  
  if (!container) return;

  container.classList.add('hw-bulk-mode');

  // Add checkboxes to each card
  const cards = container.querySelectorAll('.hw-card');
  cards.forEach(card => {
    if (!card.querySelector('.hw-bulk-checkbox')) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'hw-bulk-checkbox';
      checkbox.dataset.assignmentId = card.dataset.assignmentId;
      
      const checkboxWrapper = document.createElement('div');
      checkboxWrapper.className = 'hw-bulk-checkbox-wrapper';
      checkboxWrapper.appendChild(checkbox);
      
      card.insertBefore(checkboxWrapper, card.firstChild);
    }
  });

  // Show bulk actions bar
  const bulkBar = document.getElementById('hw-bulk-actions-bar');
  if (bulkBar) {
    bulkBar.classList.remove('hidden');
  }
}

/**
 * Disable bulk selection mode
 */
export function disableBulkMode() {
  const container = document.getElementById('my-homework-container');
  
  if (!container) return;

  container.classList.remove('hw-bulk-mode');

  // Remove checkboxes
  const checkboxes = container.querySelectorAll('.hw-bulk-checkbox-wrapper');
  checkboxes.forEach(wrapper => wrapper.remove());

  // Hide bulk actions bar
  const bulkBar = document.getElementById('hw-bulk-actions-bar');
  if (bulkBar) {
    bulkBar.classList.add('hidden');
  }
}

/**
 * Get selected assignment IDs
 */
export function getSelectedAssignments() {
  const checkboxes = document.querySelectorAll('.hw-bulk-checkbox:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.dataset.assignmentId));
}

/**
 * Handle bulk action
 */
export async function handleBulkAction(action) {
  const selectedIds = getSelectedAssignments();

  if (selectedIds.length === 0) {
    showHomeworkToast('Please select assignments first', 'info');
    return;
  }

  const confirmMessages = {
    complete: `Mark ${selectedIds.length} assignment(s) as complete?`,
    delete: `Delete ${selectedIds.length} assignment(s)? This cannot be undone.`,
    share: `Share ${selectedIds.length} assignment(s) for help?`
  };

  if (!confirm(confirmMessages[action] || 'Perform this action?')) {
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const id of selectedIds) {
    try {
      await homeworkAPI.quickAction(id, action);
      successCount++;
    } catch (error) {
      console.error(`Failed to ${action} assignment ${id}:`, error);
      failCount++;
    }
  }

  if (successCount > 0) {
    showHomeworkToast(`${successCount} assignment(s) updated`, 'success');
    refreshCurrentTab();
    disableBulkMode();
  }

  if (failCount > 0) {
    showHomeworkToast(`${failCount} assignment(s) failed to update`, 'error');
  }
}

/**
 * Render bulk actions bar
 */
export function renderBulkActionsBar() {
  return `
    <div id="hw-bulk-actions-bar" class="hw-bulk-actions-bar hidden">
      <div class="hw-bulk-actions-left">
        <button class="hw-bulk-btn" data-action="select-all-homework">
          Select All
        </button>
        <button class="hw-bulk-btn" data-action="deselect-all-homework">
          Deselect All
        </button>
        <span class="hw-bulk-count">
          <span id="hw-selected-count">0</span> selected
        </span>
      </div>

      <div class="hw-bulk-actions-right">
        <button class="hw-bulk-action-btn" data-action="bulk-action" data-bulk-action="complete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Mark Complete
        </button>
        <button class="hw-bulk-action-btn" data-action="bulk-action" data-bulk-action="share">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
        <button class="hw-bulk-action-btn hw-bulk-action-danger" data-action="bulk-action" data-bulk-action="delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Delete
        </button>
        <button class="hw-bulk-btn hw-bulk-cancel" data-action="cancel-bulk-mode">
          Cancel
        </button>
      </div>
    </div>
  `;
}

/**
 * Update selected count
 */
export function updateSelectedCount() {
  const count = getSelectedAssignments().length;
  const countEl = document.getElementById('hw-selected-count');
  
  if (countEl) {
    countEl.textContent = count;
  }
}

/**
 * Select all assignments
 */
export function selectAllAssignments() {
  const checkboxes = document.querySelectorAll('.hw-bulk-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = true;
  });
  updateSelectedCount();
}

/**
 * Deselect all assignments
 */
export function deselectAllAssignments() {
  const checkboxes = document.querySelectorAll('.hw-bulk-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = false;
  });
  updateSelectedCount();
}

/**
 * Setup checkbox listeners
 */
export function setupBulkCheckboxListeners() {
  // Listen for checkbox changes
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('hw-bulk-checkbox')) {
      updateSelectedCount();
    }
  });
}
