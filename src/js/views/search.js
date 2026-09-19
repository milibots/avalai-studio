// Web Search API Testing Lab View
import { store } from '../store.js';
import { AvalAIApi } from '../api.js';

export const SearchView = {
  init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.isSearching = false;
    this.searchResults = null;
    this.lastQuery = '';
    this.render();
  },

  render() {
    const activeKey = store.getActiveKey();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-header-title-block">
          <h1>Standalone Web Search API Lab</h1>
          <p>Query 10 search engines from 8 leading providers (Serper, Tavily, Exa, Firecrawl, Perplexity, etc.)</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🌐</span>
            <span>Execute Web Search Query</span>
          </div>
          <span class="badge badge-primary">POST /v1/search</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 240px 140px; gap: 14px; align-items: flex-end;">
          <div class="form-group">
            <label class="form-label">Search Query</label>
            <input type="text" class="form-input" id="search-input-query" placeholder="e.g. Latest AI developments 2026, AvalAI models pricing..." value="Latest breakthrough models in artificial intelligence 2026" />
          </div>

          <div class="form-group">
            <label class="form-label">Search Provider Tool</label>
            <select class="form-select" id="search-select-tool">
              <option value="serper-search">Serper ($0.001 / query - Google Powered)</option>
              <option value="tavily-search">Tavily ($0.008 / query - Web Search)</option>
              <option value="exa_ai-search">Exa AI ($0.025 / query - Neural Search)</option>
              <option value="firecrawl-search">Firecrawl ($0.008 / query - Scrape & Extract)</option>
              <option value="perplexity-search">Perplexity ($0.005 / query - AI Search)</option>
              <option value="dataforseo-search">DataForSEO ($0.003 / query)</option>
              <option value="parallel_ai-search">Parallel AI ($0.004 / query - Fast)</option>
            </select>
          </div>

          <div>
            <button class="btn btn-primary" id="btn-run-search" style="width: 100%; height: 42px;" ${!activeKey ? 'disabled' : ''}>
              ${this.isSearching ? 'Searching...' : '🔍 Search'}
            </button>
          </div>
        </div>
      </div>

      <!-- Search Results Area -->
      <div style="margin-top: 24px;">
        ${this.isSearching ? `
          <div class="search-results-list">
            ${[1, 2, 3, 4].map(() => `
              <div class="search-result-card">
                <div class="skeleton skeleton-title" style="width: 50%; height: 18px;"></div>
                <div class="skeleton skeleton-text" style="width: 95%; height: 14px; margin-top: 6px;"></div>
                <div class="skeleton skeleton-text" style="width: 80%; height: 14px;"></div>
                <div class="skeleton skeleton-text" style="width: 25%; height: 10px; margin-top: 6px;"></div>
              </div>
            `).join('')}
          </div>
        ` : this.searchResults ? `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px; font-weight: 700;">Results for "${this.lastQuery}"</h3>
            <span class="badge badge-cyan">${this.searchResults.length} results returned</span>
          </div>

          <div class="search-results-list">
            ${this.searchResults.map(item => `
              <div class="search-result-card">
                <a href="${item.url || '#'}" target="_blank" class="search-result-title">${item.title || 'Untitled Result'}</a>
                <p class="search-result-snippet">${item.content || item.snippet || item.text || 'No snippet available.'}</p>
                <div class="search-result-meta">
                  <span>URL: ${item.url || 'N/A'}</span>
                  ${item.score !== undefined ? `<span>Score: ${(item.score * 100).toFixed(1)}%</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 40px; margin-bottom: 8px;">🔍</div>
            <p>Run a search query to inspect real-time structured search results and metadata.</p>
          </div>
        `}
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    this.container.querySelector('#btn-run-search')?.addEventListener('click', () => {
      this.executeSearch();
    });

    this.container.querySelector('#search-input-query')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeSearch();
      }
    });
  },

  async executeSearch() {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    const query = this.container.querySelector('#search-input-query')?.value.trim();
    const tool = this.container.querySelector('#search-select-tool')?.value;

    if (!query) {
      this.showToast('Please enter a search query.', 'error');
      return;
    }

    this.isSearching = true;
    this.lastQuery = query;
    this.render();
    this.showToast(`Executing search with ${tool}...`, 'info');

    try {
      const res = await AvalAIApi.search({
        apiKey: activeKey.key,
        search_tool_name: tool,
        query,
        max_results: 10
      });

      this.isSearching = false;

      if (res.success && res.data) {
        const results = res.data.results || res.data.organic || [];
        this.searchResults = Array.isArray(results) ? results : [results];
        this.render();
        this.showToast(`Search completed: ${this.searchResults.length} results found!`, 'success');
      } else {
        this.searchResults = null;
        this.showToast(`Search failed: HTTP ${res.status} (${res.data?.message || res.statusText})`, 'error');
        this.render();
      }
    } catch (err) {
      this.isSearching = false;
      this.showToast(`Error: ${err.message}`, 'error');
      this.render();
    }
  }
};
