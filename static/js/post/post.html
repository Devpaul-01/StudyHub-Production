
const availableTags = ["Accounting", "Acting", "Aerospace Engineering", "African Studies", "Agricultural Science", "Algebra", "Android Development", "Animation", "Anthropology", "Applied Mathematics", "Archaeology", "Architecture", "Art History", "Artificial Intelligence", "Artificial Intelligence Subfields", "AR/VR Learning", "Astronomy", "Automotive Engineering", "Audiology", "Biochemistry", "Bioinformatics", "Biology", "Biomedical Engineering", "Blockchain", "Botany", "Business Administration", "Business Analytics", "Career Advice", "Chemical Engineering", "Chemistry", "Civil Engineering", "Cloud Computing", "College Life", "Commerce", "Communication Studies", "Computer Engineering", "Computer Science", "Construction Management", "Content Creation", "Creative Writing", "Criminology", "Cultural Studies", "Cybersecurity", "Dance", "Data Analysis", "Data Engineering", "Data Science", "Data Visualization", "Database Management", "Dart", "Dentistry", "Dermatology", "Design Thinking", "Digital Art", "Digital Marketing", "Digital Productivity Tools", "Drama", "Drawing", "Early Childhood Education", "Ecology", "Economics", "Education", "Electrical Engineering", "Electronics Engineering", "Emergency Medicine", "Embedded Systems", "Emotional Intelligence", "Engineering", "English Language", "Entrepreneurship", "Environmental Science", "Epidemiology", "Ethics", "Excel Skills", "Fashion Design", "Film Production", "Finance", "Fine Art", "Food Science", "Forensic Science", "French Language", "Game Development", "Gender Studies", "Genetics", "Geography", "Geology", "Geometry", "Graphic Design", "Health Education", "Health Science", "History", "Homeschooling", "Hospitality Management", "Human Anatomy", "Human Resources", "Human Rights", "Human Physiology", "Immunology", "Industrial Engineering", "Information Technology", "International Relations", "iOS Development", "Journalism", "Java", "JavaScript", "Kindergarten Education", "Kotlin", "Languages", "Law", "Leadership", "Learning Analytics", "Learning Disabilities", "Linguistics", "Literature", "Machine Learning", "Machine Learning Subfields", "Marine Biology", "Marketing", "Mathematics", "Mechanical Engineering", "Mechatronics Engineering", "Media Studies", "Medical Laboratory Science", "Medicine and Surgery", "Mental Health", "Microbiology", "Mobile App Development", "Molecular Biology", "Moral Philosophy", "Music", "Network Engineering", "Neuroscience", "Nursing", "Nutrition", "Online Learning", "Occupational Therapy", "Optometry", "Pathology", "Pediatric Medicine", "Performing Arts", "Petroleum Engineering", "Pharmacy", "Philosophy", "Photography", "Physical Education", "Physical Therapy", "Physics", "Physiology", "PHP", "Pre-Med", "Primary Education", "Product Design", "Project Management", "Psychiatry", "Psychology", "Public Administration", "Public Health", "Public Speaking", "Python Libraries", "Python Programming", "Radiology", "React Development", "React Native", "Reading Skills", "R Programming", "Research Methods", "Robotics", "Ruby", "Rust", "Scholarship Opportunities", "Science Education", "Simulation-Based Learning", "Sculpture", "Secondary Education", "Self-Study", "Social Sciences", "Sociology", "Software Development", "Software Engineering", "Spanish Language", "Special Education", "SQL", "Statistics", "STEM", "Study Abroad", "Study Tips", "Surgery", "Swift", "Teacher Training", "Theology", "Theatre Studies", "TOEFL Prep", "TypeScript", "UI Design", "UI/UX Design", "URDU Language", "Veterinary Medicine", "Virtual Learning", "Visual Arts", "VR Learning", "Web Development", "Web Frameworks", "Wildlife Biology", "Writing Skills", "XR Learning", "Zoology", "Audiology", "Artificial Intelligence Subfields", "AR/VR Learning", "Dart", "Data Visualization", "EdTech Tools", "Go", "Java", "JavaScript", "Kotlin", "Learning Analytics", "Machine Learning Subfields", "Occupational Therapy", "PHP", "Python Libraries", "R Programming", "React Native", "Ruby", "Rust", "Simulation-Based Learning", "Speech Therapy", "SQL", "Swift", "TypeScript", "Veterinary Medicine", "VR Learning", "Web Frameworks", "XR Learning"]


const maxTags = 5;
let selectedTags = [];
let postFiles = [];
let postFilesUrls = [];
let postResources = [];

// Tags functionality
const tagsDropdown = document.getElementById("tags-dropdown");
const tagInput = document.getElementById("tags-input");

tagInput.addEventListener("input", function(e) {
  const input = e.target.value.toLowerCase();
  
  if (input.length === 0) {
    tagsDropdown.classList.add("hidden");
    return;
  }
  
  if (selectedTags.length >= maxTags) {
    tagsDropdown.classList.add('hidden');
    return;
  }
  
  const relatedTags = availableTags.filter(tag => 
    tag.toLowerCase().includes(input) && !selectedTags.includes(tag)
  );
  
  if (relatedTags.length > 0) {
    tagsDropdown.innerHTML = relatedTags.slice(0, 10).map(tag => 
      `<div class="tag-option" onclick="addTag('${tag}')">${tag}</div>`
    ).join('');
    tagsDropdown.classList.remove('hidden');
  } else {
    tagsDropdown.classList.add('hidden');
  }
});

tagInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const value = e.target.value.trim();
    if (value && selectedTags.length < maxTags) {
      addTag(value);
    }
  }
});

function addTag(tag) {
  if (selectedTags.length >= maxTags) {
    showToast(`You can only add up to ${maxTags} tags`, 'info');
    return;
  }
  
  if (!selectedTags.includes(tag)) {
    selectedTags.push(tag);
    renderSelectedTags();
  }
  
  document.getElementById('tags-input').value = '';
  document.getElementById('tags-dropdown').classList.add('hidden');
}

function removeTag(tag) {
  selectedTags = selectedTags.filter(t => t !== tag);
  renderSelectedTags();
}

function renderSelectedTags() {
  const container = document.getElementById('selected-tags');
  container.innerHTML = selectedTags.map(tag => 
    `<span data-value="${tag}" class="tag-badge">
      ${tag}
      <button type="button" class="tag-remove" onclick="removeTag('${tag}')">×</button>
    </span>`
  ).join('');
}

// Toggle thread settings
function toggleThreadSettings() {
  const threadModal = document.getElementById('thread-modal');
  const isChecked = document.getElementById('thread-toggle').checked;
  
  if (isChecked) {
    threadModal.classList.remove('hidden');
  } else {
    threadModal.classList.add('hidden');
  }
}

// File upload functionality
const postModal = document.getElementById("create-post-modal");
postModal.querySelectorAll('input[type="file"]').forEach(input => {
  input.addEventListener("change", function(event) {
    const files = Array.from(event.target.files);
    postFiles.push(...files);
    
    const previewContainer = document.getElementById('preview-container'); // Make sure this exists in HTML
    
    files.forEach(file => {
      if (!file) return;
      
      const previewDiv = document.createElement("div");
      previewDiv.className = "preview-item";
      
      let media;
      if (file.type.startsWith("image/")) {
        media = document.createElement("img");
        media.src = URL.createObjectURL(file);
      } else if (file.type.startsWith("video/")) {
        media = document.createElement("video");
        media.src = URL.createObjectURL(file);
        media.controls = true;
      } else {
        media = document.createElement("div");
        media.className = "file-name";
        media.textContent = file.name;
      }
      
      previewDiv.appendChild(media);
      
      const loader = document.createElement("div");
      loader.className = "loader";
      
      const btn = document.createElement('button');
      btn.className = "cancel-upload";
      btn.textContent = "×";
      btn.style.display = "none"; // Hide until upload completes
      
      previewDiv.appendChild(loader);
      previewDiv.appendChild(btn);
      previewContainer.appendChild(previewDiv);
      
      uploadPostFile(file, btn, loader, previewDiv);
    });
  });
});

async function uploadPostFile(file, btn, loader, previewDiv) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await api.post("/posts/resource/upload", formData);
    
    if (response.status === "success") {
      const resource = {
        url: response.data.url,
        type: response.data.type,
        filename: response.data.filename
      };
      
      postResources.push(resource); // ✅ Use this instead of postFilesUrls
      
      const secureUrl = response.data.url;
      postFilesUrls.push(secureUrl);
      loader.remove();
      btn.style.display = "block";
      
      btn.onclick = () => {
        previewDiv.remove();
        postResources = postResources.filter(r => r.url !== resource.url);
        postFilesUrls = postFilesUrls.filter(url => url !== secureUrl);
        postFiles = postFiles.filter(f => f !== file);
      };
    } else {
      loader.classList.add("error");
      loader.textContent = "Upload failed";
    }
  } catch (error) {
    console.error("Upload error:", error);
    showToast("Error encountered uploading file", "error");
    loader.classList.add("error");
    loader.textContent = "Failed";
  }
}

function handleCreatePost(event) {
  event.preventDefault();
  
  let choosedTags = [];
  const title = document.getElementById("post-title").value;
  const content = document.getElementById("post-content").value;
  const postType = document.getElementById("post-type").value;
  
  document.querySelectorAll("#selected-tags .tag-badge").forEach(tag => {
    choosedTags.push(tag.dataset.value);
  });
  
  const threadEnabled = document.getElementById('thread-toggle').checked;
  
  // Create JSON payload instead of FormData for better control
  const postData = {
    title: title,
    text_content: content,
    post_type: postType,
    tags: choosedTags,
    resources: postResources,
    thread_enabled: threadEnabled
  };
  
  if (threadEnabled) {
    const threadTitle = document.getElementById("thread-title").value;
    const threadDescription = document.getElementById("thread-description").value;
    const maxMembers = document.getElementById("thread-max-members").value;
    const threadApproval = document.getElementById('thread-approval-toggle').checked;
    
    postData.thread_title = threadTitle;
    postData.thread_description = threadDescription;
    postData.max_members = maxMembers ? parseInt(maxMembers) : null;
    postData.requires_approval = threadApproval;
  }
  
  createPost(postData);
}

async function createPost(postData) {
  try {
    const response = await api.post("/posts/create", postData);
    if (response.status === "success") {
      showToast("Post created successfully!", "success");
      
      // Reset form
      postFilesUrls = [];
      postResources = [];
      postFiles = [];
      selectedTags = [];
      document.getElementById("post-title").value = "";
      document.getElementById("post-content").value = "";
      document.getElementById("tags-input").value = "";
      renderSelectedTags();
      
      const previewContainer = document.getElementById('preview-container');
      if (previewContainer) {
        previewContainer.innerHTML = "";
      }
      
      document.getElementById("create-post-modal").classList.remove("active");
      
      // Optionally reload posts
      // loadPosts();
    }
  } catch (error) {
    console.error("Create post error:", error);
    showToast("Error creating post, please try again later", "error");
  }
}


