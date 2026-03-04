import {
  switchSearchType,
  performSearchSugguestions,
  showRecentSearch,
  performTextSearch
}
from './search.events.js'
const SEARCH_HANDLERS = {
  'choose-search-type': (target, event) => {
    event.stopPropagation();
    const type = target.dataset.searchType;
    switchSearchType(type,event);
  },
  'show-recent-search': (target, event) => {
    event.stopPropagation();
    showRecentSearch();
  },
  'search-text': (target, event) => {
    event.stopPropagation();
    const text = target.dataset.value;
    performTextSearch(text);
  },
}
  
const searchModal = document.getElementById("global-search-modal");
searchModal.addEventListener("click", (event) => {
  const target = event.target.closest('[data-action]');
  const action = target.dataset.action;
  const handler = SEARCH_HANDLERS[action];
  handler(target, event);
});
searchModal.querySelector(".global-search-input").addEventListener('input', (e) => {
  const query = e.target.value;
  if(!query || query.length == 0) return
  let searchTimeout;
  if(searchTimeout) clearTimeout(searchTimeout)
  setTimeout(() => {
    searchModal.querySelector(".recent-search-modal").classList.add("hidden");
    searchModal.querySelector(".search-result-modal").classList.remove('hidden');
    performSearchSugguestions(query);
  });
});
const advancedSearchModal = document.getElementById("advanced-search-modal");
advancedSearchModal.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  const action = target.dataset.action;
  const handler = SEARCH_HANDLERS[action];
})