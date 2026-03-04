class ResourceViewer {
  constructor() {
    // Create viewer HTML if not exists
    this.viewer = document.getElementById('resource-viewer-modal');
    if (!this.viewer) {
      this.viewer = document.createElement('div');
      this.viewer.id = 'resource-viewer-modal';
      this.viewer.className = 'resource-viewer hidden';
      document.body.appendChild(this.viewer);
    }
    
    // Viewer state
    this.state = {
      resources: [],
      currentIndex: 0,
      isPlaying: false,
      autoAdvanceTimer: null,
      autoAdvanceDelay: 5000 // 5 seconds for images/documents
    };
    
    // Bind methods to maintain context
    this.closeViewer = this.closeViewer.bind(this);
    this.handleKeyboard = this.handleKeyboard.bind(this);
  }
  
  /**
   * Open viewer with resources
   */
  openResourceViewer(resources, startIndex = 0) {
    this.state.resources = resources;
    this.state.currentIndex = startIndex;
    
    this.renderViewer();
    this.viewer.classList.remove('hidden');
    requestAnimationFrame(() => this.viewer.classList.add('active'));
    
    // Start auto-advance for first resource
    this.startAutoAdvance();
  }
  
  /**
   * Close viewer
   */
  closeViewer() {
    this.stopAutoAdvance();
    this.pauseAllVideos();
    this.viewer.classList.remove('active');
    setTimeout(() => this.viewer.classList.add('hidden'), 300);
  }
  
  /**
   * Render viewer UI
   */
  renderViewer() {
    const { resources, currentIndex } = this.state;
    const total = resources.length;
    
    this.viewer.innerHTML = `
      <div class="viewer-container">
        <!-- Header -->
        <div class="viewer-header">
          <div class="viewer-counter">${currentIndex + 1} / ${total}</div>
          <button data-modal-id='resource-viewer-modal' class="viewer-close" data-action="close-modal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <!-- Content -->
        <div class="viewer-content">
          <div class="resources-track" style="transform: translateX(-${currentIndex * 100}%)">
            ${resources.map((resource, index) => this.renderResourceSlide(resource, index)).join('')}
          </div>
        </div>
        
        ${total > 1 ? `
          <!-- Dots -->
          <div class="viewer-dots">
            ${resources.map((_, i) => `
              <span class="viewer-dot ${i === currentIndex ? 'active' : ''}" data-index="${i}"></span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
    
    // Setup event listeners
    this.setupViewerEvents();
  }
  
  /**
   * Render individual resource slide
   */
  renderResourceSlide(resource, index) {
    if (resource.type === 'image') {
      return `
        <div class="resource-slide" data-index="${index}" data-type="image">
          <img src="${resource.url}" alt="${resource.filename || 'Image'}">
        </div>
      `;
    } else if (resource.type === 'video') {
      return `
        <div class="resource-slide" data-index="${index}" data-type="video">
          <video src="${resource.url}" 
                 playsinline 
                 preload="metadata"
                 data-video-index="${index}">
          </video>
          <div class="video-controls">
            <button class="play-pause-btn" data-action="play-pause">
              <svg class="play-icon" width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <svg class="pause-icon" width="28" height="28" viewBox="0 0 24 24" fill="white" style="display: none;">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            </button>
          </div>
          <div class="video-progress">
            <div class="video-progress-bar"></div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="resource-slide" data-index="${index}" data-type="document">
          <div class="document-view">
            <div class="document-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div class="document-name">${resource.filename || 'Document'}</div>
            <button class="document-download" data-action="download" data-url="${resource.url}" data-filename="${resource.filename}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download
            </button>
          </div>
        </div>
      `;
    }
  }
  
  /**
   * Setup viewer event listeners
   */
  setupViewerEvents() {
    
    // Dot navigation
    this.viewer.querySelectorAll('.viewer-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.navigateToIndex(index);
      });
    });
    
    // Swipe navigation
    this.setupSwipeNavigation();
    
    // Video controls
    this.setupVideoControls();
    
    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyboard);
  }
  
  /**
   * Navigate to specific index
   */
  navigateToIndex(newIndex) {
    const { resources } = this.state;
    if (newIndex < 0 || newIndex >= resources.length) return;
    
    this.stopAutoAdvance();
    this.pauseAllVideos();
    
    this.state.currentIndex = newIndex;
    
    // Update track position
    const track = this.viewer.querySelector('.resources-track');
    if (track) {
      track.style.transform = `translateX(-${newIndex * 100}%)`;
    }
    
    // Update dots
    this.viewer.querySelectorAll('.viewer-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === newIndex);
    });
    
    // Update counter
    const counter = this.viewer.querySelector('.viewer-counter');
    if (counter) {
      counter.textContent = `${newIndex + 1} / ${resources.length}`;
    }
    
    // Start auto-advance for new resource
    this.startAutoAdvance();
  }
  
  /**
   * Auto-advance logic
   */
  startAutoAdvance() {
    this.stopAutoAdvance();
    
    const currentResource = this.state.resources[this.state.currentIndex];
    
    // Only auto-advance for images and documents
    if (currentResource.type === 'image' || currentResource.type === 'document') {
      this.state.autoAdvanceTimer = setTimeout(() => {
        const nextIndex = this.state.currentIndex + 1;
        if (nextIndex < this.state.resources.length) {
          this.navigateToIndex(nextIndex);
        }
      }, this.state.autoAdvanceDelay);
    }
  }
  
  stopAutoAdvance() {
    if (this.state.autoAdvanceTimer) {
      clearTimeout(this.state.autoAdvanceTimer);
      this.state.autoAdvanceTimer = null;
    }
  }
  
  /**
   * Swipe navigation
   */
  setupSwipeNavigation() {
    const content = this.viewer.querySelector('.viewer-content');
    if (!content) return;
    
    let startX = 0;
    let isDragging = false;
    
    const handleTouchStart = (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      this.stopAutoAdvance();
    };
    
    const handleTouchEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          this.navigateToIndex(this.state.currentIndex + 1);
        } else {
          this.navigateToIndex(this.state.currentIndex - 1);
        }
      } else {
        this.startAutoAdvance();
      }
    };
    
    const handleMouseDown = (e) => {
      startX = e.clientX;
      isDragging = true;
      this.stopAutoAdvance();
    };
    
    const handleMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      
      const endX = e.clientX;
      const diff = startX - endX;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          this.navigateToIndex(this.state.currentIndex + 1);
        } else {
          this.navigateToIndex(this.state.currentIndex - 1);
        }
      } else {
        this.startAutoAdvance();
      }
    };
    
    content.addEventListener('touchstart', handleTouchStart);
    content.addEventListener('touchend', handleTouchEnd);
    content.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  /**
   * Video controls
   */
  setupVideoControls() {
    this.viewer.querySelectorAll('video').forEach(video => {
      const slide = video.closest('.resource-slide');
      const controls = slide.querySelector('.video-controls');
      const playPauseBtn = controls.querySelector('[data-action="play-pause"]');
      const playIcon = playPauseBtn.querySelector('.play-icon');
      const pauseIcon = playPauseBtn.querySelector('.pause-icon');
      const progressBar = slide.querySelector('.video-progress-bar');
      
      // Tap to play/pause
      video.addEventListener('click', () => {
        this.togglePlayPause(video, playIcon, pauseIcon);
      });
      
      playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlayPause(video, playIcon, pauseIcon);
      });
      
      // Update progress
      video.addEventListener('timeupdate', () => {
        const progress = (video.currentTime / video.duration) * 100;
        progressBar.style.width = `${progress}%`;
      });
      
      // Show/hide play button
      video.addEventListener('play', () => {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        playPauseBtn.classList.remove('show');
        this.stopAutoAdvance();
      });
      
      video.addEventListener('pause', () => {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        playPauseBtn.classList.add('show');
      });
      
      video.addEventListener('ended', () => {
        video.currentTime = 0;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        playPauseBtn.classList.add('show');
      });
    });
  }
  
  togglePlayPause(video, playIcon, pauseIcon) {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }
  
  pauseAllVideos() {
    this.viewer.querySelectorAll('video').forEach(v => v.pause());
  }
  
  /**
   * Keyboard navigation
   */
  handleKeyboard(e) {
    if (!this.viewer.classList.contains('active')) return;
    
    if (e.key === 'ArrowLeft') {
      this.navigateToIndex(this.state.currentIndex - 1);
    } else if (e.key === 'ArrowRight') {
      this.navigateToIndex(this.state.currentIndex + 1);
    } else if (e.key === 'Escape') {
      this.closeViewer();
    }
  }

  
  /**
   * Cleanup method
   */
  destroy() {
    this.stopAutoAdvance();
    document.removeEventListener('keydown', this.handleKeyboard);
    if (this.viewer && this.viewer.parentNode) {
      this.viewer.parentNode.removeChild(this.viewer);
    }
  }
}

// Usage:
const viewer = new ResourceViewer();

