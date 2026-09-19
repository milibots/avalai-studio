// Diagnostic Audit & Account Health View
import { store } from '../store.js';
import { AvalAIApi } from '../api.js';
import { formatIRT, formatUSD, formatDate, maskKey } from '../utils/formatters.js';

export const AuditView = {
  init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.auditData = null;
    this.lastHeaders = null;
    this.latency = null;
    this.render();
    store.subscribe(() => this.render());
  },

  render() {
    const activeKey = store.getActiveKey();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-header-title-block">
          <h1>Comprehensive Key Diagnostics & Account Audit</h1>
          <p>Inspect account tier, live credit, rate limits, credit packages, and response headers in real time.</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-primary" id="btn-run-audit" ${!activeKey ? 'disabled' : ''}>
            🔄 Run Full Diagnostic Test
          </button>
        </div>
      </div>

      ${!activeKey ? `
        <div class="card" style="text-align: center; padding: 40px;">
          <p style="color: var(--text-secondary);">Please add or select an active key in the API Keys tab first.</p>
        </div>
      ` : this.isAuditing ? this.renderSkeletonAudit() : `
        <div class="audit-container">
          <!-- Status Banner -->
          <div class="audit-status-banner">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <h2 style="font-size: 20px; font-weight: 700;">Auditing: ${activeKey.label}</h2>
                <span class="badge badge-primary">Active Key</span>
              </div>
              <p style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 13px;">
                ${maskKey(activeKey.key)}
              </p>
              <div style="margin-top: 12px; display: flex; gap: 16px; font-size: 12px; color: var(--text-muted);">
                <span>Domain: <strong style="color: var(--text-primary);">https://api.avalai.ir</strong></span>
                <span>Latency: <strong style="color: var(--accent-cyan);">${this.latency ? `${this.latency}ms` : '--'}</strong></span>
                <span>Last Checked: <strong style="color: var(--text-primary);">${activeKey.lastTested ? formatDate(activeKey.lastTested) : 'Never'}</strong></span>
              </div>
            </div>

            <div class="audit-score-circle" style="border-color: ${activeKey.status === 'valid' ? 'var(--accent-emerald)' : activeKey.status === 'invalid' ? 'var(--accent-rose)' : 'var(--text-muted)'}">
              <span class="audit-score-num">${activeKey.tier !== null ? `T${activeKey.tier}` : '?'}</span>
              <span class="audit-score-lbl">${activeKey.status === 'valid' ? 'HEALTHY' : activeKey.status === 'invalid' ? 'INVALID' : 'READY'}</span>
            </div>
          </div>

          <!-- Metrics Row -->
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-label">Account Tier</span>
              <div class="metric-value" style="color: #a5b4fc;">
                ${activeKey.tier !== null ? `Tier ${activeKey.tier}` : '--'}
              </div>
              <span class="metric-subtext">Tier 0 (Basic) to Tier 5 (Enterprise)</span>
            </div>

            <div class="metric-card">
              <span class="metric-label">Remaining Credit (Toman)</span>
              <div class="metric-value" style="color: var(--accent-emerald);">
                ${activeKey.balance_irt !== null ? formatIRT(activeKey.balance_irt) : '--'}
              </div>
              <span class="metric-subtext">Available in wallet & packages</span>
            </div>

            <div class="metric-card">
              <span class="metric-label">USD Units Equivalent</span>
              <div class="metric-value" style="color: var(--accent-cyan);">
                ${activeKey.balance_usd !== null ? formatUSD(activeKey.balance_usd) : '--'}
              </div>
              <span class="metric-subtext">
                Rate: ${activeKey.exchange_rate ? `${activeKey.exchange_rate.toLocaleString()} IRT/$` : '--'}
              </span>
            </div>

            <div class="metric-card">
              <span class="metric-label">Active Packages & Grants</span>
              <div class="metric-value" style="color: var(--accent-amber);">
                ${(activeKey.packages?.length || 0) + (activeKey.grants?.length || 0)}
              </div>
              <span class="metric-subtext">Special model discounts & quotas</span>
            </div>
          </div>

          <!-- Credit Packages Breakdown -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>🎁</span>
                <span>Active Credit Packages & Model Grants</span>
              </div>
              <span class="badge badge-muted">${activeKey.packages?.length || 0} Packages</span>
            </div>

            ${(!activeKey.packages || activeKey.packages.length === 0) ? `
              <p style="color: var(--text-muted); font-size: 13px;">No active credit packages detected on this account. Standard wallet balance applies.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${activeKey.packages.map(pkg => `
                  <div class="package-card">
                    <div class="package-card-header">
                      <div>
                        <span class="package-title">${pkg.name || 'Package ' + pkg.id}</span>
                        ${pkg.description ? `<p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${pkg.description}</p>` : ''}
                      </div>
                      <div style="text-align: right;">
                        <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-emerald);">
                          ${formatIRT(pkg.remaining_irt)}
                        </span>
                        <span style="font-size: 11px; color: var(--text-muted); display: block;">
                          of ${formatIRT(pkg.amount_irt)}
                        </span>
                      </div>
                    </div>
                    ${pkg.scope_details?.api ? `
                      <div>
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Eligible Models:</span>
                        <div class="package-scope-tags" style="margin-top: 4px;">
                          ${pkg.scope_details.api.map(m => `<span class="package-scope-tag">${m}</span>`).join('')}
                        </div>
                      </div>
                    ` : ''}
                    <div style="font-size: 11px; color: var(--text-muted);">
                      Expires: <strong>${pkg.end_date ? formatDate(pkg.end_date) : 'N/A'}</strong>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Headers & Rate Limits Inspector -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>📡</span>
                <span>Live Response Headers & Rate Limits</span>
              </div>
              <span class="badge badge-cyan">RFC / AvalAI Standard</span>
            </div>

            ${!this.lastHeaders ? `
              <p style="color: var(--text-muted); font-size: 13px;">Click "Run Full Diagnostic Test" above to capture live response headers and rate limits from the server.</p>
            ` : `
              <table class="headers-table">
                <tbody>
                  <tr>
                    <td class="header-name">avalai-request-id</td>
                    <td class="header-value" style="color: var(--accent-cyan); font-weight: 700;">
                      ${this.lastHeaders['avalai-request-id'] || this.lastHeaders['x-request-id'] || 'None'}
                    </td>
                  </tr>
                  <tr>
                    <td class="header-name">x-ratelimit-limit-requests</td>
                    <td class="header-value">${this.lastHeaders['x-ratelimit-limit-requests'] || 'Not reported'}</td>
                  </tr>
                  <tr>
                    <td class="header-name">x-ratelimit-remaining-requests</td>
                    <td class="header-value">${this.lastHeaders['x-ratelimit-remaining-requests'] || 'Not reported'}</td>
                  </tr>
                  <tr>
                    <td class="header-name">x-ratelimit-reset-requests</td>
                    <td class="header-value">${this.lastHeaders['x-ratelimit-reset-requests'] || 'Not reported'}</td>
                  </tr>
                  <tr>
                    <td class="header-name">x-ratelimit-limit-tokens</td>
                    <td class="header-value">${this.lastHeaders['x-ratelimit-limit-tokens'] || 'Not reported'}</td>
                  </tr>
                  <tr>
                    <td class="header-name">x-ratelimit-remaining-tokens</td>
                    <td class="header-value">${this.lastHeaders['x-ratelimit-remaining-tokens'] || 'Not reported'}</td>
                  </tr>
                  <tr>
                    <td class="header-name">openai-processing-ms</td>
                    <td class="header-value">${this.lastHeaders['openai-processing-ms'] ? `${this.lastHeaders['openai-processing-ms']} ms` : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            `}
          </div>
        </div>
      `}
    `;

    this.bindEvents();
  },

  bindEvents() {
    this.container.querySelector('#btn-run-audit')?.addEventListener('click', () => {
      this.runAudit();
    });
  },

  async runAudit() {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    this.isAuditing = true;
    this.render();
    this.showToast('Starting diagnostic audit...', 'info');

    try {
      // Ping domain
      const pingRes = await window.avalai.pingDomain();
      this.latency = pingRes.latencyMs;

      const creditRes = await AvalAIApi.getCredit(activeKey.key);
      this.lastHeaders = creditRes.headers || {};

      if (creditRes.success && creditRes.data) {
        const c = creditRes.data;
        await store.updateKey(activeKey.id, {
          tier: c.account_tier,
          balance_irt: c.remaining_irt,
          balance_usd: c.remaining_unit || c.total_unit,
          exchange_rate: c.exchange_rate,
          packages: c.credit_sources?.packages || [],
          grants: c.credit_sources?.grants || [],
          status: 'valid',
          lastTested: new Date().toISOString()
        });
        this.showToast('Diagnostic audit completed! Account is healthy.', 'success');
      } else {
        const isAuthErr = creditRes.status === 401 || creditRes.status === 403;
        await store.updateKey(activeKey.id, {
          status: isAuthErr ? 'invalid' : 'error',
          lastTested: new Date().toISOString()
        });
        this.showToast(`Audit failed: HTTP ${creditRes.status} (${creditRes.data?.message || creditRes.statusText})`, 'error');
      }
    } catch (err) {
      this.showToast(`Error during audit: ${err.message}`, 'error');
    } finally {
      this.isAuditing = false;
      this.render();
    }
  },

  renderSkeletonAudit() {
    return `
      <div class="audit-container">
        <div class="audit-status-banner">
          <div style="width: 60%;">
            <div class="skeleton skeleton-title" style="width: 200px; margin-bottom: 8px;"></div>
            <div class="skeleton skeleton-text" style="width: 280px; margin-bottom: 12px;"></div>
            <div class="skeleton skeleton-text" style="width: 320px;"></div>
          </div>
          <div class="skeleton" style="width: 76px; height: 76px; border-radius: 50%;"></div>
        </div>

        <div class="metrics-grid">
          ${[1, 2, 3, 4].map(() => `
            <div class="metric-card">
              <div class="skeleton skeleton-text" style="width: 80px; height: 12px;"></div>
              <div class="skeleton skeleton-title" style="width: 140px; height: 30px; margin: 6px 0;"></div>
              <div class="skeleton skeleton-text" style="width: 100px; height: 10px;"></div>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="skeleton skeleton-title" style="width: 240px; margin-bottom: 16px;"></div>
          <div class="skeleton skeleton-text" style="height: 60px;"></div>
        </div>
      </div>
    `;
  }
};
