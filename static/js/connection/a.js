// ============================================================================
// CONNECTION SYSTEM - StudyHub
// Handles connection requests, suggestions, mutuals, and blocking
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

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const imgModal = document.getElementById("image-modal");
const image = imgModal.querySelector("img");
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

// Create loading and button elements
const h3 = document.createElement("h3");
h3.textContent = "Loading...";
h3.id = "bottom-loader";

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
// EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
  // Settings button
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      settingsModal.classList.toggle("hidden");
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
      if (e.target === imgModal) {
        imgModal.classList.add("hidden");
      }
    });
  }

  // Tab switching
  const allTabs = document.querySelectorAll(".tab");
  allTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      allTabs.forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
      currentTab = e.target.dataset.tab;
    });
  });

  // Search input with debounce
  if (searchInputEl) {
    let timer;
    searchInputEl.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleSearch();
      }, 300);
    });
  }

  // Search load more button
  searchBtn.addEventListener("click", async () => {
    userPage += 1;
    await handleSearch();
  });

  // Clear filters button
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
        showToast("Kindly enter a skill", "warning");
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

  // Connection div click delegation
  connectionDiv.addEventListener("click", async (e) => {
    if (e.target.classList.contains("connection-div")) {
      const username = e.target.dataset.username;
      window.location.href = `/student/profile/${username}`;
    } else if (e.target.classList.contains("connection-avatar")) {
      const imgSrc = e.target.src;
      handleAvatar(imgSrc);
    } else if (e.target.classList.contains("connection-btn") || 
               e.target.classList.contains("connection-btn-connect") ||
               e.target.classList.contains("connection-btn-cancel") ||
               e.target.classList.contains("connection-btn-accept") ||
               e.target.classList.contains("connection-btn-reject") ||
               e.target.classList.contains("connection-btn-block") ||
               e.target.classList.contains("connected-btn-disconnect")) {
      await handleButton(e);
    }
  });

  // Users div click delegation
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
    if (e.target.classList.contains("blocked-div")) {
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
      const classOption = document.createElement("option");
      classOption.className = "select-option";
      classOption.textContent = level;
      classOption.value = level;
      classlevelSelect.appendChild(classOption);
    });
  }

  const departmentSelect = document.getElementById("filter-select-department");
  if (departmentSelect) {
    departmentMap.forEach(dept => {
      const departmentOption = document.createElement("option");
      departmentOption.className = "select-option";
      departmentOption.textContent = dept;
      departmentOption.value = dept;
      departmentSelect.appendChild(departmentOption);
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
// TAB SWITCHING
// ============================================================================

async function switchType(type) {
  page = 1;
  perPage = 20;
  hasMore = true;
  connectionDiv.innerHTML = "";
  
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
// SEARCH HANDLING
// ============================================================================

async function handleSearch() {
  if (isuserLoading) return;
  if (!userhasMore) return;

  const searchInputValue = document.getElementById("connection-search-input")?.value || "";
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
      userhasMore = pageDetails.pages > userPage;

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
      
      if (userhasMore && !searchBtn.parentElement) {
        usersDiv.insertAdjacentElement("afterend", searchBtn);
      } else if (!userhasMore) {
        searchBtn.remove();
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Search error:", error);
    showToast("Error loading users: " + error.message, "error");
  } finally {
    isuserLoading = false;
  }
}

// ============================================================================
// LOAD FUNCTIONS
// ============================================================================

async function loadSugguestions() {
  if (pendingHtml) pendingHtml.classList.add("hidden");
  if (connectionHtml) connectionHtml.classList.add("hidden");
  loadBtn.remove();

  try {
    if (isLoading) return;
    isLoading = true;
    
    connectionDiv.innerHTML = '<div class="loader-state" id="sugguestions-loader">Loading Suggestions...</div>';
    
    const response = await api.get("/connections/suggestions");
    
    if (response.status === "success") {
      const data = response.data.suggestions;
      document.getElementById("sugguestions-loader")?.remove();
      
      if (!data || data.length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">No suggestions found. Personalize your profile to get better suggestions!</div>';
        return;
      }
      
      showSugguestions(data);
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load suggestions error:", error);
    showToast("Error loading suggestions: " + error.message, "error");
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
    
    if (connectionDiv.querySelectorAll('[class*="connection"]').length === 0) {
      connectionDiv.innerHTML = '<div class="loader-state" id="loader-text">Loading...</div>';
    } else {
      connectionDiv.insertAdjacentElement("beforeend", h3);
    }

    const response = await api.get("/connections/mutuals", {
      page: page,
      per_page: perPage
    });

    if (response.status === "success") {
      hasMore = response.total_pages > page;
      const data = response.data;
      
      document.getElementById("loader-text")?.remove();

      if (!data || data.length === 0) {
        if (page === 1) {
          connectionDiv.innerHTML = '<div class="empty-state">No Mutual Connections Found</div>';
        }
        loadBtn.remove();
        hasMore = false;
        return;
      }

      showMutuals(data);
      
      if (hasMore && !loadBtn.parentElement) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load mutuals error:", error);
    showToast("Error loading mutual connections: " + error.message, "error");
    
    if (document.getElementById("loader-text")) {
      connectionDiv.innerHTML = `
        <div class="connection-reload" id="mutual-connections-reload">
          <h1 class="reload-text">Error encountered loading connections</h1>
          <button onclick="loadMutuals()" class="connection-reload-btn">Try again</button>
        </div>
      `;
    }
  } finally {
    isLoading = false;
    document.getElementById("bottom-loader")?.remove();
  }
}

async function loadConnections() {
  if (pendingHtml) pendingHtml.classList.add("hidden");
  if (connectionHtml) connectionHtml.classList.remove("hidden");
  
  if (!hasMore) return;
  if (isLoading) return;

  try {
    isLoading = true;
    
    if (connectionDiv.querySelectorAll('[class*="connection"]').length === 0) {
      connectionDiv.innerHTML = '<div class="loader-state" id="loader-text">Loading...</div>';
    } else {
      connectionDiv.insertAdjacentElement("beforeend", h3);
    }

    const response = await api.get("/connections/list", {
      page: page,
      per_page: perPage
    });

    if (response.status === "success") {
      hasMore = response.data.pages > page;
      const data = response.data.connections;
      
      document.getElementById("loader-text")?.remove();

      if (!data || data.length === 0) {
        if (page === 1) {
          connectionDiv.innerHTML = '<div class="empty-state">No Connections Yet</div>';
        }
        document.getElementById("load-btn")?.remove();
        hasMore = false;
        return;
      }

      showConnected(data);
      
      if (hasMore && !loadBtn.parentElement) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load connections error:", error);
    showToast("Error loading connections: " + error.message, "error");
  } finally {
    isLoading = false;
    document.getElementById("bottom-loader")?.remove();
  }
}

async function loadReceived() {
  if (connectionHtml) connectionHtml.classList.add("hidden");
  if (pendingHtml) pendingHtml.classList.remove("hidden");
  
  if (!hasMore) return;
  if (isLoading) return;

  try {
    isLoading = true;
    
    document.getElementById("bottom-loader")?.remove();
    connectionDiv.insertAdjacentElement("beforeend", h3);

    const response = await api.get("/connections/pending", {
      type: "received",
      page: page,
      per_page: perPage
    });

    if (response.status === "success") {
      hasMore = response.pages > page;
      const data = response.data;
      
      if (!data || data.length === 0) {
        if (page === 1) {
          connectionDiv.innerHTML = '<div class="empty-state">No Pending Received Requests</div>';
        }
        document.getElementById("bottom-loader")?.remove();
        document.getElementById("load-btn")?.remove();
        hasMore = false;
        return;
      }

      showReceived(data);
      
      if (hasMore && !loadBtn.parentElement) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load received error:", error);
    showToast("Error: " + error.message, "error");
  } finally {
    isLoading = false;
    document.getElementById("bottom-loader")?.remove();
  }
}

async function loadSents() {
  if (isLoading) return;
  if (!hasMore) return;

  if (connectionHtml) connectionHtml.classList.add("hidden");
  if (pendingHtml) pendingHtml.classList.remove("hidden");

  try {
    isLoading = true;
    
    if (connectionDiv.innerHTML === "") {
      connectionDiv.innerHTML = '<div class="loader-state">Loading...</div>';
    } else {
      connectionDiv.insertAdjacentElement("beforeend", h3);
    }

    const response = await api.get("/connections/pending", {
      page: page,
      per_page: perPage,
      type: "sent"
    });

    if (response.status === "success") {
      hasMore = response.pages > page;
      const data = response.data;

      if (!data || data.length === 0) {
        if (page === 1) {
          connectionDiv.innerHTML = '<div class="empty-state">No Pending Sent Requests</div>';
        }
        document.getElementById("bottom-loader")?.remove();
        document.getElementById("load-btn")?.remove();
        hasMore = false;
        return;
      }

      showSents(data);
      
      if (hasMore && !loadBtn.parentElement) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load sents error:", error);
    showToast("Error: " + error.message, "error");
  } finally {
    isLoading = false;
    document.getElementById("bottom-loader")?.remove();
  }
}

async function loadPendings() {
  if (pendingHtml) pendingHtml.classList.remove("hidden");
  if (connectionHtml) connectionHtml.classList.add("hidden");

  try {
    connectionDiv.innerHTML = '<h1 class="loader" id="connection-loader-text">Loading connections...</h1>';

    const response = await api.get("/connections/pending", {
      type: "received",
      page: page,
      per_page: perPage
    });

    if (response.status === "success") {
      const data = response.data;
      document.getElementById("connection-loader-text")?.remove();
      hasMore = response.pages > page;

      if (!data || data.length === 0) {
        connectionDiv.innerHTML = '<div class="empty-state">Pending Connections List is empty</div>';
        hasMore = false;
        return;
      }

      showReceived(data);
      
      if (hasMore && !loadBtn.parentElement) {
        connectionDiv.insertAdjacentElement("beforeend", loadBtn);
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load pendings error:", error);
    showToast("Error loading connections: " + error.message, "error");
    connectionDiv.innerHTML = `
      <div class="connection-error" id="connection-error">
        Error loading connections
        <button class="connection-retry" onclick="loadPendings()">Retry</button>
      </div>
    `;
  }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function showBlocked(data) {
  const html = document.createElement("div");
  html.innerHTML = data.map(user => `
    <div class="blocked-div" data-username="${user.username}">
      <div class="time-blocked">${user.blocked_at || 'N/A'}</div>
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <div class="connection-name">${user.name}</div>
      <h3 class="connection-username">@${user.username}</h3>
      <div class="connection-department">${user.department || 'N/A'}</div>
      <button class="unblock-btn" data-user="${user.id}" data-type="blocked">Unblock</button>
    </div>
  `).join("");
  blockedDiv.appendChild(html);
}

function showSugguestions(data) {
  const html = document.createElement("div");
  html.innerHTML = data.map(d => {
    const user = d.user;
    return `
      <div class="connection-div-sugguestions" data-username="${user.username}">
        <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
        <div class="connection-name">${user.name}</div>
        <h3 class="connection-username">@${user.username}</h3>
        <div class="connection-class-level">${user.class_level || 'N/A'}</div>
        <div class="connection-department">${user.department || 'N/A'}</div>
        <div class="connection-reputation-level">${user.reputation_level || 'N/A'}</div>
        <div class="connection-reputation">${user.reputation || 0}</div>
        <div class="connection-match-score">Match Score: ${d.match_score}%</div>
        <div class="connection-reason">Reason: ${d.reason}</div>
        <button class="connection-btn-connect" data-user="${user.id}" data-type="sugguestions" id="connection-btn-${user.id}">Connect</button>
        <div class="connection-bio">${user.bio || ''}</div>
        <div class="connection-skills">${(user.skills || []).join(', ')}</div>
      </div>
    `;
  }).join("");
  connectionDiv.appendChild(html);
}

function showUsers(users) {
  const html = document.createElement("div");
  html.innerHTML = users.map(user => `
    <div class="search-div-users" data-username="${user.username}" id="users-search-list-${user.id}">
      <div class="user-status" id="user-status-${user.id}">${user.connection_status}</div>
      <img class="user-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      ${user.connection_status === 'none' ? 
        `<button data-user="${user.id}" class="search-connect-btn">Connect</button>` : 
        `<button class="search-connect-btn disabled">${user.connection_status}</button>`
      }
      <h1 class="user-name">${user.name}</h1>
      <h3 class="user-username">@${user.username}</h3>
      ${!user.private ? `
        <div class="user-department">${user.department || 'N/A'}</div>
        <div class="user-reputation">${user.reputation || 0}</div>
        <div class="user-class-level">${user.class_level || 'N/A'}</div>
        <div class="user-reputation-level">${user.reputation_level || 'N/A'}</div>
      ` : '<div class="user-private">Private Profile</div>'}
      <div class="connection-bio">${(user.bio || '').slice(0, 50)}${user.bio && user.bio.length > 50 ? '...' : ''}</div>
      <div class="user-skills">${(user.skills || []).slice(0, 5).join(', ')}</div>
    </div>
  `).join("");
  usersDiv.appendChild(html);
}

function showMutuals(data) {
  const html = document.createElement("div");
  html.innerHTML = data.map(d => {
    const user = d.user;
    return `
      <div class="connection-div-mutuals" data-username="${user.username}" id="connection-connected-list-${d.connection_id || user.id}">
        <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
        <button class="connection-btn-connect" data-user="${user.id}" data-type="mutuals">Connect</button>
        <div class="connection-user" id="connection-user-${user.id}">
          <div class="connection-level">${user.level || 'N/A'}</div>
          <div class="connection-name">${user.name}</div>
          <h3 class="connection-username">@${user.username}</h3>
          <div class="connection-department">${user.department || 'N/A'}</div>
          <div class="connection-match-score">Match Score: ${d.match_score || 0}%</div>
          <div class="connection-bio">${user.bio || ''}</div>
        </div>
      </div>
    `;
  }).join("");
  connectionDiv.appendChild(html);
}

function showConnected(data) {
  const html = document.createElement("div");
  html.innerHTML = data.map(user => `
    <div class="connection-div-connected" data-username="${user.username}">
      <div class="connection-status">Connected</div>
      <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
      <button class="connection-btn-block" data-user="${user.id}" data-type="connected">Block</button>
      <button class="connected-btn-disconnect" data-user="${user.id}" data-type="connected">Disconnect</button>
      <div class="connection-user" id="connection-user-${user.id}">
        <div class="connection-level">${user.reputation_level || 'N/A'}</div>
        <div class="connection-name">${user.name}</div>
        <h3 class="connection-username">@${user.username}</h3>
        <div class="connection-department">${user.department || 'N/A'}</div>
        <div class="connection-bio">${user.bio || ''}</div>
      </div>
    </div>
  `).join("");
  connectionDiv.appendChild(html);
}

function showSents(data) {
  const html = document.createElement("div");
  html.innerHTML = data.map(d => {
    const user = d.user;
    return `
      <div class="connection-div-sent" id="connection-sent-list-${d.request_id}">
        <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
        <button class="connection-btn-cancel" data-type="sent" data-id="${d.request_id}">Cancel Request</button>
        <div class="connection-request-time">${d.requested_at || 'N/A'}</div>
        <div class="connection-user" id="connection-user-${user.id}">
          <div class="connection-level">${user.level || 'N/A'}</div>
          <div class="connection-name">${user.name}</div>
          <h3 class="connection-username">@${user.username}</h3>
          <div class="connection-department">${user.department || 'N/A'}</div>
        </div>
      </div>
    `;
  }).join("");
  connectionDiv.appendChild(html);
}

function showReceived(data) {
  const html = document.createElement("div");
  html.innerHTML = data.map(d => {
    const user = d.user;
    return `
      <div class="connection-div-received" id="connection-received-list-${d.request_id}">
        <img class="connection-avatar" src="/static/uploads/avatars/${user.avatar}" alt="${user.name}">
        <button class="connection-btn-accept" data-id="${d.request_id}">Accept Request</button>
        <button class="connection-btn-reject" data-id="${d.request_id}">Reject Request</button>
        <div class="connection-request-time">${d.requested_at || 'N/A'}</div>
        <div class="connection-user" id="connection-user-${user.id}">
          <div class="connection-level">${user.level || 'N/A'}</div>
          <div class="connection-name">${user.name}</div>
          <h3 class="connection-username">@${user.username}</h3>
          <div class="connection-department">${user.department || 'N/A'}</div>
        </div>
      </div>
    `;
  }).join("");
  connectionDiv.appendChild(html);
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
      
      document.querySelectorAll(".tab-connection").forEach(span => {
        const type = span.id.replace("connection-", "");
        span.textContent = data[type] || "0";
      });
    }
  } catch (error) {
    console.error("Update connections error:", error);
  }
}

async function loadBlockedUsers() {
  try {
    blockedDiv.innerHTML = '<div id="blocked-empty" class="empty-state">Loading Blocked Users...</div>';
    
    const response = await api.get("/connections/blocked");
    
    if (response.status === "success") {
      const data = response.data;
      
      if (data.total === 0) {
        document.getElementById("blocked-empty").textContent = "No blocked users";
        return;
      }
      
      blockedDiv.innerHTML = "";
      showBlocked(data.blocked_users);
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Load blocked users error:", error);
    showToast("Error: " + error.message, "error");
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================
function handleAvatar(src) {
  imgModal.classList.remove('hidden');
  image.src = src;
}

async function handleButton(e) {
  const target = e.target;
  const classList = Array.from(target.classList);
  const type = target.dataset.type;
  const div = target.closest('[class*="connection-div"]');
  
  // Extract button type from class name
  let btnType = "";
  if (classList.includes("connection-btn-connect")) btnType = "connect";
  else if (classList.includes("connection-btn-cancel")) btnType = "cancel";
  else if (classList.includes("connection-btn-accept")) btnType = "accept";
  else if (classList.includes("connection-btn-reject")) btnType = "reject";
  else if (classList.includes("connection-btn-block")) btnType = "block";
  else if (classList.includes("connected-btn-disconnect")) btnType = "disconnect";

  if (type === "sugguestions" || type === "mutuals") {
    const id = target.dataset.user;
    await connectRequest(id, div, type);
  } else if (type === "connected") {
    const id = target.dataset.user;
    if (btnType === "disconnect") {
      await disconnectRequest(id, div);
    } else if (btnType === "block") {
      await blockRequest(id, div);
    }
  } else if (btnType === "cancel") {
    const reqId = target.dataset.id;
    await cancelRequest(reqId, div);
  } else if (btnType === "accept") {
    const id = target.dataset.id;
    await acceptRequest(id, div);
  } else if (btnType === "reject") {
    const id = target.dataset.id;
    await rejectRequest(id, div);
  }
}

async function handleToggle(event) {
  const result = event.target.checked;
  
  try {
    const response = await api.post("/connections/settings", {
      enable_sound: result
    });
    
    if (response.status === "success") {
      showToast("Settings updated successfully", "success");
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Settings update error:", error);
    showToast("Error updating connection settings: " + error.message, "error");
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
      event.target.closest('.blocked-div').remove();
      showToast("User unblocked successfully", "success");
      
      // Check if blockedDiv is empty
      if (blockedDiv.querySelectorAll('.blocked-div').length === 0) {
        blockedDiv.innerHTML = '<div class="empty-state">No blocked users</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Unblock error:", error);
    showToast("Error unblocking user: " + error.message, "error");
  }
}

async function cancelRequest(id, div) {
  try {
    const response = await api.delete(`/connections/cancel/${id}`);
    
    if (response.status === "success") {
      showToast("Request cancelled successfully", "success");
      div.remove();
      
      if (connectionDiv.innerHTML.trim() === "") {
        connectionDiv.innerHTML = '<div class="empty-state">No pending sent requests</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Cancel request error:", error);
    showToast("Error canceling request: " + error.message, "error");
  } finally {
    await updateConnections();
  }
}

async function disconnectRequest(id, div) {
  try {
    const response = await api.delete(`/connections/remove/${id}`);
    
    if (response.status === "success") {
      showToast("Connection removed successfully", "success");
      div.remove();
      
      if (connectionDiv.innerHTML.trim() === "") {
        connectionDiv.innerHTML = '<div class="empty-state">No Connections</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Disconnect error:", error);
    showToast("Error disconnecting user: " + error.message, "error");
  } finally {
    await updateConnections();
  }
}

async function blockRequest(id, div) {
  try {
    const response = await api.post(`/connections/block/${id}`);
    
    if (response.status === "success") {
      div.remove();
      showToast("User blocked. You can view blocked users in settings.", "success");
      
      if (connectionDiv.innerHTML.trim() === "") {
        connectionDiv.innerHTML = '<div class="empty-state">No Connections</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Block error:", error);
    showToast("Error blocking user: " + error.message, "error");
  }
}

async function connectRequest(id, div, type) {
  try {
    const response = await api.post(`/connections/request/${id}`);
    
    if (response.status === "success") {
      showToast("Connection request sent successfully", "success");
      
      if (type === "search") {
        div.classList.add("disabled");
        div.textContent = "Request Sent";
      } else {
        div.remove();
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Connect request error:", error);
    showToast("Error sending connection request: " + error.message, "error");
  }
}

async function acceptRequest(id, div) {
  try {
    const response = await api.post(`/connections/accept/${id}`);
    
    if (response.status === "success") {
      showToast("Connection request accepted!", "success");
      div.remove();
      
      if (connectionDiv.innerHTML.trim() === "") {
        connectionDiv.innerHTML = '<div class="empty-state">No pending received requests</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Accept request error:", error);
    showToast("Error accepting request: " + error.message, "error");
  } finally {
    await updateConnections();
  }
}

async function rejectRequest(id, div) {
  try {
    const response = await api.post(`/connections/reject/${id}`);
    
    if (response.status === "success") {
      showToast("Connection request rejected", "success");
      div.remove();
      
      if (connectionDiv.innerHTML.trim() === "") {
        connectionDiv.innerHTML = '<div class="empty-state">No pending received requests</div>';
      }
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    console.error("Reject request error:", error);
    showToast("Error rejecting request: " + error.message, "error");
  } finally {
    await updateConnections();
  }
}

      