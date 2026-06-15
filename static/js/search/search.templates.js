export function renderThreadDetailsHTML(thread) {
  return `
    <div class="thread-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h3 class="thread-title" style="font-size: 1.25rem; font-weight: 600;">${thread.title}</h3>
      <span style="padding: 0.25rem 0.75rem; background: ${thread.requires_approval ? 'var(--warning)' : 'var(--success)'}; color: white; border-radius: 9999px; font-size: 0.75rem;">
        ${thread.requires_approval ? "🔒 Private" : "🌎 Public"}
      </span>
    </div>

    <p style="margin-bottom: 1rem; color: var(--text-secondary);">${thread.description || 'No description'}</p>

    ${thread.tags && thread.tags.length > 0 ? `
    <div style="margin-bottom: 1rem;">
      <strong>Tags:</strong> 
      ${thread.tags.map(tag => `<span class="tag" style="display: inline-block; padding: 0.25rem 0.75rem; background: var(--bg-tertiary); border-radius: 9999px; font-size: 0.875rem; margin-right: 0.5rem;">#${tag}</span>`).join('')}
    </div>
    ` : ''}

    <p style="margin-bottom: 0.5rem;"><strong>Department:</strong> ${thread.department || "None"}</p>
    <p style="margin-bottom: 1rem;"><strong>Members:</strong> ${thread.total_users} / ${thread.max_members || '∞'}</p>
    <p style="margin-bottom: 1rem;"><strong>Last Activity:</strong> ${new Date(thread.last_activity).toLocaleString()}</p>

    ${thread.members_data && thread.members_data.length > 0 ? `
    <h4 style="margin-bottom: 0.75rem;">Members Preview:</h4>
    <div class="member-list" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
      ${thread.members_data.slice(0, 5).map(member => `
        <div class="member" style="text-align: center;">
          <img src="${member.avatar || '/static/default-avatar.png'}" style="width: 48px; height: 48px; border-radius: 50%; margin-bottom: 0.25rem;">
          <div class="member-name" style="font-size: 0.75rem; font-weight: 500;">${member.name.substring(0, 10)}</div>
          <div class="member-reputation-level" style="font-size: 0.625rem; color: var(--text-secondary);">${member.reputation_level || ''}</div>
        </div>
      `).join('')}
      ${thread.members_data.length > 5 ? `<div style="font-size: 0.875rem; color: var(--text-secondary); align-self: center;">+${thread.members_data.length - 5} more</div>` : ""}
    </div>
    ` : ''}

    <div style="display: flex; gap: 0.75rem;">
      <button id="join-thread-btn" 
              data-action="join-thread"
              class="btn btn-primary" 
              style="flex: 1; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
        Join Thread
      </button>
      <button data-action='close-modal' 
              data-modal-id='thread-view-modal' 
              class="btn btn-secondary"
              style="padding: 0.75rem 1.5rem; background: var(--bg-secondary); border: none; border-radius: 8px; cursor: pointer;">
        Cancel
      </button>
    </div>
  `;
}