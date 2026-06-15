class ResourceViewer {
  constructor() {
    this.currentIndex = 0;
    this.resources = [];
    this.initializeModals();
    this.commentResources = null;
  }
  setCommentResources(resources){
    this.commentResources = resources;
  }
  showCommentResources(){
    let html;
    const modal = document.getElementById("comment-resources-modal");
    const resources = this.commentResources;
    if(!resources || resources.length ==0){
      const html = `<div class='empty-state'>
       <h1>No resources found for this comments</h1>
      </div>`
      modal.appendChild(html);
    }
    else{
      html = resources.map(resource => {
      createResourceCard(resource).join("")
      });
      modal.appendChild(html);
    }
    modal.classList.remove('hidden');
  }
  createResourceCard(resource){
    const type = resource.type;
    const url = resource.url;
    let media;
    if(type == 'image'){
     media = document.createElement('img');
     media.className = 'comment-resource';
   }
   elif(type == 'video'){
     media = document.createElement('video');
     media.className = 'comment-resource';
   }
   return `<div class='resource-container'>
     ${media}</div>`
    
  }


export function buildPostResourceHTML(resource, postId, length) {
  let mediaItem;
  if (!resource)  return '';
  if (resource.type === "image") {
      mediaItem = `
        <div data-action='scroll-post-resource'  class="post-resource media-resource" data-type="image">
          <img src="${resource.url}" 
               alt="${resource.filename || 'Image'}" 
               data-post-id="${postId}"
               data-index=1>
        </div>
      `
    } else if (resource.type === "video") {
     mediaItem = 
      `
        <div class="post-resource media-resource" data-action='scroll-post-resource'data-index=1 data-type="video">
          <video src="${resource.url}" 
                 controls 
                 data-post-id="${postId}"
                 data-index="${index}">
          </video>
        </div>
      `);
    } else { 
      mediaItem = 
        `
        <div class="post-resource document-resource" data-action='scroll-post-resource' data-index=1 data-type="document">
        <span class='post-resource-count'>'1/${length}'</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="document-name">${resource.filename || 'Document'}</span>
                  data-filename="${resource.filename}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      `
    }
  });
    html =${mediaItem};
  return html;
  
  export function buildCommentResourcesHTML(resources, commentId, postId) {
  const hasMore = resources.length > 0? true:false;
  if(hasMore){
    const remaining = resources.length - 1;
  }
  const resource = resources[0];
  if (!resource) return '';
  let mediaItems = [];
  if (resource.type === "image") {
      mediaItems.push(`
        <div class="comment-resource media-resource" data-type="image">
          <img src="${resource.url}" 
               alt="${resource.filename || 'Image'}"
               data-action='view-comment-resource'
               data-url="${resource.url}"
               data-resource-type='image'
               data-comment-id="${commentId}"
               data-index="${index}">
        </div>
      `;
    } else if (resource.type === "video") {
      mediaItems.push(`
        <div class="comment-resource media-resource" data-type="video">
          <video src="${resource.url}" 
                 controls 
                 data-comment-id="${commentId}"
                 data-index="${index}">
                 data-action='view-comment-resource'
               data-url="${resource.url}"
               data-resource-type='video'
          </video>
        </div>
      `;
    } else {
      mediaItems.push (`
        <div class="comment-resource document-resource" data-type="document">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="document-name">${resource.filename || 'Document'}</span>
          <button class="download-btn" 
                  data-filename="${resource.filename}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      `);
    }
  });
  if(hasMore){
    mediaItems.push(`<div data-action='view-comment-resources' data-resources=${comment.resources} class="comment-more" >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="document-name">${remaining}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        </div>
  }
  
  let html = '';
    html += `<div class="resource-container media-grid">${mediaItems}.join("")</div>`;
  }
  return html;
}

window.resourceViewer = new ResourceViewer()