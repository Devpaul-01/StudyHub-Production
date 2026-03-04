// ============================================================================
// CONNECTION SYSTEM - FIXED VERSION
// ============================================================================

// State Management
let page = 1;
let perPage = 20;
let hasMore = true;
let userPage = 1;
let userhasMore = true;
let skills = [];
let department = "";
let classLevel = "";
let repMin = "";
let sort = "";
let searchInput = "";
let isuserLoading = false;
let currentTab = "pendings";
let isLoading = false;

const query = {
  "thread": "false",
  "department": "false",
  "page": page,
  "per_page": perPage
};

let searchQuery = {
  "page": userPage,
  "per_page": 20,
  "skills": skills,
  "sort": sort,
  "department": department,
  "class_level": classLevel,
  "reputation_min": repMin,
  "q": searchInput
};

const classLevelMap = [
  "100Level", "200Level", "300Level", "400Level", "500Level"
];

const departmentMap = [
  "Architecture", "Computer Science", "Engineering (Civil)", "Engineering (Electrical)",
  "Engineering (Mechanical)", "Medicine & Surgery", "Pharmacy", "Nursing", "Law",
  "Accounting", "Business Administration", "Economics", "Mass Communication", "English",
  "History", "Biology", "Chemistry", "Physics", "Mathematics", "Statistics",
  "Psychology", "Sociology", "Political Science", "Agricultural Science",
  "Fine Arts", "Music", "Theatre Arts"
];

// DOM ELEMENTS
const imgModal = document.getElementById("image-modal");
const image = imgModal ? imgModal.querySelector("img") : null;
const connectionDiv = document.getElementById("connections-container");
const blockedBtn = document.getElementById("blocked-users-btn");
const soundToggle = document.getElementById("sound-toggle");
const settingsBtn = document.getElementById("connection-settings-btn");
const pendingsCount = document.getElementById("connection-pendings");
const connectionsCount = document.getElementById("connection-connections");
const filtersBtn = document.getElementById("filter-btn-all");
const sortBtn = document.getElementById("sort-btn");
const selectFilter = document.querySelector(".select-filter");
const selectDetails = document.querySelector(".user-select-details");
const usersDiv = document.querySelector(".search-result");
const settingsModal = document.getElementById("connection-settings-modal");
const count = document.getElementById("connection-blocked-count");
const blockedDiv = document.getElementById("blocked-users");
const connectedDiv = document.querySelector(".connected-connections");
const pendingHtml = document.getElementById("pending-connection-filter");
const connectionHtml = document.getElementById("connected-connection-filter");
const searchInputEl = document.getElementById("connection-search-input");

// Create elements
const h3 = document.createElement("h3");
h3.textContent = "Loading...";
h3.id = "bottom-loader";
h3.className = "loader-text";

const loadBtn = document.createElement("button");
loadBtn.classList.add("load-btn");
loadBtn.id = "load-more-btn";
loadBtn.textContent = "Load More";

const searchBtn = document.createElement("button");
searchBtn.id = "load-more-search";
searchBtn.classList.add("load-btn");
searchBtn.textContent = "Load More Users";

// ============================================================================
// INITIALIZATION
// ============================================================================
(async function init() {
  await loadPendings();
  await updateConnections();
  setupEventListeners();
  populateFilters();
})();

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Settings button
  if (settingsBtn) {
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsModal.classList.toggle("hidden");
    });
  }

  // Close modal when clicking outside
  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.add("hidden");
      }
    });
  }

  // Blocked users button
  if (blockedBtn) {
    blockedBtn.addEventListener("click", async () => {
      blockedDiv.classList.remove("hidden");
      await loadBlockedUsers();
    });
  }

  // Filter and sort buttons
  if (filtersBtn) {
    filtersBtn.addEventListener("click", () => {
      selectDetails.classList.toggle("hidden");
    });
  }

  if (sortBtn) {
    sortBtn.addEventListener("click", () => {
      selectFilter.classList.toggle("hidden");
    });
  }

  // Connected tabs
  if (connectedDiv) {
    connectedDiv.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.target.classList.toggle("active");
        query[e.target.dataset.type] = e.target.classList.contains("active") ? "true" : "false";
      });
    });
  }

  // Filter selects
  document.querySelectorAll(".filter-select").forEach(el => {
    el.addEventListener("change", async () => {
      userPage = 1;
      userhasMore = true;
      await handleSearch();
    });
  });

  // Reputation filter
  const repInput = document.getElementById("filter-input-reputation");
  if (repInput) {
    repInput.addEventListener("input", async () => {
      userPage = 1;
      userhasMore = true;
      await handleSearch();
    });
  }

  // Sort options
  document.querySelectorAll(".select-option").forEach(opt => {
    opt.addEventListener("change", async () => {
      userPage = 1;
      userhasMore = true;
      await handleSearch();
    });
  });

  // Image modal
  if (imgModal) {
    imgModal.addEventListener("click", (e) => {
      if (e.target === imgModal || e.target.classList.contains("close")) {
        imgModal.classList.add("hidden");
      }
    });
  }

  // Tab switching - FIX: Remove event parameter
  const allTabs = document.querySelectorAll(".tab");
  allTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      allTabs.forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
      currentTab = e.target.dataset.tab;
      switchType(currentTab);
    });
  });

  // Search input with debounce - FIX: Reset properly
  if (searchInputEl) {
    let timer;
    searchInputEl.addEventListener("input", (e) => {
      clearTimeout(timer);
      const value = e.target.value.trim();
      
      // Clear results if empty
      if (!value) {
        usersDiv.innerHTML = "";
        searchBtn.remove();
        return;
      }
      
      timer = setTimeout(() => {
        userPage = 1;
        userhasMore = true;
        handleSearch();
      }, 500);
    });
  }

  // Search load more
  searchBtn.addEventListener("click", async () => {
    userPage += 1;
    await handleSearch();
  });

  // Clear filters
  const clearBtn = document.getElementById("filter-btn-cancel");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearFilters();
    });
  }

  // Skills management
  const skillBtn = document.getElementById("filter-btn-skill-input");
  if (skillBtn) {
    skillBtn.addEventListener("click", async () => {
      const skillInput = document.getElementById("filter-input-skills");
      const skill = skillInput ? skillInput.value.trim() : "";
      
      if (!skill) {
        showToast("Please enter a skill", "warning");
        return;
      }
      
      skills.push(skill);
      renderSkills();
      skillInput.value = "";
      await handleSearch();
    });
  }

  const skillList = document.getElementById("skills-list");
  if (skillList) {
    skillList.addEventListener("click", async (e) => {
      if (e.target.classList.contains("remove-skill")) {
        const idx = parseInt(e.target.dataset.index);
        skills.splice(idx, 1);
        renderSkills();
        await handleSearch();
      }
    });
  }

  // Load more button
  loadBtn.addEventListener("click", async () => {
    page++;
    switch (currentTab) {
      case "pendings":
        await loadPendings();
        break;
      case "sents":
        await loadSents();
        break;
      case "received":
        await loadReceived();
        break;
      case "connections":
        await loadConnections();
        break;
      case "sugguestions":
        await loadSugguestions();
        break;
      case "mutuals":
        await loadMutuals();
        break;
    }
  });

  // Connection div delegation
  connectionDiv.addEventListener("click", async (e) => {
    const target = e.target;
    
    // Navigate to profile
    if (target.closest(".connection-item")) {
      const item = target.closest(".connection-item");
      const username = item.dataset.username;
      
      // Don't navigate if clicking button
      if (!target.classList.contains("connection-btn") && 
          !target.closest(".connection-btn")) {
        window.location.href = `/student/profile/${username}`;
        return;
      }
    }
    
    // Handle avatar click
    if (target.classList.contains("connection-avatar")) {
      handleAvatar(target.src);
      return;
    }
    
    // Handle buttons
    if (target.classList.contains("connection-btn") || target.closest(".connection-btn")) {
      const btn = target.classList.contains("connection-btn") ? target : target.closest(".connection-btn");
      await handleButton(btn);
    }
  });

  // Users div delegation
  usersDiv.addEventListener("click", async (e) => {
    if (e.target.classList.contains("search-connect-btn")) {
      const userId = e.target.dataset.user;
      const btn = e.target;
      await connectRequest(userId, btn, "search");
    }
  });

  // Sound toggle
  if (soundToggle) {
    soundToggle.addEventListener("change", async (e) => {
      await handleToggle(e);
    });
  }

  // Blocked div delegation
  blockedDiv.addEventListener("click", async (e) => {
    if (e.target.classList.contains("blocked-item")) {
      const username = e.target.dataset.username;
      window.location.href = `/student/profile/${username}`;
    } else if (e.target.classList.contains("unblock-btn")) {
      await unblockRequest(e);
    }
  });
}

// ============================================================================
// POPULATE FILTERS
// ============================================================================
function populateFilters() {
  const classlevelSelect = document.getElementById("filter-select-class-level");
  if (classlevelSelect) {
    classLevelMap.forEach(level => {
      const option = document.createElement("option");
      option.textContent = level;
      option.value = level;
      classlevelSelect.appendChild(option);
    });
  }

  const departmentSelect = document.getElementById("filter-select-department");
  if (departmentSelect) {
    departmentMap.forEach(dept => {
      const option = document.createElement("option");
      option.textContent = dept;
      option.value = dept;
      departmentSelect.appendChild(option);
    });
  }
}

// ============================================================================
// SKILLS MANAGEMENT
// ============================================================================
function renderSkills() {
  const skillList = document.getElementById("skills-list");
  if (!skillList) return;

  skillList.innerHTML = "";
  skills.forEach((s, index) => {
    const li = document.createElement("li");
    li.classList.add("skill-item");
    li.innerHTML = `
      ${s}
      <button class="remove-skill" data-index="${index}">×</button>
    `;
    skillList.appendChild(li);
  });
}

function clearFilters() {
  usersDiv.innerHTML = "";
  skills = [];
  const skillList = document.getElementById("skills-list");
  if (skillList) skillList.innerHTML = "";
  
  document.querySelectorAll('#connection-search-div input, #connection-search-div select').forEach(e => {
    if (e.type === "radio" || e.type === "checkbox") {
      e.checked = false;
    } else {
      e.value = "";
    }
  });
}

// ============================================================================
// TAB SWITCHING - FIXED
// ============================================================================
async function switchType(type) {
  page = 1;
  perPage = 20;
  hasMore = true;
  connectionDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  loadBtn.remove();
  
  switch (type) {
    case 'pendings':
      await loadPendings();
      break;
    case 'sents':
      await loadSents();
      break;
    case 'received':
      await loadReceived();
      break;
    case 'connections':
      await loadConnections();
      break;
    case 'mutuals':
      await loadMutuals();
      break;
    case 'sugguestions':
      await loadSugguestions();
      break;
  }
}

// ============================================================================
// SEARCH HANDLING - FIXED
// ============================================================================
async function handleSearch() {
  if (isuserLoading) return;

  const searchInputValue = searchInputEl ? searchInputEl.value.trim() : "";
  
  // Don't search if empty
  if (!searchInputValue && skills.length === 0 && !department && !classLevel && !repMin) {
    usersDiv.innerHTML = "";
    searchBtn.remove();
    return;
  }

  const departmentValue = document.getElementById("filter-select-department")?.value || "";
  const classLevelValue = document.getElementById("filter-select-class-level")?.value || "";
  const repMinValue = document.getElementById("filter-input-reputation")?.value || "";
  const sortValue = document.getElementById("user-sort")?.value || "";

  searchQuery = {
    q: searchInputValue,
    page: userPage,
    per_page: 20,
    skills: skills.join(','),
    department: departmentValue,
    class_level: classLevelValue,
    reputation_min: repMinValue,
    sort: sortValue
  };

  // Remove empty values
  Object.keys(searchQuery).forEach(key => {
    if (!searchQuery[key] || searchQuery[key] === '' || searchQuery[key] === '0') {
      delete searchQuery[key];
    }
  });

  try {
    isuserLoading = true;
    
    if (userPage === 1) {
      usersDiv.innerHTML = '<div class="loading-state">Searching...</div>';
    }

    const response = await api.get("/search/users", searchQuery);
    
    if (response.status === "success") {
      const users = response.data.users;
      const pageDetails = response.data.pagination;
      userhasMore = pageDetails.has_next;

      // Clear loading on first page
      if (userPage === 1) {
        usersDiv.innerHTML = "";
      }

      if (!users || users.length === 0) {
        if (userPage === 1) {
          usersDiv.innerHTML = '<div class="empty-state">No users found</div>';
        }
        userhasMore = false;
        searchBtn.remove();
        return;
      }

      showUsers(users);
      
      // Handle load more button
      searchBtn.remove();
      if (userhasMore) {
        usersDiv.insertAdjacentElement("afterend", searchBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Search error:", error);
    showToast("Error loading users", "error");
  } finally {
    isuserLoading = false;
  }
}

// ============================================================================
// LOAD FUNCTIONS - FIXED
// ============================================================================
async function loadSugguestions() {
  if (pendingHtml) pendingHtml.classList.add("hidden");
  if (connectionHtml) connectionHtml.classList.add("hidden");
  loadBtn.remove();

  try {
    if (isLoading) return;
    isLoading = true;
    
    connectionDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading Suggestions...</p></div>';
    
    const response = await api.get("/connections/suggestions");
    
    // Remove loading
    connectionDiv.innerHTML = "";
    
    if (response.status === "success") {
      const data = response.data.suggestions;
      
      if (!data || data.length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">No suggestions available</div>';
        return;
      }
      
      showSugguestions(data);
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load suggestions error:", error);
    connectionDiv.innerHTML = '<div class="error-state">Failed to load suggestions</div>';
  } finally {
    isLoading = false;
  }
}

async function loadMutuals() {
  if (connectionHtml) connectionHtml.classList.add("hidden");
  if (pendingHtml) pendingHtml.classList.add("hidden");
  
  if (!hasMore) return;
  if (isLoading) return;

  try {
    isLoading = true;
    
    if (page === 1) {
      connectionDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading mutual connections...</p></div>';
    } else {
      connectionDiv.insertAdjacentElement("beforeend", h3);
    }

    const response = await api.get("/connections/mutuals", {
      page: page,
      per_page: perPage
    });

    // Remove loaders
    if (page === 1) connectionDiv.innerHTML = "";
    h3.remove();

    if (response.status === "success") {
      hasMore = response.total_pages > page;
      const data = response.data;
      
      if (!data || data.length === 0) {
        if (page === 1) {
          connectionDiv.innerHTML = '<div class="empty-state">No mutual connections found</div>';
        }
        hasMore = false;
        loadBtn.remove();
        return;
      }

      showMutuals(data);
      
      loadBtn.remove();
      if (hasMore) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load mutuals error:", error);
    if (page === 1) {
      connectionDiv.innerHTML = '<div class="error-state">Error loading mutual connections</div>';
    }
  } finally {
    isLoading = false;
  }
}

async function loadConnections() {
  if (pendingHtml) pendingHtml.classList.add("hidden");
  if (connectionHtml) connectionHtml.classList.remove("hidden");
  
  if (!hasMore) return;
  if (isLoading) return;

  try {
    isLoading = true;
    
    if (page === 1) {
      connectionDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading connections...</p></div>';
    } else {
      connectionDiv.insertAdjacentElement("beforeend", h3);
    }

    const response = await api.get("/connections/list", {
      page: page,
      per_page: perPage
    });

    // Remove loaders
    if (page === 1) connectionDiv.innerHTML = "";
    h3.remove();

    if (response.status === "success") {
      hasMore = response.data.pages > page;
      const data = response.data.connections;
      
      if (!data || data.length === 0) {
        if (page === 1) {
          connectionDiv.innerHTML = '<div class="empty-state">No connections yet</div>';
        }
        hasMore = false;
        loadBtn.remove();
        return;
      }

      showConnected(data);
      
      loadBtn.remove();
      if (hasMore) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load connections error:", error);
    if (page === 1) {
      connectionDiv.innerHTML = '<div class="error-state">Error loading connections</div>';
    }
  } finally {
    isLoading = false;
  }
}

async function loadReceived() {
  if (connectionHtml) connectionHtml.classList.add("hidden");
  if (pendingHtml) pendingHtml.classList.remove("hidden");
  
  if (!hasMore) return;
  if (isLoading) return;

  try {
    isLoading = true;
    
    if (page === 1) {
      connectionDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading requests...</p></div>';
    } else {
      connectionDiv.insertAdjacentElement("beforeend", h3);
    }

    const response = await api.get("/connections/pending", {
      type: "received",
      page: page,
      per_page: perPage
    });

    // Remove loaders
    if (page === 1) connectionDiv.innerHTML = "";
    h3.remove();

    if (response.status === "success") {
      hasMore = response.pages > page;
      const data = response.data;
      
      if (!data || data.length === 0) {
        if (page === 1) {
          connectionDiv.innerHTML = '<div class="empty-state">No pending requests</div>';
        }
        hasMore = false;
        loadBtn.remove();
        return;
      }

      showReceived(data);
      
      loadBtn.remove();
      if (hasMore) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load received error:", error);
    if (page === 1) {
      connectionDiv.innerHTML = '<div class="error-state">Error loading requests</div>';
    }
  } finally {
    isLoading = false;
  }
}

async function loadSents() {
  if (isLoading) return;
  if (!hasMore) return;

  if (connectionHtml) connectionHtml.classList.add("hidden");
  if (pendingHtml) pendingHtml.classList.remove("hidden");

  try {
    isLoading = true;
    
    if (page === 1) {
      connectionDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading sent requests...</p></div>';
    } else {
      connectionDiv.insertAdjacentElement("beforeend", h3);
    }

    const response = await api.get("/connections/pending", {
      page: page,
      per_page: perPage,
      type: "sent"
    });

    // Remove loaders
    if (page === 1) connectionDiv.innerHTML = "";
    h3.remove();

    if (response.status === "success") {
      hasMore = response.pages > page;
      const data = response.data;

      if (!data || data.length === 0) {
        if (page === 1) {
          connectionDiv.innerHTML = '<div class="empty-state">No sent requests</div>';
        }
        hasMore = false;
        loadBtn.remove();
        return;
      }

      showSents(data);
      
      loadBtn.remove();
      if (hasMore) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load sents error:", error);
    if (page === 1) {
      connectionDiv.innerHTML = '<div class="error-state">Error loading requests</div>';
    }
  } finally {
    isLoading = false;
  }
}

async function loadPendings() {
  if (pendingHtml) pendingHtml.classList.remove("hidden");
  if (connectionHtml) connectionHtml.classList.add("hidden");

  try {
    connectionDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading connections...</p></div>';

    const response = await api.get("/connections/pending", {
      type: "received",
      page: page,
      per_page: perPage
    });

    connectionDiv.innerHTML = "";

    if (response.status === "success") {
      const data = response.data;
      hasMore = response.pages > page;

      if (!data || data.length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">No pending connections</div>';
        hasMore = false;
        return;
      }

      showReceived(data);
      
      loadBtn.remove();
      if (hasMore) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load pendings error:", error);
    connectionDiv.innerHTML = '<div class="error-state">Error loading connections</div>';
  }
}

// ============================================================================
// RENDER FUNCTIONS - SIMPLIFIED UI
// ============================================================================
function showBlocked(data) {
  data.forEach(user => {
    const div = document.createElement("div");
    div.className = "blocked-item";
    div.dataset.username = user.username;
    div.innerHTML = `
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <div class="connection-info">
        <div class="connection-name">${user.name}</div>
        <div class="connection-username">@${user.username}</div>
        <div class="connection-meta">${user.department || 'N/A'}</div>
      </div>
      <button class="unblock-btn connection-btn" data-user="${user.id}">Unblock</button>
    `;
    blockedDiv.appendChild(div);
  });
}

function showSugguestions(data) {
  data.forEach(d => {
    const user = d.user;
    const div = document.createElement("div");
    div.className = "connection-item";
    div.dataset.username = user.username;
    div.innerHTML = `
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <div class="connection-info">
        <div class="connection-name">${user.name}</div>
        <div class="connection-username">@${user.username}</div>
        <div class="connection-meta">${user.department || 'N/A'} • ${user.reputation_level || 'N/A'}</div>
        <div class="connection-match">Match: ${d.match_score}%</div>
      </div>
      <button class="connection-btn connection-btn-connect" data-user="${user.id}" data-type="sugguestions">Connect</button>
    `;
    connectionDiv.appendChild(div);
  });
}

function showUsers(users) {
  users.forEach(user => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.dataset.username = user.username;
    div.innerHTML = `
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <div class="connection-info">
        <div class="connection-name">${user.name}</div>
        <div class="connection-username">@${user.username}</div>
        ${!user.private ? `<div class="connection-meta">${user.department || ''} • ${user.reputation_level || ''}</div>` : '<div class="connection-meta">Private Profile</div>'}
      </div>
      ${user.connection_status === 'none' ? 
        `<button data-user="${user.id}" class="search-connect-btn connection-btn">Connect</button>` : 
        `<button class="connection-btn disabled">${user.connection_status}</button>`
      }
    `;
    usersDiv.appendChild(div);
  });
}

function showMutuals(data) {
  data.forEach(d => {
    const user = d.user;
    const div = document.createElement("div");
    div.className = "connection-item";
    div.dataset.username = user.username;
    div.innerHTML = `
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <div class="connection-info">
        <div class="connection-name">${user.name}</div>
        <div class="connection-username">@${user.username}</div>
        <div class="connection-meta">${user.department || 'N/A'} • ${user.level || 'N/A'}</div>
      </div>
      <button class="connection-btn connection-btn-connect" data-user="${user.id}" data-type="mutuals">Connect</button>
    `;
    connectionDiv.appendChild(div);
  });
}

function showConnected(data) {
  data.forEach(user => {
    const div = document.createElement("div");
    div.className = "connection-item";
    div.dataset.username = user.username;
    div.innerHTML = `
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <div class="connection-info">
        <div class="connection-name">${user.name}</div>
        <div class="connection-username">@${user.username}</div>
        <div class="connection-meta">${user.department || 'N/A'} • ${user.reputation_level || 'N/A'}</div>
      </div>
      <div class="connection-actions">
        <button class="connection-btn connection-btn-disconnect" data-user="${user.id}" data-type="connected">Disconnect</button>
        <button class="connection-btn connection-btn-block" data-user="${user.id}" data-type="connected">Block</button>
      </div>
    `;
    connectionDiv.appendChild(div);
  });
}

function showSents(data) {
  data.forEach(d => {
    const user = d.user;
    const div = document.createElement("div");
    div.className = "connection-item";
    div.dataset.username = user.username;
    div.innerHTML = `
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <div class="connection-info">
        <div class="connection-name">${user.name}</div>
        <div class="connection-username">@${user.username}</div>
        <div class="connection-meta">${user.department || 'N/A'} • ${user.level || 'N/A'}</div>
      </div>
      <button class="connection-btn connection-btn-cancel" data-type="sent" data-id="${d.request_id}">Cancel</button>
    `;
    connectionDiv.appendChild(div);
  });
}

function showReceived(data) {
  data.forEach(d => {
    const user = d.user;
    const div = document.createElement("div");
    div.className = "connection-item";
    div.dataset.username = user.username;
    div.innerHTML = `
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <div class="connection-info">
        <div class="connection-name">${user.name}</div>
        <div class="connection-username">@${user.username}</div>
        <div class="connection-meta">${user.department || 'N/A'} • ${user.level || 'N/A'}</div>
      </div>
      <div class="connection-actions">
        <button class="connection-btn connection-btn-accept" data-id="${d.request_id}">Accept</button>
        <button class="connection-btn connection-btn-reject" data-id="${d.request_id}">Reject</button>
      </div>
    `;
    connectionDiv.appendChild(div);
  });
}
// ============================================================================
// UPDATE FUNCTIONS
// ============================================================================
async function updateConnections() {
  try {
    const response = await api.get("/connections/count");
    
    if (response.status === "success") {
      const data = response.data;
      
      if (soundToggle) {
        soundToggle.checked = data.enable_sound;
      }
      
      if (pendingsCount) pendingsCount.textContent = data.pendings || "0";
      if (connectionsCount) connectionsCount.textContent = data.connections || "0";
    }
  } catch (error) {
    console.error("Update connections error:", error);
  }
}

async function loadBlockedUsers() {
  try {
    blockedDiv.innerHTML = '<div class="loading-state">Loading blocked users...</div>';
    
    const response = await api.get("/connections/blocked");
    
    if (response.status === "success") {
      const data = response.data;
      
      blockedDiv.innerHTML = "";
      
      if (data.total === 0) {
        blockedDiv.innerHTML = '<div class="empty-state">No blocked users</div>';
        return;
      }
      
      showBlocked(data.blocked_users);
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load blocked users error:", error);
    blockedDiv.innerHTML = '<div class="error-state">Error loading blocked users</div>';
  }
}

// ============================================================================
// ACTION HANDLERS - FIXED
// ============================================================================
function handleAvatar(src) {
  if (imgModal && image) {
    imgModal.classList.remove('hidden');
    image.src = src;
  }
}

async function handleButton(btn) {
  const type = btn.dataset.type;
  const item = btn.closest('.connection-item') || btn.closest('.blocked-item');
  
  if (btn.classList.contains("connection-btn-connect")) {
    const id = btn.dataset.user;
    await connectRequest(id, item, type);
  } else if (btn.classList.contains("connection-btn-cancel")) {
    const reqId = btn.dataset.id;
    await cancelRequest(reqId, item);
  } else if (btn.classList.contains("connection-btn-accept")) {
    const id = btn.dataset.id;
    await acceptRequest(id, item);
  } else if (btn.classList.contains("connection-btn-reject")) {
    const id = btn.dataset.id;
    await rejectRequest(id, item);
  } else if (btn.classList.contains("connection-btn-disconnect")) {
    const id = btn.dataset.user;
    await disconnectRequest(id, item);
  } else if (btn.classList.contains("connection-btn-block")) {
    const id = btn.dataset.user;
    await blockRequest(id, item);
  }
}

async function handleToggle(event) {
  const result = event.target.checked;
  
  try {
    const response = await api.post("/connections/settings", {
      enable_sound: result
    });
    
    if (response.status === "success") {
      showToast("Settings updated", "success");
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Settings update error:", error);
    showToast("Error updating settings", "error");
  }
}

// ============================================================================
// API REQUEST FUNCTIONS
// ============================================================================
async function unblockRequest(event) {
  const id = event.target.dataset.user;
  
  try {
    const response = await api.post(`/connections/unblock/${id}`);
    
    if (response.status === "success") {
      event.target.closest('.blocked-item').remove();
      showToast("User unblocked", "success");
      
      if (blockedDiv.querySelectorAll('.blocked-item').length === 0) {
        blockedDiv.innerHTML = '<div class="empty-state">No blocked users</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Unblock error:", error);
    showToast("Error unblocking user", "error");
  }
}

async function cancelRequest(id, div) {
  try {
    const response = await api.delete(`/connections/cancel/${id}`);
    
    if (response.status === "success") {
      showToast("Request cancelled", "success");
      div.remove();
      
      if (connectionDiv.querySelectorAll('.connection-item').length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">No sent requests</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Cancel request error:", error);
    showToast("Error cancelling request", "error");
  } finally {
    await updateConnections();
  }
}

async function disconnectRequest(id, div) {
  try {
    const response = await api.delete(`/connections/remove/${id}`);
    
    if (response.status === "success") {
      showToast("Connection removed", "success");
      div.remove();
      
      if (connectionDiv.querySelectorAll('.connection-item').length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">No connections</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Disconnect error:", error);
    showToast("Error disconnecting user", "error");
  } finally {
    await updateConnections();
  }
}

async function blockRequest(id, div) {
  try {
    const response = await api.post(`/connections/block/${id}`);
    
    if (response.status === "success") {
      div.remove();
      showToast("User blocked", "success");
      
      if (connectionDiv.querySelectorAll('.connection-item').length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">No connections</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Block error:", error);
    showToast("Error blocking user", "error");
  }
}

async function connectRequest(id, element, type) {
  try {
    const response = await api.post(`/connections/request/${id}`);
    
    if (response.status === "success") {
      showToast("Connection request sent", "success");
      
      if (type === "search") {
        const btn = element.querySelector('.search-connect-btn') || element;
        if (btn) {
          btn.classList.add("disabled");
          btn.textContent = "Request Sent";
        }
      } else {
        element.remove();
        
        // Check if empty and show message
        if (connectionDiv.querySelectorAll('.connection-item').length === 0) {
          connectionDiv.innerHTML = '<div class="empty-state">No suggestions available</div>';
        }
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Connect request error:", error);
    showToast("Error sending request", "error");
  }
}

async function acceptRequest(id, div) {
  try {
    const response = await api.post(`/connections/accept/${id}`);
    
    if (response.status === "success") {
      showToast("Connection accepted!", "success");
      div.remove();
      
      if (connectionDiv.querySelectorAll('.connection-item').length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">No pending requests</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Accept request error:", error);
    showToast("Error accepting request", "error");
  } finally {
    await updateConnections();
  }
}

async function rejectRequest(id, div) {
  try {
    const response = await api.post(`/connections/reject/${id}`);
    
    if (response.status === "success") {
      showToast("Request rejected", "success");
      div.remove();
      
      if (connectionDiv.querySelectorAll('.connection-item').length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">No pending requests</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Reject request error:", error);
    showToast("Error rejecting request", "error");
  } finally {
    await updateConnections();
  }
}