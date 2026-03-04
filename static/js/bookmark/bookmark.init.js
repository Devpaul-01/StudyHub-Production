import {bookmarkSection} from './bookmark.constants.js'
export function loadBookmarkPosts(){
  const container = bookmarkSection.querySelector(".bookmarks-posts-container");
  try{
    const posts = await feedpi.getBookmarkedPosts();
    if(!posts || posts.length == 0){
      container.innerHTML = getEmptyBookmark();
      return;
    }
    container.innerHTML = posts.map(post => {
      createBookmarkPostCard(post).join('')
    });
  }
  catch(error){
    showToast("Error loading bookmarked posts", 'error');
      container.innerHTML = getBookmarkErrorHTML();
  }
}