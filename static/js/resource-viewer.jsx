// ============================================================================
// RESOURCE VIEWER SYSTEM
// ============================================================================



class ResourceViewer {
  constructor() {
    this.currentIndex = 0;
    this.resources = [];
    this.initializeModals();
  }

  // ============================================================================
  // INITIALIZE MODALS
  // ============================================================================
  initializeModals() {
    // Check if modals already exist
    if (!document.getElementById('single-resource-modal')) {
      this.createSingleResourceModal();
    }
    if (!document.getElementById('all-resources-modal')) {
      this.createAllResourcesModal();
    }
  }

  // ============================================================================
  // CREATE SINGLE RESOURCE MODAL
  // ============================================================================
  createSingleResourceModal() {
    const modal = document.createElement('div');
    modal.id = 'single-resource-modal';
    modal.className = 'resource-modal';
    modal.innerHTML = `
      <div class="resource-modal-overlay" onclick="resourceViewer.closeSingleResource()"></div>
      <div class="resource-modal-content single-resource">
        <button class="modal-close-btn" onclick="resourceViewer.closeSingleResource()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <div class="resource-viewer-container">
          <button class="resource-nav-btn prev" onclick="resourceViewer.previousResource()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          
          <div class="resource-display" id="single-resource-display">
            <!-- Resource will be loaded here -->
          </div>
          
          <button class="resource-nav-btn next" onclick="resourceViewer.nextResource()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        
        <div class="resource-info">
          <div class="resource-counter" id="resource-counter"></div>
          <div class="resource-actions">
            <button class="action-btn" onclick="resourceViewer.downloadCurrentResource()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download
            </button>
            <button class="action-btn" onclick="resourceViewer.viewAllResources()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              View All
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ============================================================================
  // CREATE ALL RESOURCES MODAL
  // ============================================================================
  createAllResourcesModal() {
    const modal = document.createElement('div');
    modal.id = 'all-resources-modal';
    modal.className = 'resource-modal';
    modal.innerHTML = `
      <div class="resource-modal-overlay" onclick="resourceViewer.closeAllResources()"></div>
      <div class="resource-modal-content all-resources">
        <div class="modal-header">
          <h2>All Media Resources</h2>
          <button class="modal-close-btn" onclick="resourceViewer.closeAllResources()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="all-resources-grid" id="all-resources-grid">
          <!-- Resources will be loaded here -->
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ============================================================================
  // VIEW SINGLE RESOURCE
  // ============================================================================
  viewResource(url, type, allResources = null, startIndex = 0) {
    // If allResources provided, enable navigation
    if (allResources && Array.isArray(allResources)) {
      this.resources = allResources.filter(r => r.type === 'image' || r.type === 'video');
      this.currentIndex = startIndex;
    } else {
      // Single resource view
      this.resources = [{ url, type }];
      this.currentIndex = 0;
    }

    const modal = document.getElementById('single-resource-modal');
    const display = document.getElementById('single-resource-display');
    
    if (!modal || !display) return;
    let touchStartY = 0;
    display.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });
    
    display.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        
        if (Math.abs(diff) > 50) { // 50px threshold
            if (diff > 0) this.nextResource();
            else this.previousResource();
        }
    });

    // Show/hide navigation buttons
    const prevBtn = modal.querySelector('.resource-nav-btn.prev');
    const nextBtn = modal.querySelector('.resource-nav-btn.next');
    
    if (this.resources.length > 1) {
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';
    } else {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }

    // Display the resource
    this.displayResource();

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // ============================================================================
  // DISPLAY CURRENT RESOURCE
  // ============================================================================
  displayResource() {
    const display = document.getElementById('single-resource-display');
    const counter = document.getElementById('resource-counter');
    
    if (!display) return;

    const resource = this.resources[this.currentIndex];
    
    // Clear previous content
    display.innerHTML = '';

    if (resource.type === 'image') {
      const img = document.createElement('img');
      img.src = resource.url;
      img.alt = resource.filename || 'Image';
      img.className = 'resource-media';
      
      // Add loading state
      img.onload = () => {
        display.classList.add('loaded');
      };
      
      display.appendChild(img);
    } else if (resource.type === 'video') {
      const video = document.createElement('video');
      video.src = resource.url;
      video.controls = true;
      video.className = 'resource-media';
      video.autoplay = false;
      
      // Add loading state
      video.onloadeddata = () => {
        display.classList.add('loaded');
      };
      
      display.appendChild(video);
    }

    // Update counter
    if (counter) {
      if (this.resources.length > 1) {
        counter.textContent = `${this.currentIndex + 1} / ${this.resources.length}`;
      } else {
        counter.textContent = '';
      }
    }

    // Reset loaded class
    display.classList.remove('loaded');
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================
  nextResource() {
    if (this.currentIndex < this.resources.length - 1) {
      this.currentIndex++;
      this.displayResource();
    }
  }

  previousResource() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.displayResource();
    }
  }

  // ============================================================================
  // VIEW ALL RESOURCES
  // ============================================================================
  async viewAllResources(postId = null) {
    // If called from single view, close it first
    this.closeSingleResource();

    let resources = this.resources;

    // If postId provided, fetch resources
    if (postId) {
      try {
        const response = await api.get(`/posts/${postId}`);
        if (response?.data?.resources) {
          resources = response.data.resources.filter(r => 
            r.type === 'image' || r.type === 'video'
          );
        }
      } catch (error) {
        console.error('Error fetching resources:', error);
        return;
      }
    }

    if (resources.length === 0) {
      alert('No media resources available');
      return;
    }

    const modal = document.getElementById('all-resources-modal');
    const grid = document.getElementById('all-resources-grid');
    
    if (!modal || !grid) return;

    // Populate grid
    grid.innerHTML = resources.map((resource, index) => {
      if (resource.type === 'image') {
        return `
          <div class="resource-grid-item" onclick="resourceViewer.viewResource('${resource.url.replace(/'/g, "\\'")}', 'image', resourceViewer.resources, ${index})">
            <img src="${resource.url}" alt="${resource.filename || 'Image'}" loading="lazy">
            <div class="resource-grid-overlay">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
              </svg>
            </div>
          </div>
        `;
      } else if (resource.type === 'video') {
        return `
          <div class="resource-grid-item video" onclick="resourceViewer.viewResource('${resource.url.replace(/'/g, "\\'")}', 'video', resourceViewer.resources, ${index})">
            <video src="${resource.url}" preload="metadata"></video>
            <div class="resource-grid-overlay">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            <div class="video-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </div>
          </div>
        `;
      }
      return '';
    }).join('');

    // Store resources for navigation
    this.resources = resources;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // ============================================================================
  // DOWNLOAD CURRENT RESOURCE
  // ============================================================================
  downloadCurrentResource() {
    const resource = this.resources[this.currentIndex];
    if (resource) {
      const link = document.createElement('a');
      link.href = resource.url;
      link.download = resource.filename || `resource-${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // ============================================================================
  // CLOSE MODALS
  // ============================================================================
  closeSingleResource() {
    const modal = document.getElementById('single-resource-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      
      // Stop any playing videos
      const video = modal.querySelector('video');
      if (video) {
        video.pause();
      }
    }
  }

  closeAllResources() {
    const modal = document.getElementById('all-resources-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      
      // Stop any playing videos
      const videos = modal.querySelectorAll('video');
      videos.forEach(video => video.pause());
    }
  }
}

// ============================================================================
// INITIALIZE GLOBAL INSTANCE
// ============================================================================
window.resourceViewer = new ResourceViewer();

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================
document.addEventListener('keydown', (e) => {
  const singleModal = document.getElementById('single-resource-modal');
  
  if (singleModal && singleModal.classList.contains('active')) {
    if (e.key === 'Escape') {
      resourceViewer.closeSingleResource();
    } else if (e.key === 'ArrowLeft') {
      resourceViewer.previousResource();
    } else if (e.key === 'ArrowRight') {
      resourceViewer.nextResource();
    }
  }
  
  const allModal = document.getElementById('all-resources-modal');
  if (allModal && allModal.classList.contains('active') && e.key === 'Escape') {
    resourceViewer.closeAllResources();
  }
});

// ============================================================================
// GLOBAL HELPER FUNCTIONS (for use in HTML)
// ============================================================================


