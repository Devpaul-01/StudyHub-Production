/**
 * ============================================================================
 * HOMEWORK STATE MANAGEMENT
 * Centralized state for homework section
 * ============================================================================
 */

export const homeworkState = {
  // Active tab: 'my-homework' or 'connections-homework'
  activeTab: 'my-homework',
  lastToggleId: null,
  _editResources: [],
  
  // My assignments data
  myAssignments: [],
  myAssignmentsStats: {},
  
  // Connections homework data
  connectionsHomework: [],
  streakData: {
  current_streak: 0,
  longest_streak: 0,
  streak_at_risk: false,
  helped_today: false
},


  
  // Current filters
  filters: {
    status: 'active',
    subject: null,
    difficulty: null
  },
  
  // Loading states
  loading: {
    myHomework: false,
    stats: false,
    connectionsHomework: false
  },
  dataLoaded: {
  myHomework: false,
  connectionsHomework: false,
  stats: false
},
  
  // Current modal data
  currentModal: null,
  currentSubmission: null,
  currentAssignment: null,
  
  // Upload state
  uploadedResources: [],
  statsData: null,
  
  setStatsData(data) {
  this.statsData = data;
  this.dataLoaded.stats = true;
},

/**
 * Get stats data
 */
getStatsData() {
  return this.statsData;
},

/**
 * Check if data is loaded
 */
isDataLoaded(type) {
  return this.dataLoaded[type] || false;
},

/**
 * Mark data as loaded
 */
markDataLoaded(type) {
  this.dataLoaded[type] = true;
},

/**
 * Force refresh (clear cache)
 */
forceRefresh(type) {
  this.dataLoaded[type] = false;
},
  
  /**
   * Set active tab
   */
  setLastToggle(id){
    this.lastToggleId = id;
  },
  getLastToggle(id){
    return this.lastToggleId || null;
  },
  setActiveTab(tab) {
    this.activeTab = tab;
  },
  setStreakData(data) {
  this.streakData = data;
},
  /**
   * Get active tab
   */
  getActiveTab() {
    return this.activeTab;
  },
  
  /**
   * Set my assignments
   */
  setMyAssignments(data) {
  this.myAssignments = data.assignments || [];
  this.myAssignmentsStats = data.stats || {};
  this.dataLoaded.myHomework = true;  // ADD THIS LINE
},

// Update setConnectionsHomework (line 83):
setConnectionsHomework(data) {
  this.connectionsHomework = data.homework || [];
  this.dataLoaded.connectionsHomework = true;  // ADD THIS LINE
},
  
  /**
   * Set loading state
   */
  setLoading(type, isLoading) {
    this.loading[type] = isLoading;
  },
  
  /**
   * Get assignment by ID
   */
  getAssignmentById(id) {
    return this.myAssignments.find(a => a.id === parseInt(id));
  },
  
  /**
   * Get homework by ID
   */
  getHomeworkById(id) {
    return this.connectionsHomework.find(h => h.id === parseInt(id));
  },
  
  /**
   * Add uploaded resource
   */
  addUploadedResource(resource) {
    this.uploadedResources.push(resource);
  },
  
  /**
   * Clear uploaded resources
   */
  clearUploadedResources() {
    this.uploadedResources = [];
  },
  
  /**
   * Get uploaded resources
   */
  getUploadedResources() {
    return this.uploadedResources;
  },
  
  /**
   * Remove uploaded resource
   */
  removeUploadedResource(index) {
    this.uploadedResources.splice(index, 1);
  },
  
  /**
   * Set current submission
   */
  setCurrentSubmission(submission) {
    this.currentSubmission = submission;
  },
  
  /**
   * Get current submission
   */
  getCurrentSubmission() {
    return this.currentSubmission;
  },
  
  /**
   * Set current assignment
   */
  setCurrentAssignment(assignment) {
    this.currentAssignment = assignment;
  },

// Add these methods with the other methods:

setEditResources(resources) {
  this._editResources = resources || [];
},

getEditResources() {
  return this._editResources;
},
  
  
  /**
   * Reset state
   */
  reset() {
    this.myAssignments = [];
    this.connectionsHomework = [];
    this.uploadedResources = [];
    this.currentSubmission = null;
    this.currentAssignment = null;
  }
};
window.homeworkState = homeworkState;