class BookmarkState(){
  constructor(){
    this.bookmarkPosts = [];
    let page = 1;
    let per_page = 1;
    let hasMore = true;
    let loading = false;
  }
  
  