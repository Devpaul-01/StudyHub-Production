export function getBookmarkedPosts(){
  const response = await api.get("/bookmarks/posts");
  return response.data || [];
}