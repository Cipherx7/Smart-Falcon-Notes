// ===== Falcon Smart Notes — Frontend App =====

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
const toastContainer = document.getElementById('toastContainer');
const searchContainer = document.getElementById('searchContainer');
const themeSelects = document.querySelectorAll('.theme-select');
const btnToggleMobileSearch = document.getElementById('btnToggleMobileSearch');
const btnSidebarToggle = document.getElementById('btnSidebarToggle');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

// State
let allNotes = [];
let activeCategory = 'all';
let searchTimeout = null;

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadNotes();
  bindEvents();
});

// ===== Theme Logic =====
function initTheme() {
  const savedTheme = localStorage.getItem('falcon-theme');
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
  localStorage.setItem('falcon-theme', newTheme);
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
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
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
    // Ctrl+K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

// ===== API Calls =====
async function loadNotes(category = 'all') {
  try {
    const params = category !== 'all' ? `?category=${category}` : '';
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

async function createNote(rawInput) {
  showProcessing('Processing with Gemini AI...', 'Structuring your knowledge');

  try {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput })
    });

    const data = await res.json();
    hideProcessing();

    if (data.success) {
      showToast('Knowledge added successfully!', 'success');
      closeAddModal();
      loadNotes(activeCategory);
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

  return `
    <div class="note-card" data-category="${note.category}" onclick="openNoteDetail('${note._id}')">
      <div class="note-card-header">
        <div class="note-card-title">${escapeHtml(note.title)}</div>
        <span class="category-badge ${note.category}">${note.category}</span>
      </div>
      <div class="note-card-summary">${escapeHtml(summary)}</div>
      <div class="note-card-tags">${tags}</div>
      <div class="note-card-footer">
        <span class="note-date">${date}</span>
        <div class="note-actions">
          <button class="btn-icon delete" onclick="deleteNote('${note._id}', event)" title="Delete">🗑️</button>
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
      <span class="note-date">${new Date(note.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </div>
  `;

  // Summary
  if (s.summary) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">Summary</div>
        <div class="detail-text">${escapeHtml(s.summary)}</div>
      </div>
    `;
  }

  // Commands
  if (s.commands && s.commands.length > 0) {
    html += `<div class="detail-section"><div class="detail-section-title">⌨️ Commands</div>`;
    s.commands.forEach(cmd => {
      html += `
        <div class="command-block">
          <div class="command-syntax">${escapeHtml(cmd.syntax || '')}</div>
          <div class="command-desc">${escapeHtml(cmd.description || '')}</div>
          ${cmd.example ? `<div class="command-example">${escapeHtml(cmd.example)}</div>` : ''}
        </div>
      `;
    });
    html += `</div>`;
  }

  // Code Snippets
  if (s.codeSnippets && s.codeSnippets.length > 0) {
    html += `<div class="detail-section"><div class="detail-section-title">💻 Code Snippets</div>`;
    s.codeSnippets.forEach(snippet => {
      html += `
        <div class="code-block">
          <div class="code-lang">${escapeHtml(snippet.language || 'code')}</div>
          <pre class="code-content">${escapeHtml(snippet.code || '')}</pre>
          ${snippet.description ? `<div class="code-desc">${escapeHtml(snippet.description)}</div>` : ''}
        </div>
      `;
    });
    html += `</div>`;
  }

  // When to Use
  if (s.whenToUse) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">🕐 When to Use</div>
        <div class="detail-text">${escapeHtml(s.whenToUse)}</div>
      </div>
    `;
  }

  // How to Use
  if (s.howToUse) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">📋 How to Use</div>
        <div class="detail-text">${escapeHtml(s.howToUse)}</div>
      </div>
    `;
  }

  // Why to Use
  if (s.whyToUse) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">🎯 Why to Use</div>
        <div class="detail-text">${escapeHtml(s.whyToUse)}</div>
      </div>
    `;
  }

  // Tips
  if (s.tips && s.tips.length > 0) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">💡 Tips & Best Practices</div>
        <ul class="tips-list">
          ${s.tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Related Topics
  if (s.relatedTopics && s.relatedTopics.length > 0) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">🔗 Related Topics</div>
        <div class="related-topics">
          ${s.relatedTopics.map(t => `<span class="related-topic">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // Tags
  if (note.tags && note.tags.length > 0) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">🏷️ Tags</div>
        <div class="note-card-tags">
          ${note.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // Raw Input
  html += `
    <div class="detail-section">
      <div class="detail-section-title">📄 Original Input</div>
      <div class="detail-text" style="opacity: 0.7; font-size: 0.82rem;">${escapeHtml(note.rawInput)}</div>
    </div>
  `;

  noteDetailContent.innerHTML = html;
}

function showSearchResults(data) {
  notesGrid.style.display = 'none';
  emptyState.style.display = 'none';
  searchResults.classList.add('active');

  // AI Answer
  if (data.aiAnswer) {
    aiAnswerBox.style.display = 'block';
    aiAnswerContent.innerHTML = marked.parse(data.aiAnswer);
  } else {
    aiAnswerBox.style.display = 'none';
  }

  // Matching notes
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

  // Update nav active state
  document.querySelectorAll('.nav-item[data-category]').forEach(item => {
    item.classList.toggle('active', item.dataset.category === category);
  });

  // Clear search if active
  if (searchResults.classList.contains('active')) {
    clearSearch();
    return;
  }

  loadNotes(category);
}

function updateCategoryCounts() {
  // Fetch all notes to count categories
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
    document.getElementById('statLastAdded').textContent = '—';
  }
}

// ===== Modals =====
function openAddModal() {
  noteInput.value = '';
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
    // Try fetching from API if not in current list (e.g. from search results)
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

  createNote(raw);
}

// ===== Search Handler =====
function handleSearchInput(e) {
  const query = e.target.value.trim();

  clearTimeout(searchTimeout);

  if (!query) {
    clearSearch();
    return;
  }

  // Debounce 800ms
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
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;

  toastContainer.appendChild(toast);

  // Auto remove after 4 seconds
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
