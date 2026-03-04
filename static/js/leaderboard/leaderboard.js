
/**
 * StudyHub Leaderboard System
 * Best Practices Implementation
 * 
 * Features:
 * - Intersection Observer for animations
 * - Virtual scrolling for performance
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Event delegation
 * - Proper error boundaries
 * - Debounced actions
 * - Semantic HTML
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
const LeaderboardState = {
  currentTab: 'global',
  currentDepartment: null,
  userData: null,
  leaderboardData: [],
  isLoading: false,
  intersectionObserver: null,
  selectedCardIndex: 0,
  
  // Cache for performance
  cache: {
    global: null,
    departments: {},
    stats: null,
    achievements: null,
    userRank: null
  },
  
  // Cache expiry (5 minutes)
  cacheExpiry: 5 * 60 * 1000,
  cacheTimestamps: {}
};

// ============================================================================
// DOM REFERENCES (Cached for performance)
// ============================================================================
const DOM = {
  userRankSection: null,
  leaderboardMain: null,
  tabs: null,
  departmentSelector: null,
  departmentSelect: null,
  changesModal: null,
  changesModalBody: null,
  badgeModal: null,
  badgeModalBody: null,
  scrollTopBtn: null,
  toastContainer: null,
  
  init() {
    this.userRankSection = document.getElementById('user-rank-section');
    this.leaderboardMain = document.getElementById('leaderboard-main');
    this.tabs = document.querySelectorAll('.tab');
    this.departmentSelector = document.getElementById('department-selector');
    this.departmentSelect = document.getElementById('department-select');
    this.changesModal = document.getElementById('changes-modal-overlay');
    this.changesModalBody = document.getElementById('changes-modal-body');
    this.badgeModal = document.getElementById('badge-modal-overlay');
    this.badgeModalBody = document.getElementById('badge-modal-body');
    this.scrollTopBtn = document.getElementById('scroll-top-btn');
    this.toastContainer = document.getElementById('toast-container');
  }
};

// ============================================================================
// CONSTANTS
// ============================================================================
const DEPARTMENTS = [
  "Architecture", "Computer Science", "Engineering (Civil)", 
  "Engineering (Electrical)", "Engineering (Mechanical)", 
  "Medicine & Surgery", "Pharmacy", "Nursing", "Law",
  "Accounting", "Business Administration", "Economics", 
  "Mass Communication", "English", "History", "Biology", 
  "Chemistry", "Physics", "Mathematics", "Statistics",
  "Psychology", "Sociology", "Political Science", 
  "Agricultural Science", "Fine Arts", "Music", "Theatre Arts"
];

const ANIMATION_DELAY = 50; // ms between each card animation
const VIRTUAL_SCROLL_THRESHOLD = 50; // items before using virtual scroll
const DEBOUNCE_DELAY = 300; // ms

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    DOM.init();
    await initializeLeaderboard();
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize leaderboard', 'error');
  }
});

async function initializeLeaderboard() {
  // Setup event listeners
  setupEventListeners();
  
  // Setup intersection observer for animations
  setupIntersectionObserver();
  
  // Setup keyboard navigation
  setupKeyboardNavigation();
  
  // Populate department dropdown
  populateDepartments();
  
  // Load user rank
  await loadUserRank();
  
  // Load initial content (global leaderboard)
  await loadGlobalLeaderboard();
  
  // Setup scroll behavior
  setupScrollBehavior();
}

// ============================================================================
// EVENT LISTENERS (Event Delegation)
// ============================================================================
function setupEventListeners() {
  // Tab switching (event delegation)
  document.querySelector('.tabs-container')?.addEventListener('click', handleTabClick);
  
  // Department selector
  DOM.departmentSelect?.addEventListener('change', handleDepartmentChange);
  
  // Modal close buttons
  document.getElementById('close-changes-modal')?.addEventListener('click', () => closeModal('changes'));
  document.getElementById('close-badge-modal')?.addEventListener('click', () => closeModal('badge'));
  document.getElementById('modal-cancel-btn')?.addEventListener('click', () => closeModal('changes'));
  document.getElementById('badge-cancel-btn')?.addEventListener('click', () => closeModal('badge'));
  
  // Modal export button
  document.getElementById('modal-export-btn')?.addEventListener('click', exportAnalytics);
  
  // Close modals on overlay click
  DOM.changesModal?.addEventListener('click', (e) => {
    if (e.target === DOM.changesModal) closeModal('changes');
  });
  DOM.badgeModal?.addEventListener('click', (e) => {
    if (e.target === DOM.badgeModal) closeModal('badge');
  });
  
  // Scroll to top button
  DOM.scrollTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  // Leaderboard card clicks (event delegation)
  DOM.leaderboardMain?.addEventListener('click', handleLeaderboardClick);
  
  // User rank actions
  DOM.userRankSection?.addEventListener('click', handleUserRankClick);
}

function handleTabClick(event) {
  const tab = event.target.closest('.tab');
  if (!tab) return;
  
  const tabType = tab.dataset.tab;
  if (!tabType || tabType === LeaderboardState.currentTab) return;
  
  switchTab(tabType, tab);
}

async function switchTab(tabType, tabElement) {
  if (LeaderboardState.isLoading) return;
  
  // Update active tab
  DOM.tabs.forEach(t => t.classList.remove('active'));
  tabElement.classList.add('active');
  
  LeaderboardState.currentTab = tabType;
  
  // Show/hide department selector
  if (tabType === 'department') {
    DOM.departmentSelector?.classList.remove('hidden');
  } else {
    DOM.departmentSelector?.classList.add('hidden');
  }
  
  // Load appropriate content
  switch(tabType) {
    case 'global':
      await loadGlobalLeaderboard();
      break;
    case 'department':
      if (LeaderboardState.currentDepartment) {
        await loadDepartmentLeaderboard(LeaderboardState.currentDepartment);
      } else {
        showEmptyState('Please select a department');
      }
      break;
    case 'stats':
      await loadStats();
      break;
    case 'achievements':
      await loadTopBadgeEarners();
      break;
  }
}

async function handleDepartmentChange(event) {
  const department = event.target.value;
  if (!department) return;
  
  LeaderboardState.currentDepartment = department;
  await loadDepartmentLeaderboard(department);
}

function handleLeaderboardClick(event) {
  // Connection button
  const connectBtn = event.target.closest('[data-action="connect"]');
  if (connectBtn) {
    const userId = connectBtn.dataset.userId;
    handleConnectionRequest(userId);
    return;
  }
  
  // Badge view button
  const badgeBtn = event.target.closest('[data-action="view-badges"]');
  if (badgeBtn) {
    const userId = badgeBtn.dataset.userId;
    loadUserBadges(userId);
    return;
  }
  
  // Card click (navigate to profile)
  const card = event.target.closest('[data-username]');
  if (card && !event.target.closest('button')) {
    const username = card.dataset.username;
    navigateToProfile(username);
  }
}

function handleUserRankClick(event) {
  // View changes button
  if (event.target.closest('[data-action="view-changes"]')) {
    showRecentChanges();
    return;
  }
  
  // View analytics button
  if (event.target.closest('[data-action="view-analytics"]')) {
    navigateToAnalytics();
  }
}

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================
function setupKeyboardNavigation() {
  document.addEventListener('keydown', (event) => {
    // Escape to close modals
    if (event.key === 'Escape') {
      if (!DOM.changesModal?.classList.contains('hidden')) {
        closeModal('changes');
      }
      if (!DOM.badgeModal?.classList.contains('hidden')) {
        closeModal('badge');
      }
      return;
    }
    
    // Don't interfere with input fields
    if (event.target.matches('input, select, textarea')) return;
    
    const cards = DOM.leaderboardMain?.querySelectorAll('.leaderboard-card');
    if (!cards || cards.length === 0) return;
    
    switch(event.key) {
      case 'ArrowDown':
        event.preventDefault();
        navigateCards('down', cards);
        break;
      case 'ArrowUp':
        event.preventDefault();
        navigateCards('up', cards);
        break;
      case 'Enter':
        event.preventDefault();
        const selectedCard = cards[LeaderboardState.selectedCardIndex];
        if (selectedCard) {
          const username = selectedCard.dataset.username;
          navigateToProfile(username);
        }
        break;
    }
  });
}

function navigateCards(direction, cards) {
  // Remove previous focus
  cards[LeaderboardState.selectedCardIndex]?.classList.remove('keyboard-focus');
  
  if (direction === 'down') {
    LeaderboardState.selectedCardIndex = Math.min(
      LeaderboardState.selectedCardIndex + 1,
      cards.length - 1
    );
  } else if (direction === 'up') {
    LeaderboardState.selectedCardIndex = Math.max(
      LeaderboardState.selectedCardIndex - 1,
      0
    );
  }
  
  // Add focus to new card
  const newCard = cards[LeaderboardState.selectedCardIndex];
  newCard?.classList.add('keyboard-focus');
  newCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================================
// INTERSECTION OBSERVER (Scroll Animations)
// ============================================================================
function setupIntersectionObserver() {
  const options = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };
  
  LeaderboardState.intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger animation based on index
        setTimeout(() => {
          entry.target.classList.add('animate-in');
        }, index * ANIMATION_DELAY);
        
        // Unobserve after animation
        LeaderboardState.intersectionObserver.unobserve(entry.target);
      }
    });
  }, options);
}

function observeCards() {
  const cards = DOM.leaderboardMain?.querySelectorAll('.leaderboard-card, .stat-card, .rising-card');
  cards?.forEach(card => {
    LeaderboardState.intersectionObserver?.observe(card);
  });
}

// ============================================================================
// SCROLL BEHAVIOR
// ============================================================================
function setupScrollBehavior() {
  let scrollTimeout;
  
  window.addEventListener('scroll', () => {
    // Show/hide scroll to top button
    if (window.scrollY > 300) {
      DOM.scrollTopBtn?.classList.remove('hidden');
    } else {
      DOM.scrollTopBtn?.classList.add('hidden');
    }
    
    // Clear existing timeout
    clearTimeout(scrollTimeout);
    
    // Set new timeout (debounce)
    scrollTimeout = setTimeout(() => {
      // Could implement infinite scroll here if needed
    }, 150);
  });
}

// ============================================================================
// DATA LOADING FUNCTIONS
// ============================================================================
async function loadUserRank() {
  try {
    showSkeleton('rank');
    
    // Check cache first
    if (isCacheValid('userRank')) {
      displayUserRank(LeaderboardState.cache.userRank);
      return;
    }
    
    const response = await api.get('/reputation/me');
    
    if (response.status === 'success') {
      const data = response.data;
      LeaderboardState.cache.userRank = data;
      LeaderboardState.cacheTimestamps.userRank = Date.now();
      LeaderboardState.userData = data;
      
      displayUserRank(data);
    } else {
      showError(DOM.userRankSection, response.message || 'Failed to load rank');
    }
  } catch (error) {
    console.error('Load user rank error:', error);
    showError(DOM.userRankSection, 'Failed to load your rank');
  }
}

async function loadGlobalLeaderboard() {
  try {
    LeaderboardState.isLoading = true;
    showSkeleton('content');
    
    // Check cache
    if (isCacheValid('global')) {
      displayLeaderboard(LeaderboardState.cache.global, 'global');
      LeaderboardState.isLoading = false;
      return;
    }
    
    const response = await api.get('/reputation/leaderboard');
    
    if (response.status === 'success') {
      const data = response.data;
      LeaderboardState.cache.global = data;
      LeaderboardState.cacheTimestamps.global = Date.now();
      LeaderboardState.leaderboardData = data;
      
      displayLeaderboard(data, 'global');
    } else {
      showError(DOM.leaderboardMain, response.message || 'Failed to load leaderboard');
    }
  } catch (error) {
    console.error('Load global leaderboard error:', error);
    showError(DOM.leaderboardMain, 'Failed to load global leaderboard');
  } finally {
    LeaderboardState.isLoading = false;
  }
}

async function loadDepartmentLeaderboard(department) {
  try {
    LeaderboardState.isLoading = true;
    showSkeleton('content');
    
    // Check cache
    const cacheKey = `dept_${department}`;
    if (isCacheValid(cacheKey)) {
      displayLeaderboard(LeaderboardState.cache.departments[department], 'department');
      LeaderboardState.isLoading = false;
      return;
    }
    
    const response = await api.get('/reputation/leaderboard/department', { department });
    
    if (response.status === 'success') {
      const data = response.data;
      LeaderboardState.cache.departments[department] = data;
      LeaderboardState.cacheTimestamps[cacheKey] = Date.now();
      
      displayLeaderboard(data, 'department');
    } else {
      showError(DOM.leaderboardMain, response.message || 'Failed to load department leaderboard');
    }
  } catch (error) {
    console.error('Load department leaderboard error:', error);
    showError(DOM.leaderboardMain, 'Failed to load department leaderboard');
  } finally {
    LeaderboardState.isLoading = false;
  }
}

async function loadStats() {
  try {
    LeaderboardState.isLoading = true;
    showSkeleton('content');
    
    // Check cache
    if (isCacheValid('stats')) {
      displayStats(LeaderboardState.cache.stats);
      LeaderboardState.isLoading = false;
      return;
    }
    
    const response = await api.get('/reputation/stats');
    
    if (response.status === 'success') {
      const data = response.data;
      LeaderboardState.cache.stats = data;
      LeaderboardState.cacheTimestamps.stats = Date.now();
      
      displayStats(data);
    } else {
      showError(DOM.leaderboardMain, response.message || 'Failed to load stats');
    }
  } catch (error) {
    console.error('Load stats error:', error);
    showError(DOM.leaderboardMain, 'Failed to load statistics');
  } finally {
    LeaderboardState.isLoading = false;
    
    // Load rising stars after stats
    await loadRisingStars();
  }
}

async function loadRisingStars() {
  try {
    const response = await api.get('/reputation/rising-stars');
    
    if (response.status === 'success') {
      const data = response.data;
      displayRisingStars(data.rising_stars);
    }
  } catch (error) {
    console.error('Load rising stars error:', error);
  }
}
async function loadTopBadgeEarners() {
  try {
    LeaderboardState.isLoading = true;
    showSkeleton('content');
    
    // Check cache
    if (isCacheValid('achievements')) {
      displayTopBadgeEarners(LeaderboardState.cache.achievements);
      LeaderboardState.isLoading = false;
      return;
    }
    
    const response = await api.get('/badges/top-earners');
    
    if (response.status === 'success') {
      const data = response.data;
      LeaderboardState.cache.achievements = data;
      LeaderboardState.cacheTimestamps.achievements = Date.now();
      
      displayTopBadgeEarners(data);
    } else {
      showError(DOM.leaderboardMain, response.message || 'Failed to load top earners');
    }
  } catch (error) {
    console.error('Load top badge earners error:', error);
    showError(DOM.leaderboardMain, 'Failed to load top badge earners');
  } finally {
    LeaderboardState.isLoading = false;
  }
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================
function displayUserRank(data) {
  if (!data || !data.reputation) {
    showError(DOM.userRankSection, 'No rank data available');
    return;
  }
  
  const { reputation, recent_changes } = data;
  const { points, level, next_level, rank } = reputation;
  
  // Store recent changes for modal
  LeaderboardState.recentChanges = recent_changes || [];
  
  DOM.userRankSection.innerHTML = `
    <div class="user-rank-card fade-in">
      <div class="rank-header">
        <h2 class="rank-title">🏆 Your Leaderboard Position</h2>
        <span class="rank-badge">#${rank.global}</span>
      </div>
      
      <div class="rank-content">
        <div class="rank-stat">
          <span class="rank-label">Global Rank</span>
          <span class="rank-value">#${rank.global} / ${rank.total_users}</span>
          <span class="rank-percentile">Top ${100 - rank.percentile}%</span>
        </div>
        
        <div class="rank-level">
          <span class="level-icon" style="font-size: 2rem;">${level.icon}</span>
          <div class="level-info">
            <span class="level-name">${level.name}</span>
            <span class="level-points">${points} points</span>
          </div>
        </div>
        
        ${next_level ? `
          <div class="rank-progress">
            <div class="progress-header">
              <span>Progress to ${next_level.icon} ${next_level.name}</span>
              <span class="progress-percentage">${next_level.progress_percentage}%</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${next_level.progress_percentage}%"></div>
            </div>
            <span class="progress-remaining">Need ${next_level.points_needed} more points</span>
          </div>
        ` : `
          <div class="rank-max-level">
            <span>🌟 Max Level Reached!</span>
          </div>
        `}
      </div>
      
      <div class="rank-actions">
        <button class="btn btn-secondary" data-action="view-changes">
          📊 View Recent Changes
        </button>
        <button class="btn btn-primary" data-action="view-analytics">
          📈 View Analytics
        </button>
      </div>
    </div>
  `;
}

function displayLeaderboard(data, type) {
  if (!data || !data.leaderboard || data.leaderboard.length === 0) {
    showEmptyState('No leaderboard data available');
    return;
  }
  
  const leaderboard = data.leaderboard;
  
  // Virtual scrolling for large datasets
  if (leaderboard.length > VIRTUAL_SCROLL_THRESHOLD) {
    displayVirtualLeaderboard(leaderboard, type);
  } else {
    displayStandardLeaderboard(leaderboard, type);
  }
}

function displayStandardLeaderboard(leaderboard, type) {
  const cardsHTML = leaderboard.map((item, index) => 
    createLeaderboardCard(item, type, index)
  ).join('');
  
  DOM.leaderboardMain.innerHTML = `
    <div class="leaderboard-grid">
      ${cardsHTML}
    </div>
  `;
  
  // Reset keyboard navigation
  LeaderboardState.selectedCardIndex = 0;
  
  // Observe cards for animation
  requestAnimationFrame(() => {
    observeCards();
  });
}

function displayVirtualLeaderboard(leaderboard, type) {
  // Simplified virtual scroll implementation
  // For full production, use libraries like react-window or virtuoso
  
  const ITEMS_PER_PAGE = 20;
  let currentPage = 0;
  
  function renderPage(page) {
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = leaderboard.slice(start, end);
    
    return pageItems.map((item, index) => 
      createLeaderboardCard(item, type, start + index)
    ).join('');
  }
  
  DOM.leaderboardMain.innerHTML = `
    <div class="leaderboard-grid" id="virtual-container">
      ${renderPage(0)}
    </div>
    ${leaderboard.length > ITEMS_PER_PAGE ? `
      <div class="pagination">
        <button class="btn btn-secondary" id="load-more-btn">
          Load More
        </button>
      </div>
    ` : ''}
  `;
  
  // Load more functionality
  const loadMoreBtn = document.getElementById('load-more-btn');
  loadMoreBtn?.addEventListener('click', () => {
    currentPage++;
    const container = document.getElementById('virtual-container');
    container.insertAdjacentHTML('beforeend', renderPage(currentPage));
    
    if ((currentPage + 1) * ITEMS_PER_PAGE >= leaderboard.length) {
      loadMoreBtn.remove();
    }
    
    observeCards();
  });
  
  observeCards();
}

function createLeaderboardCard(item, type, index) {
  const { rank, status, user, reputation, stats, is_you } = item;
  
  return `
    <div class="leaderboard-card ${is_you ? 'highlight-you' : ''}" 
         data-username="${user.username}"
         data-index="${index}"
         style="animation-delay: ${Math.min(index * 50, 1000)}ms">
      
      <div class="card-rank ${rank <= 3 ? `rank-${rank}` : ''}">
        ${rank <= 3 ? getRankMedal(rank) : `#${rank}`}
      </div>
      
      <img src="${user.avatar || '/static/img/default-avatar.png'}" 
           alt="${user.name}"
           class="card-avatar"
           loading="lazy">
      
      <div class="card-content">
        <div class="card-header">
          <h3 class="card-username">${escapeHtml(user.username)}</h3>
          ${is_you ? '<span class="you-badge">You</span>' : ''}
        </div>
        
        ${user.department ? `
          <p class="card-department">${escapeHtml(user.department)}</p>
        ` : ''}
        
        ${status ? `
          <div class="card-connection">
            ${getConnectionBadge(status)}
          </div>
        ` : !is_you ? `
          <button class="btn btn-sm btn-connect" 
                  data-action="connect" 
                  data-user-id="${user.id}">
            Connect
          </button>
        ` : ''}
        
        <div class="card-level">
          <span class="level-icon">${reputation.level.icon}</span>
          <span class="level-name">${reputation.level.name}</span>
        </div>
      </div>
      
      <div class="card-stats">
        <div class="stat-item">
          <span class="stat-value">${reputation.points}</span>
          <span class="stat-label">points</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.total_posts}</span>
          <span class="stat-label">posts</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.total_helpful}</span>
          <span class="stat-label">helpful</span>
        </div>
      </div>
    </div>
  `;
}

function displayStats(data) {
  DOM.leaderboardMain.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <h3 class="stat-value">${data.active_students}</h3>
          <p class="stat-label">Active Students</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">⭐</div>
        <div class="stat-content">
          <h3 class="stat-value">${Math.round(data.average_reputation)}</h3>
          <p class="stat-label">Average Reputation</p>
        </div>
      </div>
      <div class="stat-card highlight">
        <div class="stat-icon">🏆</div>
        <div class="stat-content">
          <h3 class="stat-value">${escapeHtml(data.top_department)}</h3>
          <p class="stat-label">Top Department</p>
          <p class="stat-subtitle">${data.points} points</p>
        </div>
      </div>
    </div>
    
    <div class="rising-stars-section" id="rising-stars-container">
      <h2 class="section-title">🔥 Rising Stars</h2>
      <p class="section-subtitle">Top reputation gainers this week</p>
      <div class="skeleton-grid">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    </div>
  `;
  
  observeCards();
}
function displayRisingStars(risingStars) {
  const container = document.getElementById('rising-stars-container');
  if (!container || !risingStars || risingStars.length === 0) return;
  
  const cardsHTML = risingStars.map(item => {
    const { user, weekly_gain, is_you, status, trend } = item;
    
    return `
      <div class="rising-card ${is_you ? 'highlight-you' : ''}" 
           data-username="${user.username}">
        
        <div class="rising-left">
          <img src="${user.avatar || '/static/img/default-avatar.png'}" 
               alt="${user.name}"
               class="rising-avatar"
               loading="lazy">
          
          <div class="rising-info">
            <h4 class="rising-username">${escapeHtml(user.username)}</h4>
            ${user.department ? `
              <p class="rising-department">${escapeHtml(user.department)}</p>
            ` : ''}
            
            ${status ? `
              ${getConnectionBadge(status)}
            ` : !is_you ? `
              <button class="btn btn-xs btn-connect" 
                      data-action="connect" 
                      data-user-id="${user.id}">
                Connect
              </button>
            ` : ''}
            
            <div class="rising-level">
              ${user.reputation_level} • ${user.reputation} pts
            </div>
          </div>
        </div>
        
        <div class="rising-right">
          <div class="rising-gain">+${weekly_gain}</div>
          <div class="rising-trend">${trend}</div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <h2 class="section-title">🔥 Rising Stars</h2>
    <p class="section-subtitle">Top reputation gainers this week</p>
    <div class="rising-grid">
      ${cardsHTML}
    </div>
  `;
  
  observeCards();
}

function displayTopBadgeEarners(data) {
  if (!data || data.length === 0) {
    showEmptyState('No badge earners found');
    return;
  }
  
  const cardsHTML = data.map((item, index) => {
    const { rank, status, user, reputation, stats, is_you } = item;
    
    return `
      <div class="achievement-card ${is_you ? 'highlight-you' : ''}" 
           data-username="${user.username}"
           data-index="${index}">
        
        <div class="card-rank ${rank <= 3 ? `rank-${rank}` : ''}">
          ${rank <= 3 ? getRankMedal(rank) : `#${rank}`}
        </div>
        
        <img src="${user.avatar || '/static/img/default-avatar.png'}" 
             alt="${user.name}"
             class="card-avatar"
             loading="lazy">
        
        <div class="card-content">
          <div class="card-header">
            <h3 class="card-username">${escapeHtml(user.username)}</h3>
            ${is_you ? '<span class="you-badge">You</span>' : ''}
          </div>
          
          ${user.department ? `
            <p class="card-department">${escapeHtml(user.department)}</p>
          ` : ''}
          
          ${status ? `
            ${getConnectionBadge(status)}
          ` : !is_you ? `
            <button class="btn btn-sm btn-connect" 
                    data-action="connect" 
                    data-user-id="${user.id}">
              Connect
            </button>
          ` : ''}
          
          <button class="btn btn-sm btn-view-badges" 
                  data-action="view-badges" 
                  data-user-id="${user.id}">
            🏆 View Badge Collection
          </button>
          
          <div class="card-level" style="background-color: ${reputation.level.color}">
            <span class="level-icon">${reputation.level.icon}</span>
            <span class="level-name">${reputation.level.name}</span>
          </div>
        </div>
        
        <div class="card-stats">
          <div class="stat-item">
            <span class="stat-value">${stats.total_badges}</span>
            <span class="stat-label">badges</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.total_helpful}</span>
            <span class="stat-label">helpful</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  DOM.leaderboardMain.innerHTML = `
    <div class="leaderboard-grid">
      ${cardsHTML}
    </div>
  `;
  
  LeaderboardState.selectedCardIndex = 0;
  observeCards();
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================
function showRecentChanges() {
  if (!LeaderboardState.recentChanges || LeaderboardState.recentChanges.length === 0) {
    DOM.changesModalBody.innerHTML = `
      <div class="empty-modal-state">
        <p>No recent reputation changes yet.</p>
      </div>
    `;
  } else {
    const changesHTML = LeaderboardState.recentChanges.map(change => {
      const date = new Date(change.created_at).toLocaleString();
      const pointsClass = change.points_change > 0 ? 'positive' : 'negative';
      const pointsSign = change.points_change > 0 ? '+' : '';
      
      return `
        <div class="change-item">
          <div class="change-action">
            <span class="change-icon">${getActionIcon(change.action)}</span>
            <span class="change-text">${escapeHtml(change.action)}</span>
          </div>
          
          <div class="change-details">
            <span class="change-points ${pointsClass}">
              ${pointsSign}${change.points_change} pts
            </span>
            <span class="change-reputation">
              New rep: ${change.reputation_after}
            </span>
            <span class="change-date">${date}</span>
          </div>
        </div>
      `;
    }).join('');
    
    DOM.changesModalBody.innerHTML = changesHTML;
  }
  
  DOM.changesModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent background scroll
}

async function loadUserBadges(userId) {
  try {
    DOM.badgeModalBody.innerHTML = `
      <div class="skeleton-grid">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
    
    DOM.badgeModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    const response = await api.get(`/badges/user-badges/${userId}`);
    
    if (response.status === 'success') {
      const { badges } = response.data;
      
      if (badges.length === 0) {
        DOM.badgeModalBody.innerHTML = `
          <div class="empty-modal-state">
            <p>This user hasn't earned any badges yet.</p>
          </div>
        `;
        return;
      }
      
      const badgesHTML = badges.map(badge => `
        <div class="badge-item rarity-${badge.rarity}">
          <div class="badge-icon-large">${badge.icon}</div>
          <h3 class="badge-name">${escapeHtml(badge.name)}</h3>
          <p class="badge-description">${escapeHtml(badge.description)}</p>
          <span class="badge-rarity">${badge.rarity}</span>
          <small class="badge-earned">Earned: ${formatDate(badge.earned_at)}</small>
        </div>
      `).join('');
      
      DOM.badgeModalBody.innerHTML = `
        <div class="badges-grid-modal">
          ${badgesHTML}
        </div>
      `;
    } else {
      DOM.badgeModalBody.innerHTML = `
        <div class="error-state">
          <p>${response.message || 'Failed to load badges'}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Load user badges error:', error);
    DOM.badgeModalBody.innerHTML = `
      <div class="error-state">
        <p>Failed to load badges</p>
      </div>
    `;
  }
}

function closeModal(type) {
  if (type === 'changes') {
    DOM.changesModal?.classList.add('hidden');
  } else if (type === 'badge') {
    DOM.badgeModal?.classList.add('hidden');
  }
  document.body.style.overflow = ''; // Re-enable background scroll
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================
async function handleConnectionRequest(userId) {
  try {
    const response = await api.post(`/connections/request/${userId}`);
    
    if (response.status === 'success') {
      showToast('Connection request sent!', 'success');
      
      // Update button in UI
      const button = document.querySelector(`[data-action="connect"][data-user-id="${userId}"]`);
      if (button) {
        button.textContent = 'Pending';
        button.disabled = true;
        button.classList.add('disabled');
      }
    } else {
      showToast(response.message || 'Failed to send request', 'error');
    }
  } catch (error) {
    console.error('Connection request error:', error);
    showToast('Failed to send connection request', 'error');
  }
}

async function exportAnalytics() {
  try {
    const response = await api.get('/analytics/export', { type: 'reputation' });
    
    if (response.status === 'success') {
      const { records, export_type } = response.data;
      
      // Convert to CSV
      const csv = convertToCSV(records);
      
      // Create download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${export_type}-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      showToast('Analytics exported successfully!', 'success');
    } else {
      showToast('Failed to export analytics', 'error');
    }
  } catch (error) {
    console.error('Export analytics error:', error);
    showToast('Failed to export analytics', 'error');
  }
}

function navigateToProfile(username) {
  if (!username) return;
  window.location.href = `/student/profile/${username}`;
}

function navigateToAnalytics() {
  window.location.href = '/student/analytics';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function populateDepartments() {
  if (!DOM.departmentSelect) return;
  
  // Add "My Department" option first
  const options = ['<option value="">Select Department</option>'];
  
  DEPARTMENTS.forEach(dept => {
    options.push(`<option value="${dept}">${dept}</option>`);
  });
  
  DOM.departmentSelect.innerHTML = options.join('');
  
  // Auto-select user's department if available
  if (LeaderboardState.userData?.department) {
    DOM.departmentSelect.value = LeaderboardState.userData.department;
  }
}

function showSkeleton(type) {
  if (type === 'rank') {
    DOM.userRankSection.innerHTML = `
      <div class="skeleton-loader">
        <div class="skeleton skeleton-text w-60"></div>
        <div class="skeleton skeleton-text w-40"></div>
        <div class="skeleton skeleton-text w-80"></div>
      </div>
    `;
  } else if (type === 'content') {
    DOM.leaderboardMain.innerHTML = `
      <div class="skeleton-grid">
        ${Array(6).fill().map(() => `
          <div class="skeleton-card">
            <div class="skeleton skeleton-circle"></div>
            <div class="skeleton skeleton-text w-80"></div>
            <div class="skeleton skeleton-text w-60"></div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function showError(container, message) {
  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>Oops! Something went wrong</h3>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-primary" onclick="location.reload()">
        Try Again
      </button>
    </div>
  `;
}

function showEmptyState(message) {
  DOM.leaderboardMain.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>Nothing to see here</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} slide-in`;
  
  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  }[type] || 'ℹ';
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  
  DOM.toastContainer?.appendChild(toast);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('slide-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function getRankMedal(rank) {
  const medals = {
    1: '🥇',
    2: '🥈',
    3: '🥉'
  };
  return medals[rank] || `#${rank}`;
}

function getConnectionBadge(status) {
  const badges = {
    accepted: '<span class="connection-badge connected">Connected</span>',
    pending: '<span class="connection-badge pending">Pending</span>',
    blocked: '<span class="connection-badge blocked">Blocked</span>'
  };
  return badges[status] || '';
}

function getActionIcon(action) {
  const icons = {
    post_10_likes: '👍',
    post_50_likes: '🔥',
    post_marked_helpful: '💡',
    comment_marked_solution: '✓',
    post_disliked: '👎',
    thread_created: '🧵',
    helpful_streak_7: '⚡'
  };
  return icons[action] || '📊';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function convertToCSV(records) {
  if (!records || records.length === 0) return '';
  
  const keys = Object.keys(records[0]);
  const header = keys.join(',');
  
  const rows = records.map(record => 
    keys.map(key => {
      const value = record[key];
      // Escape values containing commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
}

function isCacheValid(key) {
  if (!LeaderboardState.cache[key] && !LeaderboardState.cache.departments?.[key.replace('dept_', '')]) {
    return false;
  }
  
  const timestamp = LeaderboardState.cacheTimestamps[key];
  if (!timestamp) return false;
  
  return (Date.now() - timestamp) < LeaderboardState.cacheExpiry;
}

// ============================================================================
// DEBOUNCE UTILITY
// ============================================================================
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// ============================================================================
// EXPORT FOR TESTING (if needed)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LeaderboardState,
    loadGlobalLeaderboard,
    displayLeaderboard
  };
}
    