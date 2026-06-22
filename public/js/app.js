// ===== Smart Notes — Frontend App =====

const API_BASE = '/api';

// DOM Elements
const notesGrid = document.getElementById('notesGrid');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const searchNotesGrid = document.getElementById('searchNotesGrid');
const aiAnswerBox = document.getElementById('aiAnswerBox');
const aiAnswerContent = document.getElementById('aiAnswerContent');
const searchResultsTitle = document.getElementById('searchResultsTitle');
const emptyState = document.getElementById('emptyState');
const addNoteModal = document.getElementById('addNoteModal');
const noteDetailModal = document.getElementById('noteDetailModal');
const noteDetailContent = document.getElementById('noteDetailContent');
const processingOverlay = document.getElementById('processingOverlay');
const processingText = document.getElementById('processingText');
const noteInput = document.getElementById('noteInput');
const folderInput = document.getElementById('folderInput');
const toastContainer = document.getElementById('toastContainer');
const searchContainer = document.getElementById('searchContainer');
const themeSelects = document.querySelectorAll('.theme-select');
const btnToggleMobileSearch = document.getElementById('btnToggleMobileSearch');
const btnSidebarToggle = document.getElementById('btnSidebarToggle');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

// Folder DOM Elements
const categoriesView = document.getElementById('categoriesView');
const foldersView = document.getElementById('foldersView');
const foldersList = document.getElementById('foldersList');
const activeFilterBanner = document.getElementById('activeFilterBanner');
const filterBannerText = document.getElementById('filterBannerText');

// State
let allNotes = [];
let activeCategory = 'all';
let activeFolder = 'all';
let activeView = 'categories'; // 'categories' or 'folders'
let allFolders = [];
let searchTimeout = null;

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadNotes();
  loadFolders();
  bindEvents();
});

// ===== Theme Logic =====
function initTheme() {
  const savedTheme = localStorage.getItem('smart-notes-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSelects.forEach(select => {
      select.value = savedTheme;
    });
  }
}

function handleThemeChange(e) {
  const newTheme = e.target.value;
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('smart-notes-theme', newTheme);
  themeSelects.forEach(select => {
    if (select !== e.target) select.value = newTheme;
  });
}

// ===== Event Bindings =====
function bindEvents() {
  // Add note
  document.getElementById('btnAddNote').addEventListener('click', openAddModal);
  document.getElementById('btnCloseAddModal').addEventListener('click', closeAddModal);
  document.getElementById('btnCancelAdd').addEventListener('click', closeAddModal);
  document.getElementById('btnSubmitNote').addEventListener('click', submitNote);

  // Detail modal
  document.getElementById('btnCloseDetailModal').addEventListener('click', closeDetailModal);

  // Sidebar Toggle
  if (btnSidebarToggle) {
    btnSidebarToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      sidebarBackdrop.classList.add('active');
    });
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeSidebar);
  }

  // Category nav
  document.querySelectorAll('.nav-item[data-category]').forEach(item => {
    item.addEventListener('click', () => {
      setActiveCategory(item.dataset.category);
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // Folder "All Folders" nav
  document.querySelector('.nav-item[data-folder="all"]').addEventListener('click', () => {
    setActiveFolder('all');
    if (window.innerWidth <= 768) closeSidebar();
  });

  // View toggle buttons
  document.getElementById('btnViewCategories').addEventListener('click', () => switchView('categories'));
  document.getElementById('btnViewFolders').addEventListener('click', () => switchView('folders'));

  // Folder filter clear
  document.getElementById('btnClearFolderFilter').addEventListener('click', () => {
    setActiveFolder('all');
  });

  // Search
  searchInput.addEventListener('input', handleSearchInput);
  document.getElementById('btnClearSearch').addEventListener('click', clearSearch);

  // Theme Select
  themeSelects.forEach(select => {
    select.addEventListener('change', handleThemeChange);
  });

  // Mobile Search Toggle
  if (btnToggleMobileSearch) {
    btnToggleMobileSearch.addEventListener('click', () => {
      searchContainer.classList.toggle('active');
      if (searchContainer.classList.contains('active')) {
        setTimeout(() => searchInput.focus(), 100);
      }
    });
  }

  // Close modals on overlay click
  addNoteModal.addEventListener('click', (e) => {
    if (e.target === addNoteModal) closeAddModal();
  });
  noteDetailModal.addEventListener('click', (e) => {
    if (e.target === noteDetailModal) closeDetailModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAddModal();
      closeDetailModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

// ===== View Toggle =====
function switchView(view) {
  activeView = view;

  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'categories') {
    categoriesView.style.display = '';
    foldersView.style.display = 'none';
    // Reset folder filter when switching to categories
    activeFolder = 'all';
    activeFilterBanner.style.display = 'none';
    loadNotes(activeCategory);
  } else {
    categoriesView.style.display = 'none';
    foldersView.style.display = '';
    // Reset category filter when switching to folders
    activeCategory = 'all';
    loadFolders();
    loadNotes();
  }
}

// ===== Folder Management =====
async function loadFolders() {
  try {
    const res = await fetch(`${API_BASE}/notes/folders`);
    const data = await res.json();

    if (data.success) {
      allFolders = data.folders;
      renderFolders(data.folders);
      updateFolderSuggestions(data.folders);
    }
  } catch (err) {
    console.error('Failed to load folders:', err);
  }
}

function renderFolders(folders) {
  const totalCount = folders.reduce((sum, f) => sum + f.count, 0);
  const countAllEl = document.getElementById('count-folder-all');
  if (countAllEl) countAllEl.textContent = totalCount;

  const folderIcons = {
    'General': '📦', 'Proofpoint': '🛡️', 'CrowdStrike': '🦅',
    'Docker': '🐳', 'Python': '🐍', 'Linux': '🐧',
    'AWS': '☁️', 'Kubernetes': '⎈', 'Git': '🔀',
    'Networking': '🌐', 'JavaScript': '🟨', 'Database': '🗄️',
    'Security': '🔒', 'DevOps': '🔄', 'API': '🔌',
    'Windows': '🪟', 'Azure': '☁️', 'Terraform': '🏗️',
  };

  foldersList.innerHTML = folders.map(f => {
    const icon = folderIcons[f.name] || '📁';
    const isActive = activeFolder === f.name;
    return `
      <div class="nav-item folder-item${isActive ? ' active' : ''}" data-folder="${escapeHtml(f.name)}" onclick="setActiveFolder('${escapeHtml(f.name).replace(/'/g, "\\'")}')">
        <span class="nav-icon">${icon}</span>
        <span>${escapeHtml(f.name)}</span>
        <span class="count-badge">${f.count}</span>
      </div>
    `;
  }).join('');
}

function updateFolderSuggestions(folders) {
  const datalist = document.getElementById('folderSuggestions');
  if (!datalist) return;
  datalist.innerHTML = folders.map(f =>
    `<option value="${escapeHtml(f.name)}">`
  ).join('');
}

function setActiveFolder(folder) {
  activeFolder = folder;

  // Update nav active states
  document.querySelectorAll('.nav-item[data-folder]').forEach(item => {
    item.classList.toggle('active', item.dataset.folder === folder);
  });
  document.querySelectorAll('#foldersList .folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset.folder === folder);
  });

  // Show/hide filter banner
  if (folder !== 'all') {
    activeFilterBanner.style.display = 'flex';
    filterBannerText.textContent = `Viewing folder: ${folder}`;
  } else {
    activeFilterBanner.style.display = 'none';
  }

  // Clear search if active
  if (searchResults.classList.contains('active')) {
    clearSearch();
    return;
  }

  loadNotesByFolder(folder);
}

async function loadNotesByFolder(folder = 'all') {
  try {
    const params = folder !== 'all' ? `?folder=${encodeURIComponent(folder)}` : '';
    const res = await fetch(`${API_BASE}/notes${params}`);
    const data = await res.json();

    if (data.success) {
      allNotes = data.notes;
      renderNotes(allNotes);
      updateStats();
    }
  } catch (err) {
    console.error('Failed to load notes:', err);
    showToast('Failed to load notes', 'error');
  }
}

// ===== API Calls =====
async function loadNotes(category = 'all') {
  try {
    let params = '';
    if (activeView === 'folders' && activeFolder !== 'all') {
      params = `?folder=${encodeURIComponent(activeFolder)}`;
    } else if (category !== 'all') {
      params = `?category=${category}`;
    }

    const res = await fetch(`${API_BASE}/notes${params}`);
    const data = await res.json();

    if (data.success) {
      allNotes = data.notes;
      renderNotes(allNotes);
      updateStats();
      updateCategoryCounts();
    }
  } catch (err) {
    console.error('Failed to load notes:', err);
    showToast('Failed to load notes', 'error');
  }
}

async function createNote(rawInput, folder) {
  showProcessing('Processing with Gemini AI...', 'Structuring your knowledge');

  try {
    const body = { rawInput };
    if (folder) body.folder = folder;

    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    hideProcessing();

    if (data.success) {
      const savedFolder = data.note.folder || 'General';
      showToast(`Knowledge added to "${savedFolder}" folder!`, 'success');
      closeAddModal();
      loadNotes(activeCategory);
      loadFolders();
    } else {
      showToast(data.error || 'Failed to process note', 'error');
    }
  } catch (err) {
    hideProcessing();
    console.error('Create note error:', err);
    showToast('Failed to create note. Check your connection.', 'error');
  }
}

async function deleteNote(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this note?')) return;

  try {
    const res = await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showToast('Note deleted', 'info');
      loadNotes(activeCategory);
      loadFolders();
    } else {
      showToast('Failed to delete note', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete note', 'error');
  }
}

async function performSearch(query) {
  searchContainer.classList.add('search-loading');

  try {
    const mode = document.querySelector('input[name="searchMode"]:checked').value;
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&mode=${mode}`);
    const data = await res.json();

    searchContainer.classList.remove('search-loading');

    if (data.success) {
      showSearchResults(data);
    } else {
      showToast('Search failed', 'error');
    }
  } catch (err) {
    searchContainer.classList.remove('search-loading');
    console.error('Search error:', err);
    showToast('Search failed. Check your connection.', 'error');
  }
}

// ===== Rendering =====
function renderNotes(notes) {
  if (notes.length === 0) {
    notesGrid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  notesGrid.innerHTML = notes.map(note => createNoteCard(note)).join('');
}

function createNoteCard(note) {
  const date = new Date(note.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const tags = (note.tags || []).slice(0, 4).map(t =>
    `<span class="tag">${escapeHtml(t)}</span>`
  ).join('');

  const summary = note.structured?.summary || 'No summary available';
  const folderBadge = note.folder ? `<span class="folder-badge">\ud83d\udcc1 ${escapeHtml(note.folder)}</span>` : '';
  const sourceLink = note.sourceUrl ? `<a class="source-link" href="${escapeHtml(note.sourceUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="${escapeHtml(note.sourceUrl)}">🔗 Source</a>` : '';

  return `
    <div class="note-card" data-category="${note.category}" data-folder="${escapeHtml(note.folder || 'General')}" onclick="openNoteDetail('${note._id}')">
      <div class="note-card-header">
        <div class="note-card-title">${escapeHtml(note.title)}</div>
        <span class="category-badge ${note.category}">${note.category}</span>
      </div>
      <div class="note-card-summary">${escapeHtml(summary)}</div>
      <div class="note-card-tags">${folderBadge}${tags}</div>
      <div class="note-card-footer">
        <span class="note-date">${date}</span>
        <div class="note-actions">
          ${sourceLink}
          <button class="btn-icon delete" onclick="deleteNote('${note._id}', event)" title="Delete">\ud83d\uddd1\ufe0f</button>
        </div>
      </div>
    </div>
  `;
}

function renderNoteDetail(note) {
  const s = note.structured || {};

  let html = `
    <div class="detail-title">${escapeHtml(note.title)}</div>
    <div class="detail-meta">
      <span class="category-badge ${note.category}">${note.category}</span>
      ${note.folder ? `<span class="folder-badge">\ud83d\udcc1 ${escapeHtml(note.folder)}</span>` : ''}
      <span class="note-date">${new Date(note.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </div>
  `;

  if (s.summary) {
    html += `<div class="detail-section"><div class="detail-section-title">Summary</div><div class="detail-text">${escapeHtml(s.summary)}</div></div>`;
  }

  if (s.commands && s.commands.length > 0) {
    html += `<div class="detail-section"><div class="detail-section-title">\u2328\ufe0f Commands</div>`;
    s.commands.forEach(cmd => {
      html += `<div class="command-block"><div class="command-syntax">${escapeHtml(cmd.syntax || '')}</div><div class="command-desc">${escapeHtml(cmd.description || '')}</div>${cmd.example ? `<div class="command-example">${escapeHtml(cmd.example)}</div>` : ''}</div>`;
    });
    html += `</div>`;
  }

  if (s.codeSnippets && s.codeSnippets.length > 0) {
    html += `<div class="detail-section"><div class="detail-section-title">\ud83d\udcbb Code Snippets</div>`;
    s.codeSnippets.forEach(snippet => {
      html += `<div class="code-block"><div class="code-lang">${escapeHtml(snippet.language || 'code')}</div><pre class="code-content">${escapeHtml(snippet.code || '')}</pre>${snippet.description ? `<div class="code-desc">${escapeHtml(snippet.description)}</div>` : ''}</div>`;
    });
    html += `</div>`;
  }

  if (s.whenToUse) {
    html += `<div class="detail-section"><div class="detail-section-title">\ud83d\udd50 When to Use</div><div class="detail-text">${escapeHtml(s.whenToUse)}</div></div>`;
  }

  if (s.howToUse) {
    html += `<div class="detail-section"><div class="detail-section-title">\ud83d\udccb How to Use</div><div class="detail-text">${escapeHtml(s.howToUse)}</div></div>`;
  }

  if (s.whyToUse) {
    html += `<div class="detail-section"><div class="detail-section-title">\ud83c\udfaf Why to Use</div><div class="detail-text">${escapeHtml(s.whyToUse)}</div></div>`;
  }

  if (s.tips && s.tips.length > 0) {
    html += `<div class="detail-section"><div class="detail-section-title">\ud83d\udca1 Tips & Best Practices</div><ul class="tips-list">${s.tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}</ul></div>`;
  }

  if (s.relatedTopics && s.relatedTopics.length > 0) {
    html += `<div class="detail-section"><div class="detail-section-title">\ud83d\udd17 Related Topics</div><div class="related-topics">${s.relatedTopics.map(t => `<span class="related-topic">${escapeHtml(t)}</span>`).join('')}</div></div>`;
  }

  if (note.tags && note.tags.length > 0) {
    html += `<div class="detail-section"><div class="detail-section-title">\ud83c\udff7\ufe0f Tags</div><div class="note-card-tags">${note.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div></div>`;
  }

  // Source URL
  if (note.sourceUrl) {
    html += `<div class="detail-section"><div class="detail-section-title">\ud83d\udd17 Source</div><div class="source-url-box"><a href="${escapeHtml(note.sourceUrl)}" target="_blank" rel="noopener" class="source-url-link">${escapeHtml(note.sourceUrl)}</a></div></div>`;
  }

  html += `<div class="detail-section"><div class="detail-section-title">\ud83d\udcc4 Original Input</div><div class="detail-text" style="opacity: 0.7; font-size: 0.82rem;">${escapeHtml(note.rawInput)}</div></div>`;

  noteDetailContent.innerHTML = html;
}

function showSearchResults(data) {
  notesGrid.style.display = 'none';
  emptyState.style.display = 'none';
  searchResults.classList.add('active');

  if (data.aiAnswer) {
    aiAnswerBox.style.display = 'block';
    aiAnswerContent.innerHTML = marked.parse(data.aiAnswer);
  } else {
    aiAnswerBox.style.display = 'none';
  }

  searchResultsTitle.textContent = `${data.totalResults} matching note${data.totalResults !== 1 ? 's' : ''}`;
  searchNotesGrid.innerHTML = data.notes.map(note => createNoteCard(note)).join('');
}

function clearSearch() {
  searchInput.value = '';
  searchResults.classList.remove('active');
  notesGrid.style.display = 'grid';
  loadNotes(activeCategory);
}

// ===== Category Management =====
function setActiveCategory(category) {
  activeCategory = category;

  document.querySelectorAll('.nav-item[data-category]').forEach(item => {
    item.classList.toggle('active', item.dataset.category === category);
  });

  if (searchResults.classList.contains('active')) {
    clearSearch();
    return;
  }

  loadNotes(category);
}

function updateCategoryCounts() {
  fetch(`${API_BASE}/notes`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) return;
      const counts = { all: data.notes.length };
      data.notes.forEach(note => {
        counts[note.category] = (counts[note.category] || 0) + 1;
      });

      Object.keys(counts).forEach(cat => {
        const el = document.getElementById(`count-${cat}`);
        if (el) el.textContent = counts[cat];
      });
    })
    .catch(() => {});
}

function updateStats() {
  document.getElementById('statTotal').textContent = allNotes.length;

  if (allNotes.length > 0) {
    const latest = new Date(allNotes[0].createdAt);
    document.getElementById('statLastAdded').textContent = latest.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
  } else {
    document.getElementById('statLastAdded').textContent = '\u2014';
  }
}

// ===== Modals =====
function openAddModal() {
  noteInput.value = '';
  if (folderInput) folderInput.value = '';
  // Pre-fill folder if filtering by a specific folder
  if (activeFolder !== 'all' && folderInput) {
    folderInput.value = activeFolder;
  }
  loadFolders(); // Refresh folder suggestions
  addNoteModal.classList.add('active');
  setTimeout(() => noteInput.focus(), 200);
}

function closeAddModal() {
  addNoteModal.classList.remove('active');
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
}

function openNoteDetail(id) {
  const note = allNotes.find(n => n._id === id);
  if (!note) {
    fetch(`${API_BASE}/notes/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          renderNoteDetail(data.note);
          noteDetailModal.classList.add('active');
        }
      })
      .catch(() => showToast('Failed to load note details', 'error'));
    return;
  }

  renderNoteDetail(note);
  noteDetailModal.classList.add('active');
}

function closeDetailModal() {
  noteDetailModal.classList.remove('active');
}

// ===== Submit Note =====
function submitNote() {
  const raw = noteInput.value.trim();
  if (!raw) {
    showToast('Please enter some knowledge text', 'error');
    return;
  }

  if (raw.length < 10) {
    showToast('Please enter at least 10 characters', 'error');
    return;
  }

  const folder = folderInput ? folderInput.value.trim() : '';
  createNote(raw, folder || null);
}

// ===== Search Handler =====
function handleSearchInput(e) {
  const query = e.target.value.trim();

  clearTimeout(searchTimeout);

  if (!query) {
    clearSearch();
    return;
  }

  searchTimeout = setTimeout(() => {
    if (query.length >= 2) {
      performSearch(query);
    }
  }, 800);
}

// ===== Processing Overlay =====
function showProcessing(text, subtext) {
  processingText.textContent = text || 'Processing...';
  processingOverlay.querySelector('.processing-subtext').textContent = subtext || '';
  processingOverlay.classList.add('active');
}

function hideProcessing() {
  processingOverlay.classList.remove('active');
}

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
  const icons = { success: '\u2705', error: '\u274c', info: '\u2139\ufe0f' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '\u2139\ufe0f'}</span><span>${escapeHtml(message)}</span>`;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== Utilities =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
