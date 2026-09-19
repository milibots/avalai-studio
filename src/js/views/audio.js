// Audio & Speech Lab View with TTS Synthesis and Whisper Transcriptions Lab
import { store } from '../store.js';
import { Database } from '../db.js';
import { AvalAIApi } from '../api.js';
import { Icons } from '../utils/icons.js';

export const AudioView = {
  async init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.isSynthesizing = false;
    this.isTranscribing = false;
    this.currentAudioUrl = null;
    this.transcriptionResult = '';
    this.transcribeFile = null; // { base64, name, mime }
    this.audioHistory = [];

    // Voice recording for transcription
    this.transcribeRecorder = null;
    this.transcribeChunks = [];
    this.transcribeTimer = null;
    this.transcribeSec = 0;
    this.isTranscribeRecording = false;

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
          <p>Synthesize realistic voices with OpenAI, ElevenLabs, and Gemini TTS, or transcribe audio with Whisper.</p>
        </div>
      </div>

      <div class="audio-grid">
        <!-- Text to Speech Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              ${Icons.audio(18)}
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
              <textarea class="form-textarea" id="tts-input-text" placeholder="Enter text to synthesize into spoken audio..." style="min-height: 90px;">Welcome to AvalAI. Today is a wonderful day to build something people love.</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Style Instructions (for gpt-4o-mini-tts)</label>
              <input type="text" class="form-input" id="tts-input-instructions" placeholder="e.g. Speak in a warm, confident, and professional tone." />
            </div>

            <button class="btn btn-primary btn-lg" id="btn-synthesize-speech" ${!activeKey || this.isSynthesizing ? 'disabled' : ''}>
              ${this.isSynthesizing ? 'Synthesizing Audio Wave...' : `${Icons.volume2(16)} Synthesize & Play`}
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
                  ${Icons.download(14)} Download MP3
                </a>
              </div>
            </div>
          ` : ''}

          ${this.audioHistory.length > 0 ? `
            <div style="margin-top: 20px;">
              <span class="form-label">Recent Generated Clips (${this.audioHistory.length}):</span>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px; max-height: 140px; overflow-y: auto;">
                ${this.audioHistory.map(a => `
                  <div style="background: var(--bg-surface); padding: 8px 12px; border-radius: 6px; font-size: 12px; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${a.input_text || 'Clip'}</span>
                    <button class="btn btn-secondary btn-sm btn-play-cached-audio" data-url="${a.url}">${Icons.play(12)} Play</button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Speech to Text Transcriptions Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              ${Icons.audio(18)}
              <span>Speech-to-Text Transcription</span>
            </div>
            <span class="badge badge-emerald">POST /v1/audio/transcriptions</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Transcription Model</label>
              <select class="form-select" id="transcribe-select-model">
                <option value="whisper-1">OpenAI: whisper-1 (Multilingual & Robust)</option>
                <option value="gpt-4o-transcribe">OpenAI: gpt-4o-transcribe</option>
                <option value="gpt-4o-mini-transcribe">OpenAI: gpt-4o-mini-transcribe</option>
                <option value="groq.whisper-large-v3-turbo">Groq: Whisper Large V3 Turbo</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Language (Optional)</label>
              <input type="text" class="form-input" id="transcribe-input-lang" placeholder="e.g. fa (Persian), en (English), ar, fr" />
            </div>

            <!-- Audio Input Options: Record OR File Upload -->
            <div class="form-group">
              <label class="form-label">Audio Source</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="file" id="transcribe-file-input" accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg" style="display: none;" />
                <button class="btn btn-secondary btn-sm" id="btn-transcribe-choose-file">
                  ${Icons.folder(14)} Choose Audio File
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-transcribe-record">
                  ${Icons.audio(14)} Record Voice
                </button>
                ${this.transcribeFile ? `
                  <span style="font-size: 12px; color: var(--accent-cyan); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; display: inline-flex; align-items: center; gap: 4px;">
                    ${Icons.check(14)} ${this.transcribeFile.name}
                  </span>
                ` : ''}
              </div>
            </div>

            ${this.transcribeFile ? `
              <div style="background: var(--bg-surface); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                <audio controls src="${this.transcribeFile.base64}" style="width: 100%; height: 36px;"></audio>
              </div>
            ` : ''}

            <button class="btn btn-primary btn-lg" id="btn-run-transcription" ${!activeKey || !this.transcribeFile || this.isTranscribing ? 'disabled' : ''}>
              ${this.isTranscribing ? 'Transcribing with Whisper...' : `${Icons.sparkles(16)} Transcribe Audio to Text`}
            </button>

            <!-- Transcription Output Box -->
            <div class="form-group" style="margin-top: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">Transcribed Text</label>
                ${this.transcriptionResult ? `
                  <button class="btn btn-secondary btn-sm" id="btn-copy-transcription" style="padding: 2px 8px; font-size: 11px;">
                    ${Icons.copy(12)} Copy Text
                  </button>
                ` : ''}
              </div>
              <textarea class="form-textarea" id="transcribe-output-text" readonly placeholder="Transcribed text will appear here..." style="min-height: 120px; font-family: var(--font-base); font-size: 13px;">${this.transcriptionResult}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    // Synthesis
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

    // Transcription File Upload
    const fileInput = this.container.querySelector('#transcribe-file-input');
    const chooseFileBtn = this.container.querySelector('#btn-transcribe-choose-file');
    chooseFileBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          this.transcribeFile = {
            base64: re.target.result,
            name: file.name,
            mime: file.type || 'audio/wav'
          };
          this.render();
        };
        reader.readAsDataURL(file);
      }
    });

    // Transcription Voice Recording
    const recordBtn = this.container.querySelector('#btn-transcribe-record');
    recordBtn?.addEventListener('click', () => {
      this.toggleTranscribeRecording();
    });

    // Run Transcription
    this.container.querySelector('#btn-run-transcription')?.addEventListener('click', () => {
      this.runTranscription();
    });

    // Copy Transcription
    this.container.querySelector('#btn-copy-transcription')?.addEventListener('click', () => {
      if (this.transcriptionResult) {
        navigator.clipboard.writeText(this.transcriptionResult);
        this.showToast('Transcribed text copied to clipboard!', 'success');
      }
    });
  },

  async toggleTranscribeRecording() {
    if (this.isTranscribeRecording) {
      if (this.transcribeRecorder && this.transcribeRecorder.state !== 'inactive') {
        this.transcribeRecorder.stop();
      }
      clearInterval(this.transcribeTimer);
      this.isTranscribeRecording = false;
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.transcribeChunks = [];
        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? { mimeType: 'audio/webm;codecs=opus' }
          : {};

        this.transcribeRecorder = new MediaRecorder(stream, options);
        this.transcribeRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this.transcribeChunks.push(e.data);
        };

        this.transcribeRecorder.onstop = () => {
          clearInterval(this.transcribeTimer);
          this.isTranscribeRecording = false;
          const mime = this.transcribeRecorder.mimeType || 'audio/webm';
          const blob = new Blob(this.transcribeChunks, { type: mime });
          stream.getTracks().forEach(t => t.stop());

          const reader = new FileReader();
          reader.onload = (re) => {
            this.transcribeFile = {
              base64: re.target.result,
              name: `Recording (${this.transcribeSec}s).webm`,
              mime
            };
            this.render();
          };
          reader.readAsDataURL(blob);
        };

        this.transcribeRecorder.start(250);
        this.isTranscribeRecording = true;
        this.transcribeSec = 0;

        const recordBtn = this.container.querySelector('#btn-transcribe-record');
        if (recordBtn) {
          recordBtn.classList.add('btn-recording');
          recordBtn.innerHTML = `${Icons.stop(14)} 00:00`;
        }

        this.transcribeTimer = setInterval(() => {
          this.transcribeSec++;
          const mins = String(Math.floor(this.transcribeSec / 60)).padStart(2, '0');
          const secs = String(this.transcribeSec % 60).padStart(2, '0');
          if (recordBtn) recordBtn.innerHTML = `${Icons.stop(14)} ${mins}:${secs}`;
        }, 1000);

        this.showToast('Recording voice for transcription... Click again to stop.', 'info');
      } catch (err) {
        this.showToast('Microphone error: ' + err.message, 'error');
      }
    }
  },

  async runTranscription() {
    const activeKey = store.getActiveKey();
    if (!activeKey || !this.transcribeFile) return;

    const model = this.container.querySelector('#transcribe-select-model')?.value || 'whisper-1';
    const language = this.container.querySelector('#transcribe-input-lang')?.value.trim();

    this.isTranscribing = true;
    this.render();
    this.showToast(`Transcribing audio with ${model}...`, 'info');

    try {
      const res = await AvalAIApi.transcribeAudio({
        apiKey: activeKey.key,
        model,
        fileBase64: this.transcribeFile.base64,
        filename: this.transcribeFile.name || 'recording.wav',
        mime: this.transcribeFile.mime || 'audio/wav',
        language: language || undefined
      });

      this.isTranscribing = false;

      if (res.success && res.data) {
        this.transcriptionResult = res.data.text || JSON.stringify(res.data);
        this.render();
        this.showToast('Audio successfully transcribed!', 'success');
      } else {
        this.transcriptionResult = `Error (${res.status}): ${res.data?.message || res.statusText || 'Transcription failed'}`;
        this.render();
        this.showToast('Transcription failed: ' + (res.data?.message || res.statusText), 'error');
      }
    } catch (err) {
      this.isTranscribing = false;
      this.transcriptionResult = `Network Error: ${err.message}`;
      this.render();
      this.showToast('Error: ' + err.message, 'error');
    }
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
