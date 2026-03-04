// ============================================================================
// CONNECTION STATE MANAGEMENT
// ============================================================================

// ============================================================================
// CONNECTION STATE MANAGEMENT (FIXED)
// ============================================================================

class ConnectionState {
  constructor() {
    this.currentSessionPartner = null;
    this.connections = {
      connected: [],
      received: [],
      sent: [],
      suggestions: [],
      discovery: []
    };

    this.loadedFilters = {
      connected: false,
      received: false,
      sent: false,
      suggestions: false,
      discovery: false
    };

    this.badges = {
      received: 0,
      sent: 0
    };

    this.currentTab = 'received';
    this.connectedCurrentPage = 1;
    this.hasMoreConnected = true;
    this.currentSessionEditId = null;
    this.createSessionResources = [];
    this.rescheduleSessionResources = {
      requester_resources: [],
      receiver_resources: []
    };
    this.am_requester = null;
    this.currentConnect = {};
  }
  
  // ============================================================================
  // STUDY SESSION PARTNER (FIXED)
  // ============================================================================
  setPendingConnection(userId, userName){
    this.currentConnect = {
      user_name: userName,
      user_id: userId
    };
  }
  getPendingConnection(){
    return this.currentConnect;
  }
  addCreateSessionResource(resource){
    this.createSessionResources.push(resource);
    
  }
  removeCreateSessionResource(url){
    this.createSessionResources = this.createSessionResources.filter(r => r.url != url);
  }
  getCreateSessionResources(){
    return this.createSessionResources;
  }
  
  addRescheduleSessionResource(resources, type = 'requester_resources') {
  if (!Array.isArray(resources)) {
    resources = [resources];
  }
  
  if (!Array.isArray(this.rescheduleSessionResources[type])) {
    this.rescheduleSessionResources[type] = [];
  }
  
  this.rescheduleSessionResources[type].push(...resources);
}

removeRescheduleSessionResource(url) {
  const roles = ["requester_resources", "receiver_resources"];
  
  for (const role of roles) {
    if (!Array.isArray(this.rescheduleSessionResources[role])) continue;
    
    const index = this.rescheduleSessionResources[role].findIndex(r => r.url === url);
    if (index !== -1) {
      this.rescheduleSessionResources[role].splice(index, 1);
      return true;
    }
  }
  return false;
}
  getRescheduleSessionResources(){
    return this.rescheduleSessionResources;
  }
  
  getAmRequester(){
    return this.am_requester;
  }
  setAmRequester(value){
    this.am_requester = value;
  }
  setCurrentSessionPartner(userId) {
    this.currentSessionPartner = userId;
  }
  
  getCurrentSessionPartner() {
    return this.currentSessionPartner || null;
  }

  // Tab Management
  switchTab(tab) {
    this.currentTab = tab;
  }

  getCurrentTab() {
    return this.currentTab;
  }

  // Connection Data
  setConnections(filter, data) {
    this.connections[filter] = data;
    this.loadedFilters[filter] = true;
  }

  getConnections(filter) {
    return this.connections[filter] || [];
  }

  appendConnections(filter, data) {
    this.connections[filter] = [...this.connections[filter], ...data];
  }

  // Filter Status
  setFilterLoaded(filter) {
    this.loadedFilters[filter] = true;
  }

  isFilterLoaded(filter) {
    return this.loadedFilters[filter];
  }

  // Badge Counts
  setBadge(type, count) {
    this.badges[type] = count;
  }

  getBadge(type) {
    return this.badges[type];
  }

  getAllBadges() {
    return this.badges;
  }

  // Pagination (Connected only)
  getConnectedCurrentPage() {
    return this.connectedCurrentPage;
  }

  incrementConnectedPage() {
    this.connectedCurrentPage++;
  }
  getCurrentSessionEdit(){
    return this.currentSessionEditId;
  }
  setCurrentSessionEdit(sessionId){
    this.currentSessionEditId = sessionId;
  }

  resetConnectedPage() {
    this.connectedCurrentPage = 1;
    this.hasMoreConnected = true;
  }

  setHasMoreConnected(value) {
    this.hasMoreConnected = value;
  }

  getHasMoreConnected() {
    return this.hasMoreConnected;
  }

  // Reset All
  reset() {
    this.connections = {
      connected: [],
      received: [],
      sent: [],
      suggestions: [],
      discovery: []
    };
    this.loadedFilters = {
      connected: false,
      received: false,
      sent: false,
      suggestions: false,
      discovery: false
    };
    this.resetConnectedPage();
  }
}

export const connectionState = new ConnectionState();