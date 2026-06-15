export async function getRecentSearches(){
  const response = await api.get("/search/history");
  return response?.data?.recent_searches || [];
}

export function getQuerySugguestions(query, type){
  const response = await api.get(`/search/sugguestions?type=${type}query=${query}`);
  return response.suggestions || [];
}