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

import { Icons } from './utils/icons.js';

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

    // App Version setup
    try {
      if (window.avalai?.updater?.getVersion) {
        const v = await window.avalai.updater.getVersion();
        const versionEl = document.getElementById('sidebar-app-version');
        if (versionEl) versionEl.textContent = `v${v}`;
      }
    } catch (e) {
      console.error('Failed to get app version:', e);
    }

    // Automatic GitHub update check after 3 seconds
    setTimeout(() => {
      this.checkForUpdates(true);
    }, 3000);
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
      const themeIconSpan = document.getElementById('header-theme-icon') || themeBtn;
      if (themeIconSpan) {
        themeIconSpan.innerHTML = theme === 'dark' ? Icons.moon('svg-icon', 15) : Icons.sun('svg-icon', 15);
      }
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

    // Check Updates Button in Header
    const updateBtn = document.getElementById('header-btn-check-updates');
    updateBtn?.addEventListener('click', () => {
      this.checkForUpdates(false);
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

    const icon = type === 'success' ? Icons.check('svg-icon', 15) : type === 'error' ? Icons.close('svg-icon', 15) : Icons.audit('svg-icon', 15);
    toast.innerHTML = `<span style="display: flex; align-items: center;">${icon}</span><span style="flex: 1;">${message}</span>`;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  async checkForUpdates(isSilent = false) {
    const updateBtn = document.getElementById('header-btn-check-updates');
    const updateIcon = updateBtn?.querySelector('.svg-icon');
    if (updateIcon) updateIcon.classList.add('spin');

    if (!isSilent) {
      this.showToast('Checking GitHub repository for updates...', 'info');
    }

    try {
      if (!window.avalai?.updater?.check) return;
      const info = await window.avalai.updater.check();
      if (updateIcon) updateIcon.classList.remove('spin');

      if (!info.success) {
        if (!isSilent) {
          this.showToast(`Update check: ${info.error || 'Connection error'}`, 'error');
        }
        return;
      }

      if (info.hasUpdate) {
        this.showUpdateModal(info);
      } else {
        if (!isSilent) {
          this.showToast(`AvalAI Studio is up to date (v${info.currentVersion})`, 'success');
        }
      }
    } catch (err) {
      if (updateIcon) updateIcon.classList.remove('spin');
      if (!isSilent) {
        this.showToast(`Update check error: ${err.message}`, 'error');
      }
    }
  }

  showUpdateModal(info) {
    const root = document.getElementById('update-modal-root');
    if (!root) return;

    const sizeText = info.assetSize ? ` (${(info.assetSize / (1024 * 1024)).toFixed(1)} MB)` : '';

    root.innerHTML = `
      <div class="modal-backdrop" style="display: flex; align-items: center; justify-content: center;">
        <div class="modal" style="max-width: 520px; width: 90%;">
          <div class="modal-header">
            <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              ${Icons.cloudDownload('svg-icon', 20)}
              <span>New Update Available</span>
            </div>
            <button class="btn btn-secondary btn-sm btn-icon-only" id="modal-btn-close-update">
              ${Icons.close('svg-icon', 14)}
            </button>
          </div>

          <div class="modal-body">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 18px; font-weight: 800; color: var(--text-primary);">${info.name || 'AvalAI Studio ' + info.tagName}</span>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  Published: ${info.publishedAt ? new Date(info.publishedAt).toLocaleDateString() : 'Recently'}
                </div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span class="badge badge-primary" style="font-family: var(--font-mono);">v${info.latestVersion}</span>
                <span class="badge badge-muted" style="font-family: var(--font-mono); font-size: 10px;">Current: v${info.currentVersion}</span>
              </div>
            </div>

            ${info.assetName ? `
              <div style="background: var(--bg-surface-hover); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 14px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-primary); font-family: var(--font-mono); font-size: 11px;">${info.assetName}</span>
                <span style="color: var(--text-muted); font-size: 11px;">${sizeText}</span>
              </div>
            ` : ''}

            ${info.notes ? `
              <div>
                <label class="form-label" style="margin-bottom: 6px;">Release Changelog</label>
                <div class="update-changelog-box">${info.notes}</div>
              </div>
            ` : ''}
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" id="modal-btn-dismiss-update">Later</button>
            <button class="btn btn-secondary" id="modal-btn-view-github">
              View on GitHub
            </button>
            <button class="btn btn-primary" id="modal-btn-download-update">
              ${Icons.download('svg-icon', 14)}
              Download Update
            </button>
          </div>
        </div>
      </div>
    `;

    // Handlers
    const closeModal = () => { root.innerHTML = ''; };
    root.querySelector('#modal-btn-close-update')?.addEventListener('click', closeModal);
    root.querySelector('#modal-btn-dismiss-update')?.addEventListener('click', closeModal);

    root.querySelector('#modal-btn-view-github')?.addEventListener('click', () => {
      if (info.htmlUrl) window.avalai.openExternal(info.htmlUrl);
    });

    root.querySelector('#modal-btn-download-update')?.addEventListener('click', () => {
      if (info.downloadUrl) {
        window.avalai.openExternal(info.downloadUrl);
        this.showToast('Opening update download in your browser...', 'info');
      }
      closeModal();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
