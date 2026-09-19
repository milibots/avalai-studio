// Models Explorer & Catalog View
import { store } from '../store.js';
import { AvalAIApi } from '../api.js';
import { formatTokens } from '../utils/formatters.js';
import { Icons } from '../utils/icons.js';

// Pre-seeded comprehensive catalog of official AvalAI models
const SEED_MODELS = [
  { id: 'gpt-6-astra', owned_by: 'openai', min_tier: 0, pricing: { input: 2.5, cached_input: 1.25, output: 10.0 }, mode: 'chat', max_tokens: 1000000, supports_vision: true, supports_pdf_input: true, supports_reasoning: true, supports_function_calling: true, supports_web_search: true, supports_prompt_caching: true },
  { id: 'claude-fable-5-1', owned_by: 'anthropic', min_tier: 0, pricing: { input: 3.0, cached_input: 0.3, output: 15.0 }, mode: 'chat', max_tokens: 1000000, supports_vision: true, supports_pdf_input: true, supports_function_calling: true, supports_web_search: true, supports_prompt_caching: true },
  { id: 'gemini-3.8-flash', owned_by: 'google', min_tier: 0, pricing: { input: 0.075, cached_input: 0.01875, output: 0.3 }, mode: 'chat', max_tokens: 1000000, supports_vision: true, supports_audio_input: true, supports_pdf_input: true, supports_function_calling: true, supports_web_search: true, supports_prompt_caching: true },
  { id: 'gpt-audio-mini', owned_by: 'openai', min_tier: 0, pricing: { input: 0.15, output: 0.6 }, mode: 'chat', max_tokens: 128000, supports_audio_input: true, supports_audio_output: true, supports_function_calling: true },
  { id: 'glm-5.3', owned_by: 'zai', min_tier: 0, pricing: { input: 1.5, cached_input: 0.3, output: 5.0 }, mode: 'chat', max_tokens: 1000000, supports_reasoning: true, supports_function_calling: true, supports_prompt_caching: true },
  { id: 'glm-5.3-flash', owned_by: 'zai', min_tier: 0, pricing: { input: 0.3, cached_input: 0.06, output: 1.2 }, mode: 'chat', max_tokens: 991000, supports_function_calling: true },
  { id: 'deepseek-v4-pro', owned_by: 'deepseek', min_tier: 0, pricing: { input: 0.55, cached_input: 0.14, output: 2.19 }, mode: 'chat', max_tokens: 128000, supports_reasoning: true, supports_function_calling: true, supports_prompt_caching: true },
  { id: 'deepseek-v4-flash', owned_by: 'deepseek', min_tier: 0, pricing: { input: 0.14, cached_input: 0.035, output: 0.55 }, mode: 'chat', max_tokens: 128000, supports_function_calling: true },
  { id: 'qwen3.8-27b', owned_by: 'alibaba', min_tier: 0, pricing: { input: 0.4, cached_input: 0.1, output: 1.6 }, mode: 'chat', max_tokens: 131072, supports_vision: true, supports_function_calling: true },
  { id: 'qwen3.8-flash', owned_by: 'alibaba', min_tier: 0, pricing: { input: 0.1, cached_input: 0.02, output: 0.4 }, mode: 'chat', max_tokens: 131072, supports_vision: true, supports_function_calling: true },
  { id: 'gpt-5.6-luna', owned_by: 'openai', min_tier: 0, pricing: { input: 1.2, cached_input: 0.3, output: 4.8 }, mode: 'chat', max_tokens: 256000, supports_vision: true, supports_pdf_input: true, supports_function_calling: true, supports_web_search: true },
  { id: 'gpt-5.4-mini', owned_by: 'openai', min_tier: 0, pricing: { input: 0.15, cached_input: 0.0375, output: 0.6 }, mode: 'chat', max_tokens: 128000, supports_vision: true, supports_function_calling: true },
  { id: 'claude-sonnet-5', owned_by: 'anthropic', min_tier: 0, pricing: { input: 3.0, cached_input: 0.3, output: 15.0 }, mode: 'chat', max_tokens: 200000, supports_vision: true, supports_pdf_input: true, supports_function_calling: true, supports_prompt_caching: true },
  { id: 'claude-opus-5', owned_by: 'anthropic', min_tier: 1, pricing: { input: 15.0, cached_input: 1.5, output: 75.0 }, mode: 'chat', max_tokens: 200000, supports_vision: true, supports_pdf_input: true, supports_function_calling: true },
  { id: 'grok-4.5', owned_by: 'xai', min_tier: 0, pricing: { input: 2.0, cached_input: 0.5, output: 8.0 }, mode: 'chat', max_tokens: 131072, supports_vision: true, supports_function_calling: true },
  { id: 'kimi-k3', owned_by: 'moonshot', min_tier: 0, pricing: { input: 1.0, cached_input: 0.2, output: 4.0 }, mode: 'chat', max_tokens: 262144, supports_function_calling: true },
  { id: 'mistral-large-3', owned_by: 'mistralai', min_tier: 0, pricing: { input: 2.0, cached_input: 0.5, output: 6.0 }, mode: 'chat', max_tokens: 128000, supports_function_calling: true },
  { id: 'gpt-image-2', owned_by: 'openai', min_tier: 0, pricing: { input: 0.04, output: 0.08 }, mode: 'image' },
  { id: 'seedream-4.5', owned_by: 'byteplus', min_tier: 0, pricing: { input: 0.03, output: 0.03 }, mode: 'image' },
  { id: 'flux.2-pro', owned_by: 'bfl', min_tier: 0, pricing: { input: 0.05, output: 0.05 }, mode: 'image' },
  { id: 'gpt-4o-mini-tts', owned_by: 'openai', min_tier: 0, pricing: { input: 15.0 }, mode: 'audio' },
  { id: 'eleven_v3', owned_by: 'elevenlabs', min_tier: 1, pricing: { input: 25.0 }, mode: 'audio' },
  { id: 'text-embedding-3-small', owned_by: 'openai', min_tier: 0, pricing: { input: 0.02 }, mode: 'embedding' },
  { id: 'cohere-rerank-v4.0-pro', owned_by: 'cohere', min_tier: 0, pricing: { input: 2.0 }, mode: 'rerank' }
];

export const ModelsView = {
  init(container, showToast, onSelectModelForChat) {
    this.container = container;
    this.showToast = showToast;
    this.onSelectModelForChat = onSelectModelForChat;
    this.searchQuery = '';
    this.selectedProvider = 'all';
    this.selectedModality = 'all';
    this.models = SEED_MODELS;
    this.render();

    // Auto-fetch live models if active key exists
    this.fetchLiveModels(false);
  },

  render() {
    const filtered = this.getFilteredModels();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-header-title-block">
          <h1>AvalAI Model Explorer & Capabilities</h1>
          <p>Browse live pricing, context windows, and feature support across 100+ AI models.</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-sync-models">
            ${Icons.refresh()} Fetch Live from AvalAI
          </button>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="models-filter-bar">
        <div style="flex: 1; min-width: 200px;">
          <input type="text" class="form-input" id="input-model-search" placeholder="Search by model name or provider..." value="${this.searchQuery}" style="width: 100%;" />
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <select class="form-select" id="select-provider-filter">
            <option value="all" ${this.selectedProvider === 'all' ? 'selected' : ''}>All Providers</option>
            <option value="openai" ${this.selectedProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
            <option value="anthropic" ${this.selectedProvider === 'anthropic' ? 'selected' : ''}>Anthropic Claude</option>
            <option value="google" ${this.selectedProvider === 'google' ? 'selected' : ''}>Google Gemini</option>
            <option value="deepseek" ${this.selectedProvider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
            <option value="alibaba" ${this.selectedProvider === 'alibaba' ? 'selected' : ''}>Alibaba Qwen</option>
            <option value="zai" ${this.selectedProvider === 'zai' ? 'selected' : ''}>Z.AI GLM</option>
            <option value="xai" ${this.selectedProvider === 'xai' ? 'selected' : ''}>xAI Grok</option>
            <option value="mistralai" ${this.selectedProvider === 'mistralai' ? 'selected' : ''}>Mistral</option>
            <option value="moonshot" ${this.selectedProvider === 'moonshot' ? 'selected' : ''}>Moonshot Kimi</option>
            <option value="elevenlabs" ${this.selectedProvider === 'elevenlabs' ? 'selected' : ''}>ElevenLabs</option>
            <option value="cohere" ${this.selectedProvider === 'cohere' ? 'selected' : ''}>Cohere</option>
          </select>

          <select class="form-select" id="select-modality-filter">
            <option value="all" ${this.selectedModality === 'all' ? 'selected' : ''}>All Modalities</option>
            <option value="chat" ${this.selectedModality === 'chat' ? 'selected' : ''}>Chat / Reasoning</option>
            <option value="image" ${this.selectedModality === 'image' ? 'selected' : ''}>Image Generation</option>
            <option value="audio" ${this.selectedModality === 'audio' ? 'selected' : ''}>Audio & TTS</option>
            <option value="embedding" ${this.selectedModality === 'embedding' ? 'selected' : ''}>Embeddings</option>
            <option value="rerank" ${this.selectedModality === 'rerank' ? 'selected' : ''}>Rerank</option>
          </select>
        </div>
      </div>

      <!-- Models Count Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 13px;">
        <span>Showing <strong>${filtered.length}</strong> of ${this.models.length} models</span>
        <span>Pricing in USD per 1M tokens</span>
      </div>

      <!-- Models Grid -->
      <div class="models-grid">
        ${this.isLoading ? this.renderSkeletonModels() : filtered.map(m => this.renderModelCard(m)).join('')}
      </div>
    `;

    this.bindEvents();
  },

  renderModelCard(m) {
    const isChat = !m.mode || m.mode === 'chat';
    const providerBadge = m.owned_by ? `<span class="badge badge-primary">${m.owned_by.toUpperCase()}</span>` : '';
    const tierBadge = `<span class="badge ${m.min_tier > 0 ? 'badge-amber' : 'badge-emerald'}">Tier ${m.min_tier || 0}+</span>`;

    return `
      <div class="model-card">
        <div class="model-card-header">
          <div>
            <div class="model-card-id">${m.id}</div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              ${providerBadge}
              ${tierBadge}
              ${m.mode ? `<span class="badge badge-muted">${m.mode}</span>` : ''}
            </div>
          </div>
        </div>

        ${m.pricing ? `
          <div class="model-card-pricing">
            <div class="price-item">
              <span class="price-label">Input / 1M</span>
              <span class="price-val">$${m.pricing.input !== undefined ? m.pricing.input : '--'}</span>
            </div>
            ${m.pricing.cached_input !== undefined ? `
              <div class="price-item">
                <span class="price-label">Cached / 1M</span>
                <span class="price-val" style="color: var(--accent-cyan);">$${m.pricing.cached_input}</span>
              </div>
            ` : ''}
            <div class="price-item">
              <span class="price-label">Output / 1M</span>
              <span class="price-val" style="color: #a5b4fc;">$${m.pricing.output !== undefined ? m.pricing.output : '--'}</span>
            </div>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary);">
          <span>Context: <strong>${m.max_tokens ? formatTokens(m.max_tokens) : '128k'}</strong></span>
          ${m.max_output_tokens ? `<span>Max Out: <strong>${formatTokens(m.max_output_tokens)}</strong></span>` : ''}
        </div>

        <div class="model-features-row">
          ${m.supports_vision ? `<span class="badge badge-primary" title="Vision Multimodal Input">${Icons.eye('svg-icon', 12)} Vision</span>` : ''}
          ${m.supports_audio_input ? `<span class="badge badge-cyan" title="Audio / Voice Input">${Icons.audio('svg-icon', 12)} Audio In</span>` : ''}
          ${m.supports_audio_output ? `<span class="badge badge-cyan" title="Spoken Audio Output">${Icons.volume2('svg-icon', 12)} Audio Out</span>` : ''}
          ${m.supports_pdf_input ? `<span class="badge badge-amber" title="PDF Document Processing">${Icons.fileText('svg-icon', 12)} PDF</span>` : ''}
          ${m.supports_reasoning ? `<span class="badge badge-violet" title="Reasoning Process">${Icons.cpu('svg-icon', 12)} Reasoning</span>` : ''}
          ${m.supports_function_calling ? `<span class="badge badge-cyan" title="Function Calling">${Icons.code('svg-icon', 12)} Tools</span>` : ''}
          ${m.supports_web_search ? `<span class="badge badge-emerald" title="Web Search">${Icons.search('svg-icon', 12)} Web Search</span>` : ''}
          ${m.supports_prompt_caching ? `<span class="badge badge-primary" title="Prompt Caching">${Icons.sparkles('svg-icon', 12)} Cache</span>` : ''}
        </div>

        ${isChat ? `
          <button class="btn btn-secondary btn-sm btn-use-chat" data-model-id="${m.id}" style="margin-top: auto; width: 100%;">
            ${Icons.chat('svg-icon', 14)} Open in Chat Playground
          </button>
        ` : ''}
      </div>
    `;
  },

  getFilteredModels() {
    return this.models.filter(m => {
      const matchSearch = !this.searchQuery ||
        m.id.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (m.owned_by && m.owned_by.toLowerCase().includes(this.searchQuery.toLowerCase()));

      const matchProvider = this.selectedProvider === 'all' ||
        (m.owned_by && m.owned_by.toLowerCase().includes(this.selectedProvider.toLowerCase()));

      const matchModality = this.selectedModality === 'all' ||
        (this.selectedModality === 'chat' && (!m.mode || m.mode === 'chat')) ||
        (m.mode && m.mode.toLowerCase() === this.selectedModality.toLowerCase());

      return matchSearch && matchProvider && matchModality;
    });
  },

  bindEvents() {
    const searchInput = this.container.querySelector('#input-model-search');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render();
      const updatedInput = this.container.querySelector('#input-model-search');
      updatedInput?.focus();
      updatedInput?.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
    });

    this.container.querySelector('#select-provider-filter')?.addEventListener('change', (e) => {
      this.selectedProvider = e.target.value;
      this.render();
    });

    this.container.querySelector('#select-modality-filter')?.addEventListener('change', (e) => {
      this.selectedModality = e.target.value;
      this.render();
    });

    this.container.querySelector('#btn-sync-models')?.addEventListener('click', () => {
      this.fetchLiveModels(true);
    });

    this.container.querySelectorAll('.btn-use-chat').forEach(btn => {
      btn.addEventListener('click', () => {
        const modelId = btn.getAttribute('data-model-id');
        if (this.onSelectModelForChat) {
          this.onSelectModelForChat(modelId);
        }
      });
    });
  },

  async fetchLiveModels(notifyUser = true) {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    this.isLoading = true;
    this.render();
    if (notifyUser) this.showToast('Fetching live model catalog from AvalAI...', 'info');

    try {
      const res = await AvalAIApi.getModels(activeKey.key);
      if (res.success && res.data?.data && Array.isArray(res.data.data)) {
        // Merge with seed data for pricing preservation if server doesn't return full pricing
        const serverModels = res.data.data;
        const merged = serverModels.map(sm => {
          const seeded = SEED_MODELS.find(s => s.id === sm.id);
          return {
            ...seeded,
            ...sm,
            pricing: sm.pricing || seeded?.pricing
          };
        });

        this.models = merged;
        store.setCachedModels(merged);
        this.render();
        if (notifyUser) this.showToast(`Fetched ${serverModels.length} models successfully!`, 'success');
      } else if (notifyUser) {
        this.showToast(`Could not fetch live models: HTTP ${res.status}`, 'error');
      }
    } catch (err) {
      if (notifyUser) this.showToast(`Model fetch error: ${err.message}`, 'error');
    } finally {
      this.isLoading = false;
      this.render();
    }
  },

  renderSkeletonModels() {
    return [1, 2, 3, 4, 5, 6].map(() => `
      <div class="model-card">
        <div class="skeleton skeleton-title" style="width: 70%; height: 18px;"></div>
        <div style="display: flex; gap: 6px; margin: 4px 0;">
          <div class="skeleton" style="width: 50px; height: 18px; border-radius: 9999px;"></div>
          <div class="skeleton" style="width: 60px; height: 18px; border-radius: 9999px;"></div>
        </div>
        <div class="skeleton" style="height: 48px; border-radius: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 40%; height: 12px;"></div>
        <div class="skeleton" style="height: 32px; border-radius: 6px; margin-top: auto;"></div>
      </div>
    `).join('');
  }
};
