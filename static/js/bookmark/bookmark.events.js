
export function setupBookmarkObserver(){
  bookmarkState.disconnectObserver()
  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    if(entry.isIntersecting){
      loadMoreBookmarks();
    }
  })
  bookmarkState.setObserver(observer);
  const modal = document.getElementById("bookmark-container-sentinel");
  observer.observe(modal);
}