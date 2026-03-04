export function renderRecentSearches(searches){
  const recentModal = document.getElementById("global-recent-search-modal");
  if(!searches || searches.length == 0){
    recentModal.innerHTML = `<div class="empty-state>
      <h1>No recent search found</h1>
    </div>`
    return;
  }
  recentModal.innerHTML = searches.map(search => {
    `<span data-value="${search}" data-action='search-info' class='recent-search'><button class='cancel-recent-search'data-value=${search} data-action='cancel-recent-search'</button></span>`
  }).join('');
  }

export function renderSearchResult(results, type){
  switch(type){
    case 'users':
      html += createUserCard(users)
  }
}