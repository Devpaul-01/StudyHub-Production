import {renderRecentSearches} from './search.render.js/'
import *  api from './search.api.js/'
document.addEventListener("DOMContentLoaded", async(e) => {
  loadRecentSearches()
})

async function loadRecentSearches(){
  const searches = await searchApi.getRecentSearches();
  renderRecentSearches(searches);
  
}