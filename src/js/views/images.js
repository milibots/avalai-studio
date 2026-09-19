// Image Generation Studio View with SQLite Gallery and Skeletons
import { store } from '../store.js';
import { Database } from '../db.js';
import { AvalAIApi } from '../api.js';
import { Icons } from '../utils/icons.js';

export const ImagesView = {
  async init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.isGenerating = false;
    this.currentModel = 'gpt-image-2';
    this.currentImage = null;
    this.gallery = [];

    // Load from SQLite
    try {
      const savedImages = await Database.getImages();
      this.gallery = savedImages.map(img => ({
        ...img,
        url: img.image_url
      }));
      if (this.gallery.length > 0) {
        this.currentImage = this.gallery[0];
      }
    } catch (err) {
      console.error('Failed to load images from DB:', err);
    }

    this.render();
  },

  render() {
    const activeKey = store.getActiveKey();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-header-title-block">
          <h1>Image Generation Studio</h1>
          <p>Generate high-fidelity visual assets using GPT-Image, Seedream, FLUX, and Gemini Nano Banana.</p>
        </div>
      </div>

      <div class="image-studio-layout">
        <!-- Controls Panel -->
        <div class="image-controls-panel">
          <div class="form-group">
            <label class="form-label">Model</label>
            <select class="form-select" id="img-select-model">
              <option value="gpt-image-2">OpenAI: GPT-Image-2 (State of the Art)</option>
              <option value="seedream-4.5">BytePlus: Seedream 4.5</option>
              <option value="flux.2-pro">BFL: FLUX.2 Pro</option>
              <option value="gemini-3.1-flash-image">Google: Gemini 3.1 Flash Image (Nano Banana 2)</option>
              <option value="qwen-image-3.0">Alibaba: Qwen Image 3.0</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Prompt Brief</label>
            <textarea class="form-textarea" id="img-prompt-input" placeholder="Describe the image you want to generate in rich detail..." style="min-height: 120px;">A futuristic cybernetic laboratory with glowing holographic charts, neon cyan and indigo accents, cinematic 8k resolution</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Resolution / Aspect Ratio</label>
            <select class="form-select" id="img-select-size">
              <option value="1024x1024">1024x1024 (1:1 Square)</option>
              <option value="1024x1536">1024x1536 (2:3 Portrait)</option>
              <option value="1536x1024">1536x1024 (3:2 Landscape)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Quality</label>
            <select class="form-select" id="img-select-quality">
              <option value="medium">Medium</option>
              <option value="high">High / HD</option>
              <option value="low">Low (Fast)</option>
            </select>
          </div>

          <button class="btn btn-primary btn-lg" id="btn-generate-image" ${!activeKey || this.isGenerating ? 'disabled' : ''} style="margin-top: 10px;">
            ${this.isGenerating ? 'Rendering Image...' : `${Icons.sparkles('svg-icon', 15)} Generate Image`}
          </button>

          ${this.gallery.length > 0 ? `
            <div style="margin-top: 16px;">
              <span class="form-label">Recent Generations (${this.gallery.length} in SQLite)</span>
              <div class="image-gallery-grid">
                ${this.gallery.map((img, idx) => `
                  <img src="${img.url}" class="gallery-thumb" data-idx="${idx}" />
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Display Panel -->
        <div class="image-display-panel">
          ${this.isGenerating ? `
            <div class="image-generated-container skeleton" style="width: 480px; height: 480px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: var(--bg-surface);">
              <div class="status-dot loading" style="width: 20px; height: 20px;"></div>
              <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Rendering with ${this.currentModel}...</span>
              <span style="font-size: 12px; color: var(--text-muted);">Diffusion sampling in progress via AvalAI</span>
            </div>
          ` : this.currentImage ? `
            <div class="image-generated-container">
              <img src="${this.currentImage.url}" class="image-generated-preview" />
            </div>
            <div style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
              <a href="${this.currentImage.url}" download="avalai_generated_${Date.now()}.png" class="btn btn-primary btn-sm">
                ${Icons.download('svg-icon', 14)} Download PNG
              </a>
              <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
                Model: ${this.currentImage.model} | ${this.currentImage.size}
              </span>
            </div>
          ` : `
            <div style="text-align: center; color: var(--text-muted);">
              <div style="margin-bottom: 12px; display: flex; justify-content: center;">${Icons.images('svg-icon', 48)}</div>
              <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 6px; color: var(--text-secondary);">Image Preview Canvas</h3>
              <p style="font-size: 13px; max-width: 360px;">
                Enter a visual brief and hit generate to render high-resolution images via AvalAI Image API.
              </p>
            </div>
          `}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    this.container.querySelector('#btn-generate-image')?.addEventListener('click', () => {
      this.generateImage();
    });

    this.container.querySelectorAll('.gallery-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const idx = parseInt(thumb.getAttribute('data-idx'), 10);
        this.currentImage = this.gallery[idx];
        this.render();
      });
    });
  },

  async generateImage() {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    const model = this.container.querySelector('#img-select-model')?.value;
    const prompt = this.container.querySelector('#img-prompt-input')?.value.trim();
    const size = this.container.querySelector('#img-select-size')?.value;
    const quality = this.container.querySelector('#img-select-quality')?.value;

    if (!prompt) {
      this.showToast('Please enter an image prompt description.', 'error');
      return;
    }

    this.currentModel = model;
    this.isGenerating = true;
    this.render();
    this.showToast('Generating image with ' + model + '...', 'info');

    try {
      const res = await AvalAIApi.generateImage({
        apiKey: activeKey.key,
        model,
        prompt,
        size,
        quality
      });

      this.isGenerating = false;

      if (res.success && res.data) {
        let imageUrl = null;
        if (res.data.data?.[0]?.b64_json) {
          imageUrl = `data:image/png;base64,${res.data.data[0].b64_json}`;
        } else if (res.data.data?.[0]?.url) {
          imageUrl = res.data.data[0].url;
        } else if (typeof res.data === 'string' && res.data.length > 100) {
          imageUrl = `data:image/png;base64,${res.data}`;
        }

        if (imageUrl) {
          const imgObj = {
            id: 'img_' + Date.now(),
            prompt,
            model,
            size,
            quality,
            image_url: imageUrl,
            url: imageUrl
          };

          this.currentImage = imgObj;
          this.gallery.unshift(imgObj);

          // Save to SQLite
          await Database.addImage(imgObj);

          this.render();
          this.showToast('Image generated & saved to SQLite!', 'success');
        } else {
          this.showToast('Unexpected image response format', 'error');
          this.render();
        }
      } else {
        this.showToast(`Generation failed: HTTP ${res.status} (${res.data?.message || res.statusText})`, 'error');
        this.render();
      }
    } catch (err) {
      this.isGenerating = false;
      this.showToast(`Error: ${err.message}`, 'error');
      this.render();
    }
  }
};
