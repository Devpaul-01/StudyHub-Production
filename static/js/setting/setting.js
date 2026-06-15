
// Create option modal
const optionModal = document.createElement("div");
optionModal.innerHTML = `
  <div class="settings-option hidden">  
    <button class="settings-option-btn" id="visibility-settings">Set Profile Visibility</button>  
    <button class="settings-option-btn" id="preferences-settings">Set Study Preferences</button>  
  </div>  `;
document.body.appendChild(optionModal);
document.getElementById("profile-settings-btn").addEventListener("click", () => optionModal.classList.remove('hidden'));

// Initialize state
let goodList = [];
let needList = [];
let days = [];
let times = [];
let styles = [];
let goals = [];
let lastUpdated = "";

// Get DOM elements
const goodAtDiv = document.getElementById("good-at-container");
const needHelpDiv = document.getElementById("needs-help-container");
const studyStyleDiv = document.getElementById("study-style-container");
const goalsDiv = document.getElementById("goals-container");
const daysDiv = document.getElementById("available-days-container");
const timesDiv = document.getElementById("time-toggle-container");
const saveBtn = document.getElementById("save-btn");
const closeBtn = document.getElementById("close-preferences-modal");
const discardBtn = document.getElementById("discard-preferences-modal");
const visibilityModal = document.getElementById("visibility-modal");
const preferenceModal = document.getElementById("settings-preferences");

// Header mapping
const headerMap = {
  "needsHelp": "Set Things You Need Help With",
  "goodAt": "Set Things You Are Good At",
  "studyStyle": "Set Your Study Style",
  "time": "Set Time You Would Be Available",
  "goals": "Set Your Goals",
  "available-days": "Set Days You Would Be Available"
};

// Option modal click handler
optionModal.addEventListener("click", (e) => {
  if (e.target.id === "visibility-settings") {
    history.pushState({ visibilityModal: true }, "");
    visibilityModal.classList.remove("hidden");
    loadVisibilitySettings();
  } else if (e.target.id === "preferences-settings") {
    preferenceModal.classList.remove("hidden");
    loadSettings();
  }
});

// Browser back button handler
window.addEventListener("popstate", () => {
  if (!visibilityModal.classList.contains("hidden")) {
    saveVisibilitySettings();
    visibilityModal.classList.add("hidden");
  }
});

// Save preferences button
saveBtn.addEventListener("click", () => {
  savePreferenceChanges();
  preferenceModal.classList.add("hidden");
});

// Close button
closeBtn.addEventListener("click", () => {
  preferenceModal.classList.add("hidden");
});

// Discard button
discardBtn.addEventListener("click", () => {
  loadSettings();
  saveBtn.classList.remove("active");
});

// Day toggles
daysDiv.querySelectorAll('input[type="checkbox"]').forEach(input => {
  input.addEventListener("change", (e) => {
    const day = e.target.id.replace("days-toggle-", "");
    if (e.target.checked) {
      if (!days.includes(day)) {
        days.push(day);
      }
    } else {
      days = days.filter(d => d !== day);
    }
    e.target.classList.toggle("day-active", e.target.checked);
    saveBtn.classList.add("active");
  });
});

// Time toggles
timesDiv.querySelectorAll('input[type="checkbox"]').forEach(input => {
  input.addEventListener("change", (e) => {
    const time = e.target.id.replace("time-", "");
    if (e.target.checked) {
      if (!times.includes(time)) {
        times.push(time);
      }
    } else {
      times = times.filter(t => t !== time);
    }
    e.target.classList.toggle("time-active", e.target.checked);
    saveBtn.classList.add("active");
  });
});

// Visibility toggles
visibilityModal.querySelectorAll("input[type='checkbox']").forEach(input => {
  input.addEventListener("change", (e) => {
    e.target.classList.toggle("visibility-active", e.target.checked);
  });
});

// Save preference changes to server
async function savePreferenceChanges() {
  const formData = {
    needs_help: needList,
    good_at: goodList,
    goals: goals,
    available_times: times,
    available_days: days,
    study_style: styles
  };

  try {
    const response = await api.post("/study-buddy/preferences", formData);
    if (response.status === "success") {
      showToast(response.message, "success");
      saveBtn.classList.remove("active");
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    showToast("Error saving preferences: " + error, "error");
  }
}

// Save visibility settings to server
async function saveVisibilitySettings() {
  const formData = {};
  
  visibilityModal.querySelectorAll("input[type='checkbox']").forEach(input => {
    formData[input.dataset.type] = input.checked;
  });

  try {
    const response = await api.post("/profile/visibility-settings", formData);
    if (response.status === "success") {
      showToast(response.message, "success");
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    showToast("Visibility settings error encountered. Please try again later.", "error");
  }
}

// Load visibility settings from server
async function loadVisibilitySettings() {
  try {
    const response = await api.get("/profile/visibility-settings");
    if (response.status === "success") {
      const data = response.data;
      visibilityModal.querySelectorAll("input[type='checkbox']").forEach(input => {
        const settingKey = input.dataset.type;
        if (data.hasOwnProperty(settingKey)) {
          input.checked = data[settingKey];
        }
      });
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    showToast("Error loading visibility settings: " + error, "error");
  }
}

// Update all preferences in UI
function updatePreferences() {
  updateGood();
  updateNeed();
  updateStyle();
  updateGoals();
  updateDays();
  updateTimes();
}

// Update "Good At" section
function updateGood() {
  if (!goodList || goodList.length === 0) {
    goodAtDiv.innerHTML = `<div class="empty-state">Add some subjects you are good at<br>Note: You can add up to 10 items</div>`;
  } else {
    goodAtDiv.innerHTML = goodList.map(g => `
      <span class="tag">
        ${g}
        <button class="tag-remove" onclick="removeGood('${g}')">×</button>
      </span>
    `).join("");
  }
}

// Update "Need Help" section
function updateNeed() {
  if (!needList || needList.length === 0) {
    needHelpDiv.innerHTML = `<div class="empty-state">Add some subjects you need help with</div>`;
  } else {
    needHelpDiv.innerHTML = needList.map(n => `
      <span class="tag">
        ${n}
        <button class="tag-remove" onclick="removeNeed('${n}')">×</button>
      </span>
    `).join("");
  }
}

// Update "Study Style" section
function updateStyle() {
  if (!styles || styles.length === 0) {
    studyStyleDiv.innerHTML = `<div class="empty-state">Add your study styles<br>Note: You can add up to 10 styles</div>`;
  } else {
    studyStyleDiv.innerHTML = styles.map(s => `
      <span class="tag">
        ${s}
        <button class="tag-remove" onclick="removeStyle('${s}')">×</button>
      </span>
    `).join("");
  }
}

// Update "Goals" section
function updateGoals() {
  if (!goals || goals.length === 0) {
    goalsDiv.innerHTML = `<div class="empty-state">Add your study goals<br>Note: You can add up to 10 goals</div>`;
  } else {
    goalsDiv.innerHTML = goals.map(g => `
      <span class="tag">
        ${g}
        <button class="tag-remove" onclick="removeGoal('${g}')">×</button>
      </span>
    `).join("");
  }
}

// Update available days
function updateDays() {
  const daysSet = new Set(days);
  daysDiv.querySelectorAll("input[type='checkbox']").forEach(input => {
    const day = input.id.replace("days-toggle-", "");
    const isActive = daysSet.has(day);
    input.checked = isActive;
    input.classList.toggle("day-active", isActive);
  });
}

// Update available times
function updateTimes() {
  const timesSet = new Set(times);
  timesDiv.querySelectorAll("input[type='checkbox']").forEach(input => {
    const time = input.id.replace("time-", "");
    const isActive = timesSet.has(time);
    input.checked = isActive;
    input.classList.toggle("time-active", isActive);
  });
}

// Remove functions
function removeGoal(value) {
  saveBtn.classList.add("active");
  goals = goals.filter(g => g !== value);
  updateGoals();
}

function removeNeed(value) {
  saveBtn.classList.add("active");
  needList = needList.filter(n => n !== value);
  updateNeed();
}

function removeStyle(value) {
  saveBtn.classList.add("active");
  styles = styles.filter(s => s !== value);
  updateStyle();
}

function removeGood(value) {
  saveBtn.classList.add("active");
  goodList = goodList.filter(g => g !== value);
  updateGood();
}

// Add functions
function addGoal() {
  const input = document.getElementById("goal-input");
  const value = input.value.trim();
  
  if (!value) {
    showToast("Enter a goal you would like to add", "error");
    return;
  }
  
  if (goals.length >= 10) {
    showToast("You can only add up to 10 goals", "error");
    return;
  }
  
  if (!goals.includes(value)) {
    goals.push(value);
    input.value = "";
    updateGoals();
    saveBtn.classList.add("active");
  } else {
    showToast("This goal already exists", "error");
  }
}

function addHelp() {
  const input = document.getElementById("need-help-input");
  const value = input.value.trim();
  
  if (!value) {
    showToast("Enter a course you would like help with", "error");
    return;
  }
  
  if (!needList.includes(value)) {
    needList.push(value);
    input.value = "";
    updateNeed();
    saveBtn.classList.add("active");
  } else {
    showToast("This item already exists", "error");
  }
}

function addGood() {
  const input = document.getElementById("good-at-input");
  const value = input.value.trim();
  
  if (!value) {
    showToast("Enter a course you are quite good at", "error");
    return;
  }
  
  if (!goodList.includes(value)) {
    goodList.push(value);
    input.value = "";
    updateGood();
    saveBtn.classList.add("active");
  } else {
    showToast("This item already exists", "error");
  }
}

function addStudyStyle() {
  const input = document.getElementById("study-style-input");
  const value = input.value.trim();
  
  if (!value) {
    showToast("Kindly enter a study style you would like to add", "error");
    return;
  }
  
  if (!styles.includes(value)) {
    styles.push(value);
    input.value = "";
    updateStyle();
    saveBtn.classList.add("active");
  } else {
    showToast("This style already exists", "error");
  }
}

// Load settings from server
async function loadSettings() {
  try {
    const response = await api.get("/study-buddy/preferences");
    
    if (response.status === "success") {
      const data = response.data;
      
      if (!data || Object.keys(data).length === 0) {
        setPreferences();
        return;
      }
      
      // Load data into state
      days = data.available_days || [];
      times = data.available_times || [];
      needList = data.needs_help || [];
      goodList = data.good_at || [];
      styles = data.study_style || [];
      goals = data.goals || [];
      lastUpdated = data.last_updated || "";
      
      // Update UI
      if (lastUpdated) {
        const lastUpdatedEl = document.getElementById("last-updated");
        lastUpdatedEl.classList.remove("hidden");
        lastUpdatedEl.textContent = `Last updated: ${new Date(lastUpdated).toLocaleString()}`;
      }
      
      updatePreferences();
    }
  } catch (error) {
    showToast("Error loading settings: " + error, "error");
  }
}

// Set empty preferences
function setPreferences() {
  document.querySelectorAll(".preference-header").forEach(pref => {
    const type = pref.dataset.type;
    if (headerMap[type]) {
      pref.textContent = headerMap[type];
    }
  });
  
  document.querySelectorAll(".preference-container").forEach(prefCon => {
    prefCon.innerHTML = `<div class="empty-state">No preference set yet</div>`;
  });
  
  document.querySelectorAll(".switch input[type='checkbox']").forEach(input => {
    input.checked = false;
  });
  
  saveBtn.classList.remove("active");
}

// Initialize on page load - load both settings
document.getElementById("preferences-settings").addEventListener("click", async (e) => {
  await loadSettings();
});

document.getElementById("visibility-settings").addEventListener("click", async (e) => {
  await loadVisibilitySettings();
});