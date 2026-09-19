// Keys Management View
import { store } from '../store.js';
import { AvalAIApi } from '../api.js';
import { formatIRT, formatUSD, formatDate, maskKey } from '../utils/formatters.js';
import { Icons } from '../utils/icons.js';

export const KeysView = {
  init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.render();
    store.subscribe(() => this.render());
  },

  render() {
    const keys = store.getKeys();
    const activeKey = store.getActiveKey();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-header-title-block">
          <h1>API Key Vault & Multi-Key Manager</h1>
          <p>Securely store, organize, and monitor multiple AvalAI API keys with automatic tier & credit sync.</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-bulk-audit">
            ${Icons.audit()} Audit All Keys
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-export-keys">
            ${Icons.download()} Export
          </button>
          <button class="btn btn-primary" id="btn-open-add-key">
            ${Icons.plus()} Add AvalAI Key
          </button>
        </div>
      </div>

      ${this.isAuditingAll ? `
        <div class="keys-grid">
          ${this.renderSkeletonCards()}
        </div>
      ` : keys.length === 0 ? `
        <div class="card" style="text-align: center; padding: 60px 20px;">
          <img src="assets/avalai-logo.png" alt="AvalAI" style="width: 68px; height: 68px; margin-bottom: 16px; filter: drop-shadow(0 0 16px rgba(14, 165, 233, 0.35));" />
          <h3 style="font-size: 18px; margin-bottom: 8px;">No AvalAI API Keys Added Yet</h3>
          <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 20px;">
            Add your AvalAI API keys to start testing models, checking credits, chatting, and managing multiple accounts or customer keys.
          </p>
          <button class="btn btn-primary btn-lg" id="btn-empty-add-key" style="margin: 0 auto;">
            Add Your First Key
          </button>
        </div>
      ` : `
        <div class="keys-grid">
          ${keys.map(k => this.renderKeyCard(k, activeKey?.id === k.id)).join('')}
        </div>
      `}

      <!-- Add Key Modal -->
      <div class="modal-overlay" id="modal-add-key">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Add AvalAI API Key</h3>
            <button class="btn btn-secondary btn-sm btn-icon-only modal-close">&times;</button>
          </div>
          <form id="form-add-key">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Key Label / Name</label>
                <input type="text" class="form-input" id="input-key-label" placeholder="e.g. Production Key, Customer A, Dev Test" required />
              </div>
              <div class="form-group">
                <label class="form-label">AvalAI API Key (sk-...)</label>
                <input type="password" class="form-input" id="input-key-val" placeholder="Paste your AvalAI API key here" required />
                <span style="font-size: 11px; color: var(--text-muted);">Keys are stored safely on your local machine and never transmitted to third parties.</span>
              </div>
              <div class="form-group">
                <label class="form-label">Notes / Tags (Optional)</label>
                <input type="text" class="form-input" id="input-key-notes" placeholder="e.g. High tier, OpenAI package enabled" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary modal-close">Cancel</button>
              <button type="submit" class="btn btn-primary">Save & Validate Key</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderKeyCard(key, isActive) {
    const statusColor = key.status === 'valid' ? 'badge-emerald' :
                        key.status === 'invalid' ? 'badge-rose' : 'badge-muted';
    const statusText = key.status === 'valid' ? 'Valid' :
                       key.status === 'invalid' ? 'Invalid / Suspended' : 'Untested';

    return `
      <div class="key-card ${isActive ? 'active-key' : ''}" data-key-id="${key.id}">
        <div class="key-card-header">
          <div class="key-card-title-group">
            <span class="key-card-name">${key.label}</span>
            ${isActive ? '<span class="badge badge-primary">ACTIVE</span>' : ''}
          </div>
          <span class="badge ${statusColor}">${statusText}</span>
        </div>

        <div class="key-card-key-display">
          <span>${maskKey(key.key)}</span>
          <button class="btn btn-secondary btn-sm btn-icon-only btn-copy-key" title="Copy Key" data-raw-key="${key.key}">
            ${Icons.copy('svg-icon', 14)}
          </button>
        </div>

        <div class="key-card-stats">
          <div class="key-card-stat-item">
            <span class="key-card-stat-label">Account Tier</span>
            <span class="key-card-stat-val">
              ${key.tier !== null ? `Tier ${key.tier}` : '<span style="color: var(--text-muted)">Unknown</span>'}
            </span>
          </div>
          <div class="key-card-stat-item">
            <span class="key-card-stat-label">Remaining Credit</span>
            <span class="key-card-stat-val" style="color: var(--accent-emerald);">
              ${key.balance_irt !== null ? formatIRT(key.balance_irt) : '<span style="color: var(--text-muted)">Unchecked</span>'}
            </span>
          </div>
          <div class="key-card-stat-item">
            <span class="key-card-stat-label">USD Value</span>
            <span class="key-card-stat-val">
              ${key.balance_usd !== null ? formatUSD(key.balance_usd) : '--'}
            </span>
          </div>
          <div class="key-card-stat-item">
            <span class="key-card-stat-label">Active Packages</span>
            <span class="key-card-stat-val">
              ${key.packages && key.packages.length > 0 ? `${key.packages.length} Active` : 'None'}
            </span>
          </div>
        </div>

        <div class="key-card-actions">
          <div style="display: flex; gap: 8px;">
            ${!isActive ? `<button class="btn btn-secondary btn-sm btn-set-active" data-id="${key.id}">Set Active</button>` : ''}
            <button class="btn btn-secondary btn-sm btn-audit-key" data-id="${key.id}">
              ${Icons.audit('svg-icon', 14)} Audit
            </button>
          </div>
          <button class="btn btn-danger btn-sm btn-delete-key" data-id="${key.id}">
            ${Icons.trash('svg-icon', 14)} Delete
          </button>
        </div>
      </div>
    `;
  },

  bindEvents() {
    // Add Key Modals
    const modal = this.container.querySelector('#modal-add-key');
    const openBtn = this.container.querySelector('#btn-open-add-key');
    const emptyAddBtn = this.container.querySelector('#btn-empty-add-key');
    const closeBtns = this.container.querySelectorAll('.modal-close');

    const openModal = () => modal?.classList.add('active');
    const closeModal = () => modal?.classList.remove('active');

    openBtn?.addEventListener('click', openModal);
    emptyAddBtn?.addEventListener('click', openModal);
    closeBtns.forEach(b => b.addEventListener('click', closeModal));

    // Form Submit
    const form = this.container.querySelector('#form-add-key');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = this.container.querySelector('#input-key-label').value;
      const keyVal = this.container.querySelector('#input-key-val').value;
      const notes = this.container.querySelector('#input-key-notes').value;

      try {
        const newKey = await store.addKey({ label, key: keyVal, notes });
        closeModal();
        this.showToast(`Key "${label}" saved to vault!`, 'success');

        // Automatically validate key
        this.auditSingleKey(newKey.id, false);
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // Copy Key buttons
    this.container.querySelectorAll('.btn-copy-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const raw = btn.getAttribute('data-raw-key');
        navigator.clipboard.writeText(raw);
        this.showToast('API Key copied to clipboard!', 'info');
      });
    });

    // Set Active Key
    this.container.querySelectorAll('.btn-set-active').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        await store.setActiveKeyId(id);
        this.showToast('Active key switched!', 'success');
      });
    });

    // Delete Key
    this.container.querySelectorAll('.btn-delete-key').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to remove this API key from the vault?')) {
          await store.deleteKey(id);
          this.showToast('Key deleted', 'info');
        }
      });
    });

    // Audit single key button
    this.container.querySelectorAll('.btn-audit-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        this.auditSingleKey(id, true);
      });
    });

    // Bulk Audit button
    this.container.querySelector('#btn-bulk-audit')?.addEventListener('click', () => {
      this.bulkAudit();
    });

    // Export keys
    this.container.querySelector('#btn-export-keys')?.addEventListener('click', () => {
      const keys = store.getKeys();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(keys, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `avalai_keys_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Keys backup downloaded', 'success');
    });
  },

  async auditSingleKey(keyId, showNotif = true) {
    const key = store.getKeys().find(k => k.id === keyId);
    if (!key) return;

    if (showNotif) this.showToast(`Auditing key "${key.label}"...`, 'info');

    try {
      const res = await AvalAIApi.getCredit(key.key);
      if (res.success && res.data) {
        const c = res.data;
        await store.updateKey(keyId, {
          tier: c.account_tier,
          balance_irt: c.remaining_irt,
          balance_usd: c.remaining_unit || c.total_unit,
          exchange_rate: c.exchange_rate,
          packages: c.credit_sources?.packages || [],
          grants: c.credit_sources?.grants || [],
          status: 'valid',
          lastTested: new Date().toISOString()
        });
        if (showNotif) this.showToast(`Key "${key.label}" verified: Tier ${c.account_tier}, ${formatIRT(c.remaining_irt)} remaining`, 'success');
      } else {
        const isAuthErr = res.status === 401 || res.status === 403;
        await store.updateKey(keyId, {
          status: isAuthErr ? 'invalid' : 'error',
          lastTested: new Date().toISOString()
        });
        if (showNotif) this.showToast(`Audit failed for "${key.label}": HTTP ${res.status} (${res.data?.message || res.statusText})`, 'error');
      }
    } catch (err) {
      await store.updateKey(keyId, { status: 'error', lastTested: new Date().toISOString() });
      if (showNotif) this.showToast(`Audit error: ${err.message}`, 'error');
    }
  },

  async bulkAudit() {
    const keys = store.getKeys();
    if (!keys.length) return;
    this.isAuditingAll = true;
    this.render();
    this.showToast(`Starting audit for ${keys.length} keys...`, 'info');

    try {
      for (const key of keys) {
        await this.auditSingleKey(key.id, false);
      }
      this.showToast('All keys audit completed!', 'success');
    } finally {
      this.isAuditingAll = false;
      this.render();
    }
  },

  renderSkeletonCards() {
    return [1, 2, 3].map(() => `
      <div class="key-card">
        <div class="key-card-header">
          <div class="skeleton skeleton-title" style="width: 140px;"></div>
          <div class="skeleton" style="width: 60px; height: 20px; border-radius: 9999px;"></div>
        </div>
        <div class="skeleton skeleton-text" style="height: 32px; margin: 4px 0;"></div>
        <div class="key-card-stats">
          <div class="key-card-stat-item">
            <div class="skeleton skeleton-text" style="width: 50%; height: 10px;"></div>
            <div class="skeleton skeleton-text" style="width: 80%; height: 16px; margin-top: 4px;"></div>
          </div>
          <div class="key-card-stat-item">
            <div class="skeleton skeleton-text" style="width: 50%; height: 10px;"></div>
            <div class="skeleton skeleton-text" style="width: 80%; height: 16px; margin-top: 4px;"></div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
          <div class="skeleton" style="width: 80px; height: 28px; border-radius: 6px;"></div>
          <div class="skeleton" style="width: 80px; height: 28px; border-radius: 6px;"></div>
        </div>
      </div>
    `).join('');
  }
};
