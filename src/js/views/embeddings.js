// Embeddings & Rerank Lab View
import { store } from '../store.js';
import { AvalAIApi } from '../api.js';
import { Icons } from '../utils/icons.js';

function cosineSimilarity(vecA, vecB) {
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const EmbeddingsView = {
  init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.similarityScore = null;
    this.isCalculating = false;
    this.isReranking = false;
    this.rerankResults = null;
    this.render();
  },

  render() {
    const activeKey = store.getActiveKey();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-header-title-block">
          <h1>Vector Embeddings & Rerank Lab</h1>
          <p>Compute vector embeddings, test semantic similarity, and re-order search results using Cohere & Qwen Rerank.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <!-- Cosine Similarity & Embeddings -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              ${Icons.embeddings(18)}
              <span>Semantic Similarity (Embeddings)</span>
            </div>
            <span class="badge badge-primary">POST /v1/embeddings</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Embedding Model</label>
              <select class="form-select" id="embed-select-model">
                <option value="text-embedding-3-small">OpenAI: text-embedding-3-small (1536 dim)</option>
                <option value="text-embedding-3-large">OpenAI: text-embedding-3-large (3072 dim)</option>
                <option value="cohere-embed-v4">Cohere: Cohere Embed v4</option>
                <option value="gemini-embedding-2">Google: Gemini Embedding 2</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Text A</label>
              <textarea class="form-textarea" id="embed-text-a" style="min-height: 60px;">AvalAI provides unified OpenAI-compatible endpoints with low latency.</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Text B</label>
              <textarea class="form-textarea" id="embed-text-b" style="min-height: 60px;">We can connect to multiple AI models using a single base URL in Iran.</textarea>
            </div>

            <button class="btn btn-primary" id="btn-calc-similarity" ${!activeKey ? 'disabled' : ''}>
              ${this.isCalculating ? 'Computing Vectors...' : `${Icons.sparkles(14)} Compute Cosine Similarity`}
            </button>

            ${this.isCalculating ? `
              <div class="vector-similarity-gauge">
                <div class="skeleton skeleton-text" style="width: 140px; height: 12px; margin-bottom: 8px;"></div>
                <div class="skeleton skeleton-title" style="width: 100px; height: 36px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 100%; height: 8px; border-radius: 9999px;"></div>
              </div>
            ` : this.similarityScore !== null ? `
              <div class="vector-similarity-gauge">
                <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Semantic Similarity Score</span>
                <span style="font-size: 32px; font-weight: 800; font-family: var(--font-mono); color: var(--accent-cyan);">
                  ${(this.similarityScore * 100).toFixed(2)}%
                </span>
                <div class="similarity-bar-wrapper">
                  <div class="similarity-bar-fill" style="width: ${Math.max(0, Math.min(100, this.similarityScore * 100))}%;"></div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Rerank Lab -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              ${Icons.search(18)}
              <span>Document Reranking Lab</span>
            </div>
            <span class="badge badge-emerald">POST /v1/rerank</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Rerank Model</label>
              <select class="form-select" id="rerank-select-model">
                <option value="cohere-rerank-v4.0-pro">Cohere: cohere-rerank-v4.0-pro</option>
                <option value="qwen3-rerank">Alibaba: qwen3-rerank</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Search Query</label>
              <input type="text" class="form-input" id="rerank-input-query" value="How to authenticate with AvalAI?" />
            </div>

            <div class="form-group">
              <label class="form-label">Documents to Rerank (one per line)</label>
              <textarea class="form-textarea" id="rerank-input-docs" style="min-height: 100px;">To authenticate with AvalAI, pass your API key as a Bearer token in the Authorization header.
AvalAI provides 200,000 Toman free signup credit for new developers.
Image generation supports FLUX, GPT-Image, and Seedream models.
You can monitor rate limits using the x-ratelimit-remaining headers.</textarea>
            </div>

            <button class="btn btn-primary" id="btn-run-rerank" ${!activeKey ? 'disabled' : ''}>
              ${this.isReranking ? 'Reranking...' : `${Icons.play(14)} Run Reranking`}
            </button>

            ${this.isReranking ? `
              <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                ${[1, 2, 3].map(() => `
                  <div style="background: var(--bg-surface); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
                    <div class="skeleton skeleton-text" style="width: 70%; height: 14px;"></div>
                    <div class="skeleton" style="width: 50px; height: 20px; border-radius: 9999px;"></div>
                  </div>
                `).join('')}
              </div>
            ` : this.rerankResults ? `
              <div style="margin-top: 10px;">
                <span class="form-label" style="margin-bottom: 8px;">Relevance Ranked Results:</span>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${this.rerankResults.map((r, idx) => `
                    <div style="background: var(--bg-surface); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                      <div style="font-size: 12px; color: var(--text-primary); flex: 1;">
                        <strong style="color: var(--accent-cyan); margin-right: 6px;">#${idx + 1}</strong>
                        ${r.document?.text || r.text || r}
                      </div>
                      <span class="badge badge-emerald" style="font-family: var(--font-mono);">
                        ${r.relevance_score ? `${(r.relevance_score * 100).toFixed(1)}%` : 'Score N/A'}
                      </span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    this.container.querySelector('#btn-calc-similarity')?.addEventListener('click', () => {
      this.computeSimilarity();
    });

    this.container.querySelector('#btn-run-rerank')?.addEventListener('click', () => {
      this.runRerank();
    });
  },

  async computeSimilarity() {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    const model = this.container.querySelector('#embed-select-model')?.value;
    const textA = this.container.querySelector('#embed-text-a')?.value.trim();
    const textB = this.container.querySelector('#embed-text-b')?.value.trim();

    if (!textA || !textB) {
      this.showToast('Please enter both Text A and Text B.', 'error');
      return;
    }

    this.isCalculating = true;
    this.render();
    this.showToast('Generating vector embeddings...', 'info');

    try {
      const res = await AvalAIApi.embeddings({
        apiKey: activeKey.key,
        model,
        input: [textA, textB]
      });

      this.isCalculating = false;

      if (res.success && res.data?.data && res.data.data.length >= 2) {
        const vecA = res.data.data[0].embedding;
        const vecB = res.data.data[1].embedding;
        this.similarityScore = cosineSimilarity(vecA, vecB);
        this.render();
        this.showToast(`Similarity calculated: ${(this.similarityScore * 100).toFixed(2)}%`, 'success');
      } else {
        this.similarityScore = null;
        this.showToast(`Embedding failed: HTTP ${res.status} (${res.data?.message || res.statusText})`, 'error');
        this.render();
      }
    } catch (err) {
      this.isCalculating = false;
      this.showToast(`Error: ${err.message}`, 'error');
      this.render();
    }
  },

  async runRerank() {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    const model = this.container.querySelector('#rerank-select-model')?.value;
    const query = this.container.querySelector('#rerank-input-query')?.value.trim();
    const rawDocs = this.container.querySelector('#rerank-input-docs')?.value.trim();

    if (!query || !rawDocs) {
      this.showToast('Please enter a query and documents to rerank.', 'error');
      return;
    }

    const docs = rawDocs.split('\n').map(d => d.trim()).filter(d => d.length > 0);

    this.isReranking = true;
    this.render();
    this.showToast('Running rerank model...', 'info');

    try {
      const res = await AvalAIApi.rerank({
        apiKey: activeKey.key,
        model,
        query,
        documents: docs,
        top_n: docs.length
      });

      this.isReranking = false;

      if (res.success && res.data?.results) {
        this.rerankResults = res.data.results;
        this.render();
        this.showToast('Documents reranked successfully!', 'success');
      } else {
        this.rerankResults = null;
        this.showToast(`Rerank failed: HTTP ${res.status} (${res.data?.message || res.statusText})`, 'error');
        this.render();
      }
    } catch (err) {
      this.isReranking = false;
      this.showToast(`Error: ${err.message}`, 'error');
      this.render();
    }
  }
};
