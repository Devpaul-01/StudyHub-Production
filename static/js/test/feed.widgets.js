/**
 * ============================================================================
 * FEED WIDGETS
 * Widget HTML generation
 * ============================================================================
 */

/**
 * Create widget based on ID
 */
alert("Widget");
export function createWidget(widgetId, index, widgets) {
  const widgetMap = {
    'suggestedConnections': () => createSuggestedConnectionsWidget(widgets.suggestedConnections),
    'popularTags': () => createPopularTagsWidget(widgets.popularTags),
    'risingStars': () => createRisingStarsWidget(widgets.risingStars),
    'openThreads': () => createOpenThreadsWidget(widgets.openThreads),
    'studyBuddyMatches': () => createStudyBuddyWidget(widgets.studyBuddyMatches),
    'canHelp': () => createHelpSuggestionsWidget(widgets.canHelp),
    'topBadgeEarners': () => createTopBadgeEarnersWidget(widgets.topBadgeEarners)
  };

  return widgetMap[widgetId] ? widgetMap[widgetId]() : '';
}

/**
 * Suggested Connections Widget
 */
function createSuggestedConnectionsWidget(connections) {
  const items = connections.slice(0, 10);
  const cards = items.map(item => `
    <div class="user-card" onclick="viewProfile(${item.user?.id})">
      <img src="${item.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
      <div class="user-name">${item.user?.name}</div>
      <div class="user-bio">${item.user?.department || 'Student'}</div>
      <div class="match-score">Match: ${item.match_score}%</div>
      <button class="connect-btn" onclick="event.stopPropagation(); connectUser(${item.user?.id})">Connect</button>
    </div>
  `).join('');

  return `
    <div class="carousel-widget">
      <div class="widget-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Suggested Connections
        </h3>
        <button class="widget-action" onclick="navigateTo('connections')">See All</button>
      </div>
      <div class="carousel-container">${cards}</div>
    </div>
  `;
}

/**
 * Popular Tags Widget
 */
function createPopularTagsWidget(tags) {
  const tagEntries = Object.entries(tags).slice(0, 10);
  const cards = tagEntries.map(([tag, count]) => `
    <div class="tag-card" onclick="searchTag('${tag}')">
      <div class="tag-icon">🏷️</div>
      <div class="tag-name">${tag}</div>
      <div class="tag-count">${count} posts</div>
    </div>
  `).join('');

  return `
    <div class="carousel-widget">
      <div class="widget-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          Popular Tags
        </h3>
      </div>
      <div class="carousel-container">${cards}</div>
    </div>
  `;
}

/**
 * Rising Stars Widget
 */
function createRisingStarsWidget(stars) {
  const items = stars.slice(0, 10);
  const cards = items.map(star => `
    <div class="user-card" onclick="viewProfile(${star.user?.id})">
      <img src="${star.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
      <div class="user-name">${star.user?.name}</div>
      <div class="user-bio">${star.user?.department || 'Student'}</div>
      <div class="stat-badge">${star.trend || '📈'} +${star.weekly_gain || 0} pts</div>
    </div>
  `).join('');

  return `
    <div class="carousel-widget">
      <div class="widget-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
          Rising Stars
        </h3>
      </div>
      <div class="carousel-container">${cards}</div>
    </div>
  `;
}

/**
 * Open Threads Widget
 */
function createOpenThreadsWidget(threads) {
  const items = threads.slice(0, 10);
  const cards = items.map(thread => {
    const progress = (thread.member_count / thread.max_members) * 100;
    return `
      <div class="thread-card" onclick="viewThread(${thread.id})">
        <div class="thread-title">${thread.title}</div>
        <div class="thread-meta">${thread.member_count}/${thread.max_members} members</div>
        <div class="thread-progress">
          <div class="thread-progress-bar" style="width: ${progress}%"></div>
        </div>
        ${thread.recommendation_score ? `<div class="thread-score">Match: ${thread.recommendation_score}%</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="carousel-widget">
      <div class="widget-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          Open Study Threads
        </h3>
      </div>
      <div class="carousel-container">${cards}</div>
    </div>
  `;
}

/**
 * Study Buddy Widget
 */
function createStudyBuddyWidget(matches) {
  const items = matches.slice(0, 10);
  const cards = items.map(match => `
    <div class="user-card" onclick="viewProfile(${match.user?.id})">
      <img src="${match.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
      <div class="user-name">${match.user?.name}</div>
      <div class="user-bio">${match.user?.department || 'Student'}</div>
      <div class="match-score">Match: ${match.match_score}%</div>
      <button class="connect-btn" onclick="event.stopPropagation(); connectUser(${match.user?.id})">Connect</button>
    </div>
  `).join('');

  return `
    <div class="carousel-widget">
      <div class="widget-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
          Study Buddy Matches
        </h3>
      </div>
      <div class="carousel-container">${cards}</div>
    </div>
  `;
}

/**
 * Help Suggestions Widget
 */
function createHelpSuggestionsWidget(suggestions) {
  const items = suggestions.slice(0, 10);
  const cards = items.map(item => `
    <div class="user-card" onclick="viewProfile(${item.user?.id})">
      <img src="${item.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
      <div class="user-name">${item.user?.name}</div>
      <div class="user-bio">${item.match_details?.can_help_with?.[0] || 'Needs help'}</div>
      <div class="match-score">Match: ${item.match_details?.match_score || 0}%</div>
      <button class="connect-btn" onclick="event.stopPropagation(); connectUser(${item.user?.id})">Offer Help</button>
    </div>
  `).join('');

  return `
    <div class="carousel-widget">
      <div class="widget-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          People You Can Help
        </h3>
      </div>
      <div class="carousel-container">${cards}</div>
    </div>
  `;
}

/**
 * Top Badge Earners Widget
 */
function createTopBadgeEarnersWidget(earners) {
  const items = earners.slice(0, 10);
  const cards = items.map(earner => `
    <div class="user-card" onclick="viewProfile(${earner.user?.id})">
      <img src="${earner.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
      <div class="user-name">${earner.user?.name}</div>
      <div class="user-bio">${earner.user?.department || 'Student'}</div>
      <div class="stat-badge">🏆 ${earner.stats?.total_badges || 0} badges</div>
    </div>
  `).join('');

  return `
    <div class="carousel-widget">
      <div class="widget-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="8" r="7"></circle>
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
          </svg>
          Top Badge Earners
        </h3>
      </div>
      <div class="carousel-container">${cards}</div>
    </div>
  `;
}