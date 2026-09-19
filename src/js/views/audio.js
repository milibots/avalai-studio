// Audio & Speech Lab View with SQLite Audio History and Skeletons
import { store } from '../store.js';
import { Database } from '../db.js';
import { AvalAIApi } from '../api.js';

export const AudioView = {
  async init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.isSynthesizing = false;
    this.currentAudioUrl = null;
    this.audioHistory = [];

    // Load from SQLite
    try {
      const savedAudios = await Database.getAudios();
      this.audioHistory = savedAudios.map(a => ({
        ...a,
        url: a.audio_url
      }));
      if (this.audioHistory.length > 0) {
        this.currentAudioUrl = this.audioHistory[0].url;
      }
    } catch (err) {
      console.error('Failed to load audio from DB:', err);
    }

    this.render();
  },

  render() {
    const activeKey = store.getActiveKey();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-header-title-block">
          <h1>Audio & Speech Studio</h1>
          <p>Synthesize realistic voice with OpenAI, ElevenLabs, and Gemini TTS models, or transcribe recordings.</p>
        </div>
      </div>

      <div class="audio-grid">
        <!-- Text to Speech Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span>🎙️</span>
              <span>Text-to-Speech Synthesis</span>
            </div>
            <span class="badge badge-primary">POST /v1/audio/speech</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">TTS Model</label>
              <select class="form-select" id="tts-select-model">
                <option value="gpt-4o-mini-tts">OpenAI: gpt-4o-mini-tts (High Naturalness)</option>
                <option value="eleven_v3">ElevenLabs: eleven_v3 (Ultra Expressive)</option>
                <option value="gemini-2.5-flash-tts">Google: gemini-2.5-flash-tts</option>
                <option value="tts-1-hd">OpenAI: tts-1-hd</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Voice</label>
              <select class="form-select" id="tts-select-voice">
                <option value="coral">coral (Warm & Natural)</option>
                <option value="alloy">alloy (Balanced & Neutral)</option>
                <option value="marin">marin (High Clarity)</option>
                <option value="cedar">cedar (Deep & Expressive)</option>
                <option value="echo">echo (Smooth Male)</option>
                <option value="fable">fable (British Accent)</option>
                <option value="onyx">onyx (Authoritative Male)</option>
                <option value="nova">nova (Energetic Female)</option>
                <option value="shimmer">shimmer (Clear Female)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Text to Speak</label>
              <textarea class="form-textarea" id="tts-input-text" placeholder="Enter text to synthesize into spoken audio..." style="min-height: 100px;">Welcome to AvalAI. Today is a wonderful day to build something people love.</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Style Instructions (for gpt-4o-mini-tts)</label>
              <input type="text" class="form-input" id="tts-input-instructions" placeholder="e.g. Speak in a warm, confident, and professional tone." />
            </div>

            <button class="btn btn-primary btn-lg" id="btn-synthesize-speech" ${!activeKey || this.isSynthesizing ? 'disabled' : ''}>
              ${this.isSynthesizing ? 'Synthesizing Audio Wave...' : '🔊 Synthesize & Play'}
            </button>
          </div>

          ${this.isSynthesizing ? `
            <div class="audio-player-card" style="margin-top: 20px; background: var(--bg-surface);">
              <div class="skeleton skeleton-title" style="width: 140px; margin-bottom: 8px;"></div>
              <div class="skeleton" style="width: 100%; height: 42px; border-radius: 8px;"></div>
            </div>
          ` : this.currentAudioUrl ? `
            <div class="audio-player-card" style="margin-top: 20px;">
              <span style="font-weight: 700; font-size: 13px; color: var(--accent-cyan);">Audio Output (Saved in SQLite)</span>
              <audio controls src="${this.currentAudioUrl}" autoplay style="width: 100%;"></audio>
              <div style="display: flex; justify-content: flex-end;">
                <a href="${this.currentAudioUrl}" download="avalai_speech_${Date.now()}.mp3" class="btn btn-secondary btn-sm">
                  ⬇️ Download MP3
                </a>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Audio Transcriptions Info Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span>🎧</span>
              <span>Audio Transcriptions & Recent Library</span>
            </div>
            <span class="badge badge-muted">${this.audioHistory.length} saved</span>
          </div>

          ${this.audioHistory.length > 0 ? `
            <div style="margin-bottom: 16px;">
              <span class="form-label">Recent Generated Clips:</span>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px; max-height: 160px; overflow-y: auto;">
                ${this.audioHistory.map(a => `
                  <div style="background: var(--bg-surface); padding: 8px 12px; border-radius: 6px; font-size: 12px; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${a.input_text || 'Clip'}</span>
                    <button class="btn btn-secondary btn-sm btn-play-cached-audio" data-url="${a.url}">▶️ Play</button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; display: flex; flex-direction: column; gap: 14px;">
            <p>
              AvalAI exposes standard Whisper and Gemini transcription APIs. You can send audio recordings (MP3, WAV, M4A, OGG) to transcribe speech into text with timestamp precision.
            </p>

            <div class="card" style="background: var(--bg-surface); padding: 14px;">
              <h4 style="font-size: 13px; color: var(--text-primary); margin-bottom: 6px;">Supported Models:</h4>
              <ul style="padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: 12px; color: var(--accent-cyan);">
                <li>whisper-1</li>
                <li>gemini-2.5-flash (multimodal audio)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    this.container.querySelector('#btn-synthesize-speech')?.addEventListener('click', () => {
      this.synthesize();
    });

    this.container.querySelectorAll('.btn-play-cached-audio').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        this.currentAudioUrl = url;
        this.render();
      });
    });
  },

  async synthesize() {
    const activeKey = store.getActiveKey();
    if (!activeKey) return;

    const model = this.container.querySelector('#tts-select-model')?.value;
    const voice = this.container.querySelector('#tts-select-voice')?.value;
    const input = this.container.querySelector('#tts-input-text')?.value.trim();
    const instructions = this.container.querySelector('#tts-input-instructions')?.value.trim();

    if (!input) {
      this.showToast('Please enter text to synthesize.', 'error');
      return;
    }

    this.isSynthesizing = true;
    this.render();
    this.showToast('Synthesizing speech with ' + model + '...', 'info');

    try {
      const res = await AvalAIApi.textToSpeech({
        apiKey: activeKey.key,
        model,
        voice,
        input,
        instructions
      });

      this.isSynthesizing = false;

      if (res.success && res.data) {
        const audioUrl = `data:audio/mp3;base64,${res.data}`;
        this.currentAudioUrl = audioUrl;

        const audioObj = {
          id: 'aud_' + Date.now(),
          input_text: input,
          model,
          voice,
          speed: 1.0,
          audio_url: audioUrl,
          url: audioUrl
        };

        this.audioHistory.unshift(audioObj);
        await Database.addAudio(audioObj);

        this.render();
        this.showToast('Speech generated & saved to SQLite!', 'success');
      } else {
        this.showToast(`TTS Failed: HTTP ${res.status} (${res.data?.message || res.statusText})`, 'error');
        this.render();
      }
    } catch (err) {
      this.isSynthesizing = false;
      this.showToast(`Error: ${err.message}`, 'error');
      this.render();
    }
  }
};
