// ============================================================================
// INITIALIZATION
// ============================================================================
(async function init() {
  await showUserBadgeSummary();
  await setupEventListeners();
  await loadAllBadges(); // Default view
})();

// ============================================================================
// DOM REFERENCES
// ============================================================================
const badgesContainer = document.getElementById("badges-container");
const userBadgesSummary = document.getElementById("user-badges-summary");
const badgeProgressSection = document.getElementById("badge-progress");
const badgeProgressList = document.getElementById("badge-progress-list");
const badgeDetailModal = document.getElementById("badge-detail-modal");
const badgeTabs = document.getElementById("badge-tabs");

// ============================================================================
// USER BADGE SUMMARY (Like your showUserRank)
// ============================================================================
async function showUserBadgeSummary() {
  try {
    userBadgesSummary.innerHTML = `<div class="skeleton-loader"></div>`;
    
    const response = await api.get("/badges/my-badges");
    
    if (response.status === "success") {
      const { badges, total_earned, by_rarity, featured } = response.data;
      
      userBadgesSummary.innerHTML = `
        <div class="badge-summary-header">
          <h1>🏆 YOUR BADGE COLLECTION</h1>
          <div class="badge-count">
            <span class="earned">${total_earned}</span>
            <span class="separator">/</span>
            <span class="total">${badges.length}</span>
            <span class="label">Badges Earned</span>
          </div>
        </div>

        <div class="rarity-breakdown">
          ${Object.entries(by_rarity).map(([rarity, badges]) => `
            <div class="rarity-stat rarity-${rarity}">
              <span class="rarity-icon">${getRarityIcon(rarity)}</span>
              <span class="rarity-count">${badges.length}</span>
              <span class="rarity-name">${rarity}</span>
            </div>
          `).join('')}
        </div>

        <div class="featured-badges">
          <h3>✨ Featured Badges</h3>
          <div class="featured-grid">
            ${featured.map(badge => createBadgeCard(badge, true)).join('')}
          </div>
        </div>

        <button class="view-progress-btn" onclick="toggleProgressView()">
          📊 View Badge Progress
        </button>
      `;
    } else {
      showError(userBadgesSummary, "Failed to load badge summary");
    }
  } catch (error) {
    showError(userBadgesSummary, "Error loading badges: " + error);
  }
}

// ============================================================================
// BADGE TYPE SWITCHING (Like your switchType)
// ============================================================================
async function switchBadgeType(event, type) {
  // Remove active from all tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.closest('.tab').classList.add('active');

  // Hide progress section for "all" and "earned" views
  if (type === 'all' || type === 'earned') {
    badgeProgressSection.classList.add('hidden');
  }

  switch(type) {
    case 'all':
      await loadAllBadges();
      break;
    case 'earned':
      await loadMyBadges();
      break;
    case 'engagement':
    case 'quality':
    case 'consistency':
    case 'social':
    case 'milestone':
      await loadBadgesByCategory(type);
      break;
  }
}

// ============================================================================
// BADGE LOADING FUNCTIONS (Like your loadGlobal, loadDepartment)
// ============================================================================
async function loadAllBadges() {
  try {
    badgesContainer.innerHTML = createSkeletonLoader();
    
    const response = await api.get("/badges/available");
    
    if (response.status === "success") {
      const { badges, by_category } = response.data;
      displayBadgesByCategory(by_category);
    } else {
      showError(badgesContainer, response.message);
    }
  } catch (error) {
    showError(badgesContainer, "Failed to load badges: " + error);
  }
}

async function loadMyBadges() {
  try {
    badgesContainer.innerHTML = createSkeletonLoader();
    
    const response = await api.get("/badges/my-badges");
    
    if (response.status === "success") {
      const { badges } = response.data;
      
      if (badges.length === 0) {
        badgesContainer.innerHTML = `
          <div class="empty-state">
            <h2>🏆 No Badges Yet</h2>
            <p>Start earning badges by being active!</p>
            <button onclick="switchBadgeType(event, 'all')">
              View All Badges
            </button>
          </div>
        `;
        return;
      }
      
      displayBadges(badges, true);
    }
  } catch (error) {
    showError(badgesContainer, "Failed to load your badges: " + error);
  }
}

async function loadBadgesByCategory(category) {
  try {
    badgesContainer.innerHTML = createSkeletonLoader();
    
    const response = await api.get(`/badges/available?category=${category}`);
    
    if (response.status === "success") {
      const { badges } = response.data;
      
      // Also load progress for this category
      await loadBadgeProgress(category);
      
      displayBadges(badges, false, category);
    }
  } catch (error) {
    showError(badgesContainer, "Failed to load category badges: " + error);
  }
}

// ============================================================================
// BADGE PROGRESS (Your "rising stars" equivalent)
// ============================================================================
async function loadBadgeProgress(category = null) {
  try {
    const url = category 
      ? `/badges/progress?category=${category}` 
      : '/badges/progress';
      
    const response = await api.get(url);
    
    if (response.status === "success") {
      const { progress } = response.data;
      
      if (progress.length > 0) {
        badgeProgressSection.classList.remove('hidden');
        displayBadgeProgress(progress);
      }
    }
  } catch (error) {
    console.error("Failed to load progress:", error);
  }
}

function displayBadgeProgress(progressData) {
  badgeProgressList.innerHTML = progressData.map(item => {
    const { badge, progress } = item;
    const { percentage, current, required, type } = progress;
    
    return `
      <div class="badge-progress-card">
        <div class="badge-icon-large">${badge.icon}</div>
        <div class="progress-info">
          <h4>${badge.name}</h4>
          <p class="badge-description">${badge.description}</p>
          
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${percentage}%"></div>
            <span class="progress-text">${percentage}%</span>
          </div>
          
          <div class="progress-details">
            <span>${current} / ${required} ${type}</span>
            <span class="remaining">${required - current} more needed</span>
          </div>
        </div>
        
        <button class="view-badge-btn" onclick="viewBadgeDetails(${badge.id})">
          View Details
        </button>
      </div>
    `;
  }).join('');
}

// ============================================================================
// BADGE DISPLAY FUNCTIONS (Like your showGlobal, showDepartment)
// ============================================================================
function displayBadges(badges, isEarned = false, category = null) {
  badgesContainer.innerHTML = '';
  
  if (category) {
    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
      <h2>${getCategoryIcon(category)} ${category} Badges</h2>
      <p>${getCategoryDescription(category)}</p>
    `;
    badgesContainer.appendChild(header);
  }
  
  const grid = document.createElement('div');
  grid.className = 'badges-grid';
  
  badges.forEach(badge => {
    const card = createBadgeCard(badge, isEarned);
    grid.innerHTML += card;
  });
  
  badgesContainer.appendChild(grid);
}

function displayBadgesByCategory(categorizedBadges) {
  badgesContainer.innerHTML = '';
  
  Object.entries(categorizedBadges).forEach(([category, badges]) => {
    if (badges.length === 0) return;
    
    const section = document.createElement('div');
    section.className = 'badge-category-section';
    section.innerHTML = `
      <div class="category-header">
        <h2>${getCategoryIcon(category)} ${category}</h2>
        <span class="badge-count">${badges.length} badges</span>
      </div>
      
      <div class="badges-grid">
        ${badges.map(badge => createBadgeCard(badge, badge.has_earned)).join('')}
      </div>
    `;
    
    badgesContainer.appendChild(section);
  });
}

function createBadgeCard(badge, isEarned) {
  return `
    <div class="badge-card ${isEarned ? 'earned' : 'locked'} rarity-${badge.rarity}"
         data-badge-id="${badge.id}"
         onclick="viewBadgeDetails(${badge.id})">
      
      <div class="badge-icon-wrapper">
        <span class="badge-icon">${badge.icon}</span>
        ${isEarned ? '<span class="earned-checkmark">✓</span>' : '<span class="lock-icon">🔒</span>'}
      </div>
      
      <div class="badge-info">
        <h3 class="badge-name">${badge.name}</h3>
        <p class="badge-rarity rarity-${badge.rarity}">${badge.rarity}</p>
        <p class="badge-description">${badge.description}</p>
        
        ${isEarned ? `
          <div class="earned-date">
            Earned: ${formatDate(badge.earned_at)}
          </div>
        ` : ''}
        
        ${badge.awarded_count ? `
          <div class="awarded-count">
            ${badge.awarded_count} users earned this
          </div>
        ` : ''}
      </div>
      
      ${isEarned && !badge.is_featured ? `
        <button class="feature-btn" onclick="toggleFeatureBadge(event, ${badge.id})">
          ⭐ Feature
        </button>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// BADGE DETAIL MODAL (Like your changesModal)
// ============================================================================
async function viewBadgeDetails(badgeId) {
  try {
    badgeDetailModal.classList.remove('hidden');
    
    const response = await api.get(`/badges/${badgeId}/details`);
    
    if (response.status === "success") {
      const { badge, has_earned, earned_at, progress, recent_earners } = response.data;
      
      document.getElementById('badge-detail-content').innerHTML = `
        <div class="badge-detail-hero">
          <span class="badge-icon-huge">${badge.icon}</span>
          <h1>${badge.name}</h1>
          <span class="badge-rarity-tag rarity-${badge.rarity}">${badge.rarity}</span>
        </div>
        
        <p class="badge-full-description">${badge.description}</p>
        
        ${has_earned ? `
          <div class="earned-status">
            ✅ You earned this on ${formatDate(earned_at)}
          </div>
        ` : progress ? `
          <div class="progress-status">
            <h3>Your Progress</h3>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${progress.percentage}%"></div>
              <span>${progress.percentage}%</span>
            </div>
            <p>${progress.current} / ${progress.required} ${progress.type}</p>
            <p class="remaining">${progress.remaining} more needed!</p>
          </div>
        ` : ''}
        
        <div class="badge-stats">
          <h3>Badge Statistics</h3>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-value">${badge.awarded_count}</span>
              <span class="stat-label">Total Earned</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${badge.category}</span>
              <span class="stat-label">Category</span>
            </div>
          </div>
        </div>
        
        ${recent_earners.length > 0 ? `
          <div class="recent-earners">
            <h3>Recent Earners</h3>
            <div class="earners-list">
              ${recent_earners.map(earner => `
                <div class="earner-item">
                  <img src="${earner.avatar}" alt="${earner.username}">
                  <span>@${earner.username}</span>
                  <span class="earned-time">${formatTimeAgo(earner.earned_at)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
    }
  } catch (error) {
    showError(document.getElementById('badge-detail-content'), "Failed to load badge details");
  }
}

function closeBadgeModal() {
  badgeDetailModal.classList.add('hidden');
}

// ============================================================================
// BADGE FEATURING (Like your connection status toggles)
// ============================================================================
async function toggleFeatureBadge(event, badgeId) {
  event.stopPropagation(); // Don't trigger modal
  
  try {
    const response = await api.post(`/badges/feature/${badgeId}`);
    
    if (response.status === "success") {
      showToast(response.message, "success");
      // Reload badges to reflect change
      await loadMyBadges();
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    showToast("Failed to feature badge: " + error, "error");
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
async function setupEventListeners() {
  // Tab switching
  badgeTabs.addEventListener('click', async (e) => {
    const tab = e.target.closest('.tab');
    if (tab && tab.hasAttribute('onclick')) {
      // onclick handles it
    }
  });
  
  // Close modal on backdrop click
  badgeDetailModal.addEventListener('click', (e) => {
    if (e.target === badgeDetailModal) {
      closeBadgeModal();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBadgeModal();
    }
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function createSkeletonLoader() {
  return `
    <div class="skeleton-wrapper">
      ${Array(6).fill().map(() => `
        <div class="skeleton-badge-card">
          <div class="skeleton skeleton-circle"></div>
          <div class="skeleton skeleton-line w-80"></div>
          <div class="skeleton skeleton-line w-60"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function showError(container, message) {
  container.innerHTML = `
    <div class="error-state">
      <h2>❌ Oops!</h2>
      <p>${message}</p>
      <button class="reload-btn" onclick="location.reload()">
        Try Again
      </button>
    </div>
  `;
}

function getRarityIcon(rarity) {
  const icons = {
    common: '⚪',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡'
  };
  return icons[rarity] || '⚪';
}

function getCategoryIcon(category) {
  const icons = {
    engagement: '💬',
    quality: '💡',
    consistency: '🔥',
    social: '🤝',
    milestone: '🌟'
  };
  return icons[category] || '🏆';
}

function getCategoryDescription(category) {
  const descriptions = {
    engagement: 'Badges for active participation',
    quality: 'Badges for helpful contributions',
    consistency: 'Badges for regular activity',
    social: 'Badges for community building',
    milestone: 'Badges for major achievements'
  };
  return descriptions[category] || '';
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatTimeAgo(isoString) {
  const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function toggleProgressView() {
  badgeProgressSection.classList.toggle('hidden');
  if (!badgeProgressSection.classList.contains('hidden')) {
    loadBadgeProgress();
  }
}
