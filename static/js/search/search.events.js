import {searchState} from './search.state.js/
i
export function switchSearchType(type, event){
  const searchModal = document.getElementById("advanced-search-modal");
  searchModal.classList.add('hidden');
  searchState.setCurrentSearchType(type);
  document.getElementById("global-search-input").focus();
  const modal = document.getElementById("global-search-bar");
  modal.querySelector(".recent-search").classList.remove('hidden');
}
export function performTextSearch(text){
  const searchType = searchState.getCurrentSearchType();
  const container = document.querySelector("section#advanced-search");
  container.innerHTML = getSearchLoadingSkeleton();
  const data = await searchAPI.getSearchResult(query, type);
  if (!data || data.length == 0){
    container.innerHTML = `<div class='empty-state>
      <h1>No result found</h1>
      </div>`
  }
  const results = data.searchType;
  renderSearchResult(results, type);
}
export function showRecentSearch(){
  const modal = document.getElementById("global-search-bar");
  modal.querySelector(".recent-search").classList.remove('hidden');
}
export function performSearchSugguestions(query){
  const searchType = searchState.getCurrentSearchType();
  const searchModal = document.getElementById("global-search-bar");
  const resultModal = searchModal.querySelector(".search-result-modal");
  resultModal.innerHTML = getSearchLoadingSkeleton();
  const querySugguestions = searchAPI.getQuerySugguestions(query, type);
  if(querySugguestions || querySugguestions.length > 0){
    resultModal.innerHTML = querySugguestions.map(result => {
      <span data-value=${result} data-action='search-text' class="sugguestion-result"><svg
  class="icon-search"
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>${result}</span>
    });
    
  }
}