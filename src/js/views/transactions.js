// Transactions History & Request Cost Lookup View
import { store } from '../store.js';
import { AvalAIApi } from '../api.js';
import { Icons } from '../utils/icons.js';
import { formatIRT, formatUSD, formatTokens, formatDate } from '../utils/formatters.js';

export const TransactionsView = {
  init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.transactions = [];
    this.summary = null;
    this.lookupResult = null;
    this.isLoading = false;
    this.render();
    // Auto-fetch if active key present
    this.fetchTransactions();
  },

  render() {
    const activeKey = store.getActiveKey();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-header-title-block">
          <h1>Transactions & Precise Cost Inspector</h1>
          <p>Monitor API usage, token consumption, and look up 100% exact costs by avalai-request-id within 30 seconds.</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-refresh-tx">
            ${Icons.refresh(14)} Refresh History
          </button>
        </div>
      </div>

      <!-- Request ID Lookup Bar (Strictly flat macOS styling, zero gradients) -->
      <div class="card" style="border: 1px solid var(--border-subtle); background: var(--bg-surface);">
        <div class="card-header">
          <div class="card-title">
            ${Icons.search(18)}
            <span>Lookup Exact Request Cost by avalai-request-id</span>
          </div>
          <span class="badge badge-cyan">POST /user/v1/transactions/lookup</span>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <input type="text" class="form-input" id="input-lookup-id" placeholder="Paste avalai-request-id UUID (e.g. 01a009d5-ec91-74c2-8ffa-9eba731dfc9e)..." style="flex: 1; font-family: var(--font-mono); font-size: 13px;" />
          <button class="btn btn-primary" id="btn-run-lookup" ${!activeKey ? 'disabled' : ''}>
            ${Icons.search(14)} Lookup Cost
          </button>
        </div>

        ${this.lookupResult ? `
          <div style="margin-top: 16px; background: var(--bg-surface); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 8px;">
              Request Found: ${this.lookupResult.id}
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 12px;">
              <div>Model: <strong style="color: #fff;">${this.lookupResult.model}</strong> (${this.lookupResult.provider})</div>
              <div>Status: <strong style="color: var(--accent-emerald);">HTTP ${this.lookupResult.status_code}</strong></div>
              <div>USD Cost: <strong style="color: var(--accent-emerald); font-family: var(--font-mono);">${formatUSD(this.lookupResult.cost?.unit)}</strong></div>
              <div>IRT Deducted: <strong style="color: var(--accent-cyan); font-family: var(--font-mono);">${formatIRT(this.lookupResult.cost?.paid_irt)}</strong></div>
              <div>Grant/Package Covered: <strong style="color: var(--accent-amber);">${formatIRT(this.lookupResult.cost?.paid_grant_irt)}</strong></div>
              <div>Source: <span class="badge badge-primary">${this.lookupResult.cost?.source || 'balance'}</span></div>
              <div>Total Tokens: <strong>${formatTokens(this.lookupResult.tokens?.total)}</strong> (Prompt: ${this.lookupResult.tokens?.prompt}, Completion: ${this.lookupResult.tokens?.completion})</div>
              <div>Key Suffix: <strong style="font-family: var(--font-mono);">${this.lookupResult.api_key_suffix || 'N/A'}</strong></div>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Aggregated Summary Cards -->
      ${this.summary ? `
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">24h Total Requests</span>
            <div class="metric-value">${this.summary.totals?.transactions || 0}</div>
            <span class="metric-subtext">Last 24 hours of API calls</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">24h Total Tokens</span>
            <div class="metric-value" style="color: var(--accent-cyan);">
              ${formatTokens(this.summary.totals?.tokens?.total || 0)}
            </div>
            <span class="metric-subtext">Prompt + Completion</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">24h Cost (USD)</span>
            <div class="metric-value" style="color: var(--accent-emerald);">
              ${formatUSD(this.summary.totals?.cost?.unit || 0)}
            </div>
            <span class="metric-subtext">Total consumed in units</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">24h Cost (IRT)</span>
            <div class="metric-value" style="color: var(--accent-amber);">
              ${formatIRT(this.summary.totals?.cost?.paid_irt || 0)}
            </div>
            <span class="metric-subtext">Wallet deductions</span>
          </div>
        </div>
      ` : ''}

      <!-- Transactions List Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${Icons.fileText(18)}
            <span>Recent API Requests Log</span>
          </div>
          <span class="badge badge-muted">${this.transactions.length} records</span>
        </div>

        ${this.isLoading ? `
          <div class="table-container">
            <table class="data-table">
              <tbody>
                ${[1, 2, 3, 4, 5].map(() => `
                  <tr>
                    <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
                    <td>
                      <div class="skeleton skeleton-text" style="width: 130px; height: 16px;"></div>
                      <div class="skeleton skeleton-text" style="width: 60px; height: 10px; margin-top: 4px;"></div>
                    </td>
                    <td><div class="skeleton" style="width: 40px; height: 20px; border-radius: 9999px;"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 50px;"></div></td>
                    <td><div class="skeleton" style="width: 45px; height: 18px; border-radius: 9999px;"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
                    <td><div class="skeleton" style="width: 70px; height: 26px; border-radius: 6px;"></div></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : this.transactions.length === 0 ? `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            No recent transactions recorded for this key in the past 24 hours.
          </div>
        ` : `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Model / Provider</th>
                  <th>Status</th>
                  <th>Tokens</th>
                  <th>Stream</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${this.transactions.map(tx => `
                  <tr>
                    <td style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-cyan);">
                      ${tx.id ? tx.id.slice(0, 13) + '...' : 'N/A'}
                    </td>
                    <td>
                      <strong style="color: var(--text-primary);">${tx.model}</strong>
                      <span style="font-size: 11px; color: var(--text-muted); display: block;">${tx.provider}</span>
                    </td>
                    <td>
                      <span class="badge ${tx.status_code === 200 ? 'badge-emerald' : 'badge-rose'}">
                        ${tx.status_code}
                      </span>
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 12px;">
                      <span>${tx.tokens?.total || 0}</span>
                      <span style="font-size: 10px; color: var(--text-muted); display: block;">
                        P: ${tx.tokens?.prompt || 0} / C: ${tx.tokens?.completion || 0}
                      </span>
                    </td>
                    <td>
                      <span class="badge badge-muted">${tx.stream ? 'SSE' : 'Sync'}</span>
                    </td>
                    <td style="font-size: 11px; color: var(--text-muted);">
                      ${formatDate(tx.requested_at || tx.created_at)}
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-sm btn-inspect-tx" data-id="${tx.id}">
                        Inspect Cost
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    this.container.querySelector('#btn-refresh-tx')?.addEventListener('click', () => {
      this.fetchTransactions();
    });

    this.container.querySelector('#btn-run-lookup')?.addEventListener('click', () => {
      const id = this.container.querySelector('#input-lookup-id')?.value.trim();
      if (id) this.lookupId(id);
    });

    this.container.querySelectorAll('.btn-inspect-tx').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) {
          const inp = this.container.querySelector('#input-lookup-id');
          if (inp) inp.value = id;
          this.lookupId(id);
        }
      });
    });
  },

  async fetchTransactions() {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    this.isLoading = true;
    this.render();

    try {
      // Fetch recent transactions
      const txRes = await AvalAIApi.getTransactions(activeKey.key, { hours_ago: 24, page_size: 50 });
      if (txRes.success && txRes.data) {
        this.transactions = txRes.data.transactions || [];
      }

      // Fetch 24h summary
      const sumRes = await AvalAIApi.getTransactionsSummary(activeKey.key, { hours_ago: 24 });
      if (sumRes.success && sumRes.data) {
        this.summary = sumRes.data;
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      this.isLoading = false;
      this.render();
    }
  },

  async lookupId(requestId) {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    this.showToast(`Looking up cost for ${requestId.slice(0, 8)}...`, 'info');

    try {
      const res = await AvalAIApi.lookupTransactions(activeKey.key, [requestId]);
      if (res.success && res.data?.transactions?.length > 0) {
        this.lookupResult = res.data.transactions[0];
        this.render();
        this.showToast('Exact transaction cost resolved!', 'success');
      } else {
        this.lookupResult = null;
        this.showToast('Transaction record not ready or not found yet (records take up to 30s after completion).', 'error');
        this.render();
      }
    } catch (err) {
      this.showToast(`Lookup error: ${err.message}`, 'error');
    }
  }
};
