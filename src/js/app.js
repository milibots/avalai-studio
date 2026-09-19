// Main Frontend Application Coordinator for AvalAI Studio
import { store } from './store.js';
import { Database } from './db.js';
import { formatIRT, formatUSD, maskKey } from './utils/formatters.js';

// Views
import { KeysView } from './views/keys.js';
import { AuditView } from './views/audit.js';
import { ModelsView } from './views/models.js';
import { ChatView } from './views/chat.js';
import { ImagesView } from './views/images.js';
import { AudioView } from './views/audio.js';
import { SearchView } from './views/search.js';
import { EmbeddingsView } from './views/embeddings.js';
import { TransactionsView } from './views/transactions.js';

class App {
  constructor() {
    this.currentView = 'keys';
    this.views = {};
  }

  async init() {
    await store.init();

    // Setup Toasts
    this.toastContainer = document.getElementById('toast-container');

    // Setup Header & Navigation
    this.setupHeader();
    this.setupNavigation();

    // Initialize all views
    this.views.keys = KeysView;
    this.views.audit = AuditView;
    this.views.models = ModelsView;
    this.views.chat = ChatView;
    this.views.images = ImagesView;
    this.views.audio = AudioView;
    this.views.search = SearchView;
    this.views.embeddings = EmbeddingsView;
    this.views.transactions = TransactionsView;

    this.views.keys.init(document.getElementById('view-keys'), (msg, type) => this.showToast(msg, type));
    this.views.audit.init(document.getElementById('view-audit'), (msg, type) => this.showToast(msg, type));
    this.views.models.init(
      document.getElementById('view-models'),
      (msg, type) => this.showToast(msg, type),
      (modelId) => {
        this.views.chat.setModel(modelId);
        this.switchView('chat');
      }
    );
    this.views.chat.init(document.getElementById('view-chat'), (msg, type) => this.showToast(msg, type));
    this.views.images.init(document.getElementById('view-images'), (msg, type) => this.showToast(msg, type));
    this.views.audio.init(document.getElementById('view-audio'), (msg, type) => this.showToast(msg, type));
    this.views.search.init(document.getElementById('view-search'), (msg, type) => this.showToast(msg, type));
    this.views.embeddings.init(document.getElementById('view-embeddings'), (msg, type) => this.showToast(msg, type));
    this.views.transactions.init(document.getElementById('view-transactions'), (msg, type) => this.showToast(msg, type));

    // Listen to store updates to keep header synced
    store.subscribe(() => {
      this.updateHeaderKeyPill();
    });

    // Initial ping
    this.checkConnection();
    setInterval(() => this.checkConnection(), 30000);
  }

  setupHeader() {
    this.updateHeaderKeyPill();

    // Click on active key pill in header switches to Keys tab
    const keyPill = document.getElementById('header-active-key-pill');
    keyPill?.addEventListener('click', () => {
      this.switchView('keys');
    });

    // Theme Switcher Button
    const themeBtn = document.getElementById('header-btn-theme');
    const updateThemeIcon = () => {
      const theme = store.getTheme();
      if (themeBtn) themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
    };
    updateThemeIcon();
    themeBtn?.addEventListener('click', async () => {
      const newTheme = await store.toggleTheme();
      updateThemeIcon();
      this.showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
    });

    // SQLite DB Export Button
    const dbBtn = document.getElementById('header-btn-export-db');
    dbBtn?.addEventListener('click', async () => {
      const res = await Database.exportDatabase();
      if (res?.success) {
        this.showToast(`SQLite Database exported (${Math.round(res.size / 1024)} KB)`, 'success');
      } else {
        this.showToast('Could not export database', 'error');
      }
    });

    // SQLite DB Open Folder Button
    const folderBtn = document.getElementById('header-btn-show-db-folder');
    folderBtn?.addEventListener('click', async () => {
      const res = await Database.showInFolder();
      if (res?.success) {
        this.showToast(`Opened SQLite vault folder`, 'info');
      } else {
        this.showToast('Could not open folder', 'error');
      }
    });

    // Quick add key button in header
    const quickAddBtn = document.getElementById('header-btn-add-key');
    quickAddBtn?.addEventListener('click', () => {
      this.switchView('keys');
      const openBtn = document.getElementById('btn-open-add-key') || document.getElementById('btn-empty-add-key');
      openBtn?.click();
    });
  }

  updateHeaderKeyPill() {
    const activeKey = store.getActiveKey();
    const labelEl = document.getElementById('header-key-label');
    const tierEl = document.getElementById('header-key-tier');
    const balEl = document.getElementById('header-key-balance');

    if (!activeKey) {
      if (labelEl) labelEl.textContent = 'No Active Key';
      if (tierEl) tierEl.textContent = 'Tier ?';
      if (balEl) balEl.textContent = '0 IRT';
      return;
    }

    if (labelEl) labelEl.textContent = activeKey.label;
    if (tierEl) tierEl.textContent = activeKey.tier !== null ? `Tier ${activeKey.tier}` : 'Tier ?';
    if (balEl) {
      balEl.textContent = activeKey.balance_irt !== null ? formatIRT(activeKey.balance_irt) : 'Unchecked';
    }
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        if (targetView) {
          this.switchView(targetView);
        }
      });
    });
  }

  switchView(viewName) {
    if (!this.views[viewName]) return;

    this.currentView = viewName;

    // Update sidebar nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    // Update view containers
    document.querySelectorAll('.view-container').forEach(container => {
      const isTarget = container.id === `view-${viewName}`;
      container.classList.toggle('active', isTarget);
      if (isTarget && this.views[viewName]?.render) {
        this.views[viewName].render();
      }
    });
  }

  async checkConnection() {
    const statusDot = document.getElementById('header-status-dot');
    const statusText = document.getElementById('header-status-text');

    try {
      const res = await window.avalai.pingDomain();
      if (res.ok) {
        statusDot?.setAttribute('class', 'status-dot');
        if (statusText) statusText.textContent = `Online (${res.latencyMs}ms)`;
      } else {
        statusDot?.setAttribute('class', 'status-dot error');
        if (statusText) statusText.textContent = 'Degraded / Error';
      }
    } catch {
      statusDot?.setAttribute('class', 'status-dot error');
      if (statusText) statusText.textContent = 'Offline';
    }
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span style="flex: 1;">${message}</span>`;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
