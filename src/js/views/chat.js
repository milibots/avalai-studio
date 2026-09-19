// Chat Playground View with Live SSE Streaming, Reasoning, Multimedia & Voice, SQLite Sessions
import { store } from '../store.js';
import { Database } from '../db.js';
import { AvalAIApi } from '../api.js';
import { generateChatCode, generateResponsesCode } from '../utils/code-gen.js';
import { Icons } from '../utils/icons.js';

// Pre-seeded flagship chat models with rich capabilities
const DEFAULT_CHAT_MODELS = [
  { id: 'gpt-6-astra', name: 'OpenAI: GPT-6 Astra (Flagship)', supports_vision: true, supports_pdf_input: true, supports_reasoning: true, supports_web_search: true },
  { id: 'claude-fable-5-1', name: 'Anthropic: Claude Fable 5.1 (1M Context)', supports_vision: true, supports_pdf_input: true, supports_web_search: true },
  { id: 'gemini-3.8-flash', name: 'Google: Gemini 3.8 Flash (Audio & Vision)', supports_vision: true, supports_audio_input: true, supports_pdf_input: true, supports_web_search: true },
  { id: 'gpt-audio-mini', name: 'OpenAI: GPT Audio Mini (Spoken Voice)', supports_audio_input: true, supports_audio_output: true },
  { id: 'gpt-audio', name: 'OpenAI: GPT Audio (Flagship Voice)', supports_audio_input: true, supports_audio_output: true },
  { id: 'glm-5.3', name: 'Z.AI: GLM-5.3 (Reasoning)', supports_reasoning: true },
  { id: 'deepseek-v4-pro', name: 'DeepSeek: DeepSeek-V4-Pro (Thinking)', supports_reasoning: true },
  { id: 'qwen3.8-27b', name: 'Alibaba: Qwen3.8-27B (Vision)', supports_vision: true },
  { id: 'gpt-5.6-luna', name: 'OpenAI: GPT-5.6 Luna (Vision & Docs)', supports_vision: true, supports_pdf_input: true, supports_web_search: true },
  { id: 'gpt-5.4-mini', name: 'OpenAI: GPT-5.4 Mini', supports_vision: true },
  { id: 'claude-sonnet-5', name: 'Anthropic: Claude Sonnet 5', supports_vision: true, supports_pdf_input: true },
  { id: 'grok-4.5', name: 'xAI: Grok 4.5', supports_vision: true },
  { id: 'kimi-k3', name: 'Moonshot: Kimi K3 (Long Context)' },
  { id: 'mistral-large-3', name: 'Mistral: Mistral Large 3' }
];

export const ChatView = {
  async init(container, showToast) {
    this.container = container;
    this.showToast = showToast;
    this.sessions = [];
    this.currentSessionId = null;
    this.messages = [];
    this.selectedModel = 'gpt-6-astra';
    this.apiMode = 'chat'; // 'chat' or 'responses'
    this.temperature = 0.7;
    this.maxTokens = 4096;
    this.systemPrompt = 'You are a helpful, knowledgeable AI assistant.';
    this.webSearchEnabled = false;
    this.attachedMedia = []; // { type: 'image'|'audio'|'file', data: base64DataUrl, name, mime, size, duration }
    this.isStreaming = false;
    this.isWaitingFirstToken = false;
    this.activeStream = null;

    // Audio recording state
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingTimer = null;
    this.recordingDurationSec = 0;
    this.isRecording = false;

    // Load sessions from SQLite
    await this.loadSessions();
    this.render();

    store.subscribe(() => {
      this.updateModelSelector();
    });
  },

  getModelCapabilities(modelId) {
    const targetId = modelId || this.selectedModel;
    const cached = store.getCachedModels() || [];
    const found = cached.find(m => m.id === targetId) || DEFAULT_CHAT_MODELS.find(m => m.id === targetId);

    if (found) {
      return {
        supports_vision: Boolean(found.supports_vision),
        supports_audio_input: Boolean(found.supports_audio_input),
        supports_audio_output: Boolean(found.supports_audio_output),
        supports_pdf_input: Boolean(found.supports_pdf_input),
        supports_reasoning: Boolean(found.supports_reasoning),
        supports_web_search: Boolean(found.supports_web_search !== false)
      };
    }

    // Heuristics fallback
    const id = (targetId || '').toLowerCase();
    return {
      supports_vision: id.includes('vision') || id.includes('gpt-4o') || id.includes('gpt-5') || id.includes('gpt-6') || id.includes('claude') || id.includes('gemini') || id.includes('qwen') || id.includes('grok'),
      supports_audio_input: id.includes('audio') || id.includes('gemini-3') || id.includes('gemini-2.5'),
      supports_audio_output: id.includes('audio') || id.includes('tts'),
      supports_pdf_input: id.includes('gemini') || id.includes('claude') || id.includes('gpt-6') || id.includes('gpt-5.6'),
      supports_reasoning: id.includes('reason') || id.includes('deepseek') || id.includes('r1') || id.includes('o1') || id.includes('o3') || id.includes('glm') || id.includes('astra'),
      supports_web_search: !id.includes('audio') && !id.includes('image')
    };
  },

  getAllChatModels() {
    const cached = store.getCachedModels() || [];
    const chatModels = cached.filter(m => !m.mode || m.mode === 'chat');
    
    // Merge cached with default seed list to ensure zero empty dropdowns
    const map = new Map();
    DEFAULT_CHAT_MODELS.forEach(m => map.set(m.id, m));
    chatModels.forEach(m => {
      if (!map.has(m.id)) {
        map.set(m.id, {
          id: m.id,
          name: `${m.owned_by ? m.owned_by.toUpperCase() + ': ' : ''}${m.id}`,
          ...m
        });
      }
    });

    return Array.from(map.values());
  },

  async loadSessions() {
    try {
      this.sessions = await Database.getChatSessions();
      if (this.sessions.length === 0) {
        const defaultSession = await Database.createChatSession({
          id: 'sess_' + Date.now(),
          title: 'New Conversation',
          model: this.selectedModel,
          api_mode: this.apiMode,
          system_prompt: this.systemPrompt,
          temperature: this.temperature,
          max_tokens: this.maxTokens
        });
        this.sessions = [defaultSession];
        this.currentSessionId = defaultSession.id;
      } else if (!this.currentSessionId) {
        this.currentSessionId = this.sessions[0].id;
      }

      if (this.currentSessionId) {
        this.messages = await Database.getSessionMessages(this.currentSessionId);
      }
    } catch (err) {
      console.error('Failed to load chat sessions from SQLite:', err);
    }
  },

  async switchSession(sessionId) {
    this.currentSessionId = sessionId;
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      this.selectedModel = session.model || this.selectedModel;
      this.apiMode = session.api_mode || this.apiMode;
      this.systemPrompt = session.system_prompt !== undefined ? session.system_prompt : this.systemPrompt;
      this.temperature = session.temperature !== undefined ? session.temperature : this.temperature;
      this.maxTokens = session.max_tokens !== undefined ? session.max_tokens : this.maxTokens;
    }
    this.messages = await Database.getSessionMessages(sessionId);
    this.render();
  },

  async createNewSession() {
    const newSession = await Database.createChatSession({
      id: 'sess_' + Date.now(),
      title: 'New Conversation ' + (this.sessions.length + 1),
      model: this.selectedModel,
      api_mode: this.apiMode,
      system_prompt: this.systemPrompt,
      temperature: this.temperature,
      max_tokens: this.maxTokens
    });
    this.sessions.unshift(newSession);
    this.currentSessionId = newSession.id;
    this.messages = [];
    this.attachedMedia = [];
    this.render();
  },

  async deleteSession(sessionId) {
    await Database.deleteChatSession(sessionId);
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    if (this.currentSessionId === sessionId) {
      if (this.sessions.length > 0) {
        await this.switchSession(this.sessions[0].id);
      } else {
        await this.createNewSession();
      }
    } else {
      this.render();
    }
  },

  setModel(modelId) {
    this.selectedModel = modelId;
    const sel = this.container.querySelector('#select-chat-model');
    if (sel) sel.value = modelId;
    this.renderCapabilities();
  },

  renderCapabilities() {
    const bar = this.container.querySelector('#chat-capabilities-bar');
    if (!bar) return;
    const caps = this.getModelCapabilities(this.selectedModel);
    bar.innerHTML = `
      <span class="cap-badge ${caps.supports_vision ? 'active' : 'dimmed'}" title="${caps.supports_vision ? 'Vision Multimodal Input Supported' : 'No Vision'}">
        ${Icons.eye('svg-icon', 12)} Vision
      </span>
      <span class="cap-badge ${caps.supports_audio_input ? 'audio-active' : 'dimmed'}" title="${caps.supports_audio_input ? 'Native Spoken Voice Input Supported' : 'Voice handled via Whisper transcription'}">
        ${Icons.audio('svg-icon', 12)} Audio In
      </span>
      <span class="cap-badge ${caps.supports_audio_output ? 'audio-active' : 'dimmed'}" title="${caps.supports_audio_output ? 'Direct Spoken Voice Output Supported' : 'Text Output'}">
        ${Icons.volume2('svg-icon', 12)} Audio Out
      </span>
      <span class="cap-badge ${caps.supports_pdf_input ? 'active' : 'dimmed'}" title="${caps.supports_pdf_input ? 'PDF Document Processing Supported' : 'Plain Text'}">
        ${Icons.fileText('svg-icon', 12)} PDF/Doc
      </span>
      <span class="cap-badge ${caps.supports_reasoning ? 'reasoning-active' : 'dimmed'}" title="${caps.supports_reasoning ? 'Thinking/Reasoning Stream' : 'Direct Response'}">
        ${Icons.cpu('svg-icon', 12)} Reasoning
      </span>
      <span class="cap-badge ${caps.supports_web_search ? 'active' : 'dimmed'}" title="${caps.supports_web_search ? 'Integrated Real-time Web Search' : 'No Web Search'}">
        ${Icons.search('svg-icon', 12)} Web Search
      </span>
    `;
  },

  render() {
    const allModels = this.getAllChatModels();
    const caps = this.getModelCapabilities(this.selectedModel);

    this.container.innerHTML = `
      <div class="playground-layout">
        <!-- Sessions Sidebar (SQLite Backed) -->
        <div class="chat-sessions-sidebar">
          <button class="btn btn-primary btn-sm" id="btn-new-chat-session" style="width: 100%;">
            ${Icons.plus('svg-icon', 13)} New Chat
          </button>
          <div class="session-list">
            ${this.sessions.map(s => `
              <div class="session-item ${s.id === this.currentSessionId ? 'active' : ''}" data-id="${s.id}">
                <span class="session-title-text" title="${s.title}">${s.title}</span>
                <span class="session-delete-btn" data-id="${s.id}" title="Delete conversation">&times;</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Main Chat Panel -->
        <div class="chat-main">
          <!-- Chat Header -->
          <div class="chat-header">
            <div class="chat-model-indicator" style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <select class="form-select" id="select-chat-model" style="font-weight: 700; min-width: 280px;">
                  ${allModels.map(m => `
                    <option value="${m.id}" ${m.id === this.selectedModel ? 'selected' : ''}>
                      ${m.name || m.id}
                    </option>
                  `).join('')}
                </select>

                <div style="display: flex; gap: 4px; background: var(--bg-base); padding: 3px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <button class="btn btn-sm ${this.apiMode === 'chat' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-chat">/v1/chat</button>
                  <button class="btn btn-sm ${this.apiMode === 'responses' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-responses">/v1/responses</button>
                </div>
              </div>

              <!-- Dynamic Model Capabilities Bar -->
              <div class="chat-capabilities-bar" id="chat-capabilities-bar">
                <span class="cap-badge ${caps.supports_vision ? 'active' : 'dimmed'}" title="${caps.supports_vision ? 'Vision Multimodal Input Supported' : 'No Vision'}">
                  ${Icons.eye('svg-icon', 12)} Vision
                </span>
                <span class="cap-badge ${caps.supports_audio_input ? 'audio-active' : 'dimmed'}" title="${caps.supports_audio_input ? 'Native Spoken Voice Input Supported' : 'Voice handled via Whisper transcription'}">
                  ${Icons.audio('svg-icon', 12)} Audio In
                </span>
                <span class="cap-badge ${caps.supports_audio_output ? 'audio-active' : 'dimmed'}" title="${caps.supports_audio_output ? 'Direct Spoken Voice Output Supported' : 'Text Output'}">
                  ${Icons.volume2('svg-icon', 12)} Audio Out
                </span>
                <span class="cap-badge ${caps.supports_pdf_input ? 'active' : 'dimmed'}" title="${caps.supports_pdf_input ? 'PDF Document Processing Supported' : 'Plain Text'}">
                  ${Icons.fileText('svg-icon', 12)} PDF/Doc
                </span>
                <span class="cap-badge ${caps.supports_reasoning ? 'reasoning-active' : 'dimmed'}" title="${caps.supports_reasoning ? 'Thinking/Reasoning Stream' : 'Direct Response'}">
                  ${Icons.cpu('svg-icon', 12)} Reasoning
                </span>
                <span class="cap-badge ${caps.supports_web_search ? 'active' : 'dimmed'}" title="${caps.supports_web_search ? 'Integrated Real-time Web Search' : 'No Web Search'}">
                  ${Icons.search('svg-icon', 12)} Web Search
                </span>
              </div>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" id="btn-export-code" title="Export Code">
                ${Icons.code('svg-icon', 13)} View Code
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-clear-chat" title="Clear Conversation">
                ${Icons.trash('svg-icon', 13)} Clear
              </button>
            </div>
          </div>

          <!-- Chat Messages Area -->
          <div class="chat-messages" id="chat-messages-box">
            ${this.messages.length === 0 ? `
              <div class="chat-welcome">
                <div class="chat-welcome-icon">${Icons.chat('svg-icon', 26)}</div>
                <h3 style="font-size: 17px; font-weight: 700;">AvalAI Playground</h3>
                <p style="max-width: 480px; font-size: 13px; line-height: 1.6;">
                  Test any AvalAI model with real-time SSE streaming, voice recording & Whisper transcription, native spoken audio responses, and multimodal file attachments.
                </p>
              </div>
            ` : this.renderMessages()}

            ${this.isWaitingFirstToken ? `
              <div class="message-row assistant" id="skeleton-assistant-loading">
                <div class="message-avatar">${Icons.bot('svg-icon', 16)}</div>
                <div class="message-content-wrapper" style="width: 280px;">
                  <div class="message-bubble" style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="skeleton skeleton-text" style="width: 85%;"></div>
                    <div class="skeleton skeleton-text" style="width: 55%;"></div>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Chat Input Area with Rich Attachments -->
          <div class="chat-input-area">
            ${this.attachedMedia.length > 0 ? `
              <div class="input-attachments-preview">
                ${this.attachedMedia.map((m, idx) => `
                  <div class="attachment-chip">
                    ${m.type === 'image' ? `
                      <img src="${m.data}" class="attachment-chip-thumb" />
                      <span>${m.name || 'Image'}</span>
                    ` : m.type === 'audio' ? `
                      <span class="attachment-chip-audio">${Icons.audio('svg-icon', 12)} ${m.name || 'Voice Note'}</span>
                      <audio src="${m.data}" controls style="height: 24px; max-width: 140px;"></audio>
                    ` : `
                      <span>${Icons.fileText('svg-icon', 12)} ${m.name || 'Document'}</span>
                    `}
                    <span class="attachment-chip-remove" data-idx="${idx}" title="Remove attachment">&times;</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div class="chat-input-controls">
              <textarea class="chat-textarea" id="chat-prompt-input" placeholder="Type your prompt... (Press Enter to send, Shift+Enter for newline)" rows="1"></textarea>
              
              <div class="chat-action-buttons">
                <!-- Hidden inputs -->
                <input type="file" id="input-chat-image" accept="image/*" style="display: none;" />
                <input type="file" id="input-chat-file" accept=".pdf,.txt,.md,.json,.csv,audio/*" style="display: none;" />

                <!-- Attachment triggers -->
                <button class="btn btn-secondary btn-sm btn-icon-only" id="btn-attach-image" title="Attach Vision Image">
                  ${Icons.images('svg-icon', 15)}
                </button>
                <button class="btn btn-secondary btn-sm btn-icon-only" id="btn-attach-file" title="Attach Document (PDF, TXT, Audio)">
                  ${Icons.paperclip('svg-icon', 15)}
                </button>

                <!-- Voice Recording Button -->
                <button class="btn btn-secondary btn-sm" id="btn-chat-speak" title="Speak to Model (Voice Recording & Whisper Transcription)">
                  ${Icons.audio('svg-icon', 14)} Speak
                </button>

                <!-- Send Button -->
                <button class="btn btn-primary btn-sm" id="btn-chat-send" style="padding: 8px 16px;">
                  Send ${Icons.send('svg-icon', 12)}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Parameters Sidebar -->
        <div class="chat-params-sidebar">
          <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted);">
            Parameters & Tools
          </h3>

          <div class="form-group">
            <label class="form-label">System / Developer Instructions</label>
            <textarea class="form-textarea" id="input-system-prompt" style="font-size: 12px; min-height: 90px;">${this.systemPrompt}</textarea>
          </div>

          <div class="param-slider-group">
            <div class="param-slider-header">
              <span>Temperature</span>
              <span class="param-slider-value" id="val-temperature">${this.temperature}</span>
            </div>
            <input type="range" id="slider-temperature" min="0" max="2" step="0.05" value="${this.temperature}" />
          </div>

          <div class="param-slider-group">
            <div class="param-slider-header">
              <span>Max Tokens</span>
              <span class="param-slider-value" id="val-max-tokens">${this.maxTokens}</span>
            </div>
            <input type="range" id="slider-max-tokens" min="256" max="16384" step="256" value="${this.maxTokens}" />
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-web-search" ${this.webSearchEnabled ? 'checked' : ''} />
              <span style="font-weight: 600; font-size: 13px;">Enable Web Search Tool</span>
            </label>
            <span style="font-size: 11px; color: var(--text-muted);">
              Uses AvalAI integrated search engine to fetch up-to-date web facts.
            </span>
          </div>

          <div class="card" style="padding: 14px; margin-top: auto; font-size: 11px; color: var(--text-muted);">
            <div style="font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">SQLite Persistence & Multimedia</div>
            <div>Chat Saved in: <strong>avalai_vault.sqlite</strong></div>
            <div style="margin-top: 4px;">Protocol: <strong>${this.apiMode === 'chat' ? '/v1/chat/completions' : '/v1/responses'}</strong></div>
            <div style="margin-top: 4px;">Audio Engine: <strong>Whisper-1 & GPT-Audio</strong></div>
          </div>
        </div>
      </div>

      <!-- Code Snippet Modal -->
      <div class="modal-overlay" id="modal-code-snippet">
        <div class="modal-dialog" style="max-width: 680px;">
          <div class="modal-header">
            <h3 class="modal-title">Export Runnable Code</h3>
            <button class="btn btn-secondary btn-sm btn-icon-only modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="tab-bar">
              <button class="tab-btn active" id="tab-code-python">Python (OpenAI SDK)</button>
              <button class="tab-btn" id="tab-code-js">JavaScript (OpenAI SDK)</button>
              <button class="tab-btn" id="tab-code-curl">cURL (Bash)</button>
            </div>
            <pre style="background: var(--bg-base); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); overflow-x: auto; font-family: var(--font-mono); font-size: 12px; color: #a5b4fc; max-height: 380px; user-select: text;" id="code-snippet-pre"></pre>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary modal-close">Close</button>
            <button class="btn btn-primary" id="btn-copy-snippet">
              ${Icons.copy('svg-icon', 14)} Copy Code
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.scrollToBottom();
  },

  renderMessages() {
    return this.messages.map(m => {
      const isUser = m.role === 'user';
      const mediaList = m.media || m.images || [];

      return `
        <div class="message-row ${isUser ? 'user' : 'assistant'}">
          <div class="message-avatar">
            ${isUser ? Icons.user('svg-icon', 15) : Icons.bot('svg-icon', 15)}
          </div>
          <div class="message-content-wrapper">
            <!-- Render User Media Attachments -->
            ${mediaList.length > 0 ? `
              <div class="message-images">
                ${mediaList.map(item => {
                  if (typeof item === 'string') {
                    return `<img src="${item}" class="message-img-preview" />`;
                  } else if (item.type === 'image') {
                    return `<img src="${item.data}" class="message-img-preview" />`;
                  } else if (item.type === 'audio') {
                    return `
                      <div class="message-audio-player">
                        <div style="font-size: 11px; font-weight: 600; color: var(--accent-cyan); margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
                          ${Icons.audio('svg-icon', 12)}
                          <span>${item.name || 'User Voice Note'}</span>
                        </div>
                        <audio controls src="${item.data}"></audio>
                      </div>
                    `;
                  } else if (item.type === 'file') {
                    return `
                      <div class="attachment-chip">
                        ${Icons.fileText('svg-icon', 12)}
                        <span>${item.name || 'Document'}</span>
                      </div>
                    `;
                  }
                  return '';
                }).join('')}
              </div>
            ` : ''}

            <!-- Reasoning / Thinking Process Collapsible -->
            ${m.thinking ? `
              <div class="thinking-box">
                <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
                  <div class="thinking-indicator">
                    <span class="thinking-pulse"></span>
                    <span>Reasoning Process</span>
                  </div>
                  <span>${Icons.chevronDown('svg-icon', 12)}</span>
                </div>
                <div class="thinking-content">${this.escapeHtml(m.thinking)}</div>
              </div>
            ` : ''}

            <!-- Spoken Audio Response from Assistant -->
            ${m.audio ? `
              <div class="message-audio-player">
                <div style="font-size: 11px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                  ${Icons.volume2('svg-icon', 13)}
                  <span>Spoken Voice Response (${m.audio.voice || 'alloy'})</span>
                </div>
                <audio controls autoplay src="${m.audio.data?.startsWith('data:') ? m.audio.data : 'data:audio/wav;base64,' + m.audio.data}"></audio>
              </div>
            ` : ''}

            <div class="message-bubble">
              ${this.formatMessageContent(m.content)}
            </div>

            ${m.meta ? `
              <div class="message-meta">
                <span class="meta-item">${Icons.audit('svg-icon', 11)} ${m.meta.latencyMs}ms</span>
                ${m.meta.serverMs ? `<span class="meta-item">${Icons.sparkles('svg-icon', 11)} Server: ${m.meta.serverMs}ms</span>` : ''}
                ${m.meta.requestId ? `
                  <span class="meta-item meta-id-copy" data-id="${m.meta.requestId}" title="Click to copy Request ID">
                    ${Icons.key('svg-icon', 11)} ${m.meta.requestId.slice(0, 8)}...
                  </span>
                ` : ''}
                ${m.meta.model ? `<span class="badge badge-muted">${m.meta.model}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  formatMessageContent(content) {
    if (!content) {
      return `
        <div style="display: flex; flex-direction: column; gap: 8px; width: 200px; padding: 4px 0;">
          <div class="skeleton skeleton-text" style="width: 90%; height: 14px;"></div>
          <div class="skeleton skeleton-text" style="width: 60%; height: 14px;"></div>
        </div>
      `;
    }
    let escaped = this.escapeHtml(content);
    escaped = escaped.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre style="background: var(--bg-surface-active); padding: 12px; border-radius: 8px; border: 1px solid var(--border-medium); margin: 8px 0; overflow-x: auto; font-family: var(--font-mono); font-size: 12px; user-select: text;"><code>${code}</code></pre>`;
    });
    escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: var(--bg-surface-hover); padding: 2px 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 12px;">$1</code>');
    return escaped.replace(/\n/g, '<br/>');
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  scrollToBottom() {
    const box = this.container.querySelector('#chat-messages-box');
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  },

  updateModelSelector() {
    const sel = this.container.querySelector('#select-chat-model');
    if (sel && this.selectedModel) {
      sel.value = this.selectedModel;
      this.renderCapabilities();
    }
  },

  bindEvents() {
    // Session sidebar events
    this.container.querySelector('#btn-new-chat-session')?.addEventListener('click', () => {
      this.createNewSession();
    });

    this.container.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('session-delete-btn')) return;
        const sessId = item.getAttribute('data-id');
        this.switchSession(sessId);
      });
    });

    this.container.querySelectorAll('.session-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessId = btn.getAttribute('data-id');
        if (confirm('Delete this conversation?')) {
          this.deleteSession(sessId);
        }
      });
    });

    // Model Select
    const modelSelect = this.container.querySelector('#select-chat-model');
    modelSelect?.addEventListener('change', (e) => {
      this.selectedModel = e.target.value;
      this.renderCapabilities();
      if (this.currentSessionId) {
        Database.updateChatSession(this.currentSessionId, { model: this.selectedModel });
      }
    });

    // API Mode Buttons
    const btnModeChat = this.container.querySelector('#btn-mode-chat');
    const btnModeResponses = this.container.querySelector('#btn-mode-responses');
    btnModeChat?.addEventListener('click', () => {
      this.apiMode = 'chat';
      if (this.currentSessionId) Database.updateChatSession(this.currentSessionId, { api_mode: 'chat' });
      this.render();
    });
    btnModeResponses?.addEventListener('click', () => {
      this.apiMode = 'responses';
      if (this.currentSessionId) Database.updateChatSession(this.currentSessionId, { api_mode: 'responses' });
      this.render();
    });

    // Sliders
    const tempSlider = this.container.querySelector('#slider-temperature');
    const tempVal = this.container.querySelector('#val-temperature');
    tempSlider?.addEventListener('input', (e) => {
      this.temperature = parseFloat(e.target.value);
      if (tempVal) tempVal.textContent = this.temperature;
      if (this.currentSessionId) Database.updateChatSession(this.currentSessionId, { temperature: this.temperature });
    });

    const maxSlider = this.container.querySelector('#slider-max-tokens');
    const maxVal = this.container.querySelector('#val-max-tokens');
    maxSlider?.addEventListener('input', (e) => {
      this.maxTokens = parseInt(e.target.value, 10);
      if (maxVal) maxVal.textContent = this.maxTokens;
      if (this.currentSessionId) Database.updateChatSession(this.currentSessionId, { max_tokens: this.maxTokens });
    });

    // System prompt
    const sysPrompt = this.container.querySelector('#input-system-prompt');
    sysPrompt?.addEventListener('change', (e) => {
      this.systemPrompt = e.target.value;
      if (this.currentSessionId) Database.updateChatSession(this.currentSessionId, { system_prompt: this.systemPrompt });
    });

    // Web Search Checkbox
    const chkWeb = this.container.querySelector('#chk-web-search');
    chkWeb?.addEventListener('change', (e) => {
      this.webSearchEnabled = e.target.checked;
    });

    // Clear Chat
    this.container.querySelector('#btn-clear-chat')?.addEventListener('click', async () => {
      if (confirm('Clear all conversation messages in this session?')) {
        if (this.currentSessionId) {
          await Database.run('DELETE FROM chat_messages WHERE session_id = ?;', [this.currentSessionId]);
        }
        this.messages = [];
        this.render();
      }
    });

    // Send Button & Enter key
    const sendBtn = this.container.querySelector('#btn-chat-send');
    const textarea = this.container.querySelector('#chat-prompt-input');

    sendBtn?.addEventListener('click', () => this.sendMessage());
    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Image Attachment Trigger
    const imgInput = this.container.querySelector('#input-chat-image');
    const attachImgBtn = this.container.querySelector('#btn-attach-image');
    attachImgBtn?.addEventListener('click', () => imgInput?.click());
    imgInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.processFile(file, 'image');
    });

    // Document & File Attachment Trigger
    const fileInput = this.container.querySelector('#input-chat-file');
    const attachFileBtn = this.container.querySelector('#btn-attach-file');
    attachFileBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.type.startsWith('image/')) {
          this.processFile(file, 'image');
        } else if (file.type.startsWith('audio/')) {
          this.processFile(file, 'audio');
        } else {
          this.processFile(file, 'file');
        }
      }
    });

    // Microphone Voice Recording Button
    const speakBtn = this.container.querySelector('#btn-chat-speak');
    speakBtn?.addEventListener('click', () => this.toggleVoiceRecording());

    // Remove Attachment Chip
    this.container.querySelectorAll('.attachment-chip-remove').forEach(chip => {
      chip.addEventListener('click', () => {
        const idx = parseInt(chip.getAttribute('data-idx'), 10);
        this.attachedMedia.splice(idx, 1);
        this.render();
      });
    });

    // Copy Request ID
    this.container.querySelectorAll('.meta-id-copy').forEach(el => {
      el.addEventListener('click', () => {
        const reqId = el.getAttribute('data-id');
        navigator.clipboard.writeText(reqId);
        this.showToast(`Request ID copied: ${reqId}`, 'info');
      });
    });

    // Code Snippet Export Modal
    this.setupCodeModal();
  },

  async toggleVoiceRecording() {
    if (this.isRecording) {
      this.stopVoiceRecording();
    } else {
      await this.startVoiceRecording();
    }
  },

  async startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : {};

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        clearInterval(this.recordingTimer);
        this.isRecording = false;
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());

        await this.handleRecordedAudio(audioBlob, mimeType, this.recordingDurationSec);
      };

      this.mediaRecorder.start(250);
      this.isRecording = true;
      this.recordingDurationSec = 0;

      const speakBtn = this.container.querySelector('#btn-chat-speak');
      if (speakBtn) {
        speakBtn.classList.add('btn-recording');
        speakBtn.innerHTML = `${Icons.stop('svg-icon', 12)} 00:00`;
      }

      this.recordingTimer = setInterval(() => {
        this.recordingDurationSec++;
        const mins = String(Math.floor(this.recordingDurationSec / 60)).padStart(2, '0');
        const secs = String(this.recordingDurationSec % 60).padStart(2, '0');
        if (speakBtn) {
          speakBtn.innerHTML = `${Icons.stop('svg-icon', 12)} ${mins}:${secs}`;
        }
      }, 1000);

      this.showToast('Recording voice... Speak clearly. Click again when done.', 'info');
    } catch (err) {
      console.error('Microphone recording error:', err);
      this.showToast('Microphone access unavailable: ' + err.message, 'error');
    }
  },

  stopVoiceRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    clearInterval(this.recordingTimer);
    this.isRecording = false;

    const speakBtn = this.container.querySelector('#btn-chat-speak');
    if (speakBtn) {
      speakBtn.classList.remove('btn-recording');
      speakBtn.innerHTML = `${Icons.audio('svg-icon', 14)} Speak`;
    }
  },

  async handleRecordedAudio(blob, mimeType, durationSec) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64DataUrl = reader.result;
      const mins = Math.floor(durationSec / 60);
      const secs = String(durationSec % 60).padStart(2, '0');
      const durStr = `${mins}:${secs}`;

      // Attach audio chip to input
      this.attachedMedia.push({
        type: 'audio',
        data: base64DataUrl,
        name: `Voice Note (${durStr})`,
        mime: mimeType,
        duration: durStr
      });
      this.render();

      // Automatically transcribe with Whisper-1 to also fill the prompt text
      const activeKey = store.getActiveKey();
      if (activeKey) {
        this.showToast('Transcribing voice with Whisper-1...', 'info');
        try {
          const transRes = await AvalAIApi.transcribeAudio({
            apiKey: activeKey.key,
            model: 'whisper-1',
            fileBase64: base64DataUrl,
            filename: 'recording.wav',
            mime: 'audio/wav'
          });

          if (transRes.success && transRes.data?.text) {
            const textarea = this.container.querySelector('#chat-prompt-input');
            if (textarea) {
              const current = textarea.value.trim();
              textarea.value = current ? `${current} ${transRes.data.text}` : transRes.data.text;
            }
            this.showToast(`Transcribed: "${transRes.data.text.slice(0, 45)}..."`, 'success');
          }
        } catch (err) {
          console.warn('Whisper auto-transcription warning:', err);
        }
      }
    };
    reader.readAsDataURL(blob);
  },

  processFile(file, type) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.attachedMedia.push({
        type,
        data: e.target.result,
        name: file.name,
        mime: file.type,
        size: Math.round(file.size / 1024) + ' KB'
      });
      this.render();
    };
    reader.readAsDataURL(file);
  },

  setupCodeModal() {
    const modal = this.container.querySelector('#modal-code-snippet');
    const openBtn = this.container.querySelector('#btn-export-code');
    const closeBtns = modal?.querySelectorAll('.modal-close');
    const pre = this.container.querySelector('#code-snippet-pre');
    const copyBtn = this.container.querySelector('#btn-copy-snippet');

    let currentSnippetType = 'python';

    const updateSnippet = () => {
      const activeKey = store.getActiveKey()?.key || 'YOUR_AVALAI_KEY';
      const promptMessages = this.buildChatMessages();

      let snippets;
      if (this.apiMode === 'responses') {
        snippets = generateResponsesCode({
          model: this.selectedModel,
          input: this.messages[this.messages.length - 2]?.content || 'Hello, world!',
          instructions: this.systemPrompt,
          apiKey: activeKey
        });
      } else {
        snippets = generateChatCode({
          model: this.selectedModel,
          messages: promptMessages.length ? promptMessages : [{ role: 'user', content: 'Hello!' }],
          temperature: this.temperature,
          maxTokens: this.maxTokens,
          stream: true,
          apiKey: activeKey
        });
      }

      if (pre) {
        pre.textContent = snippets[currentSnippetType] || '';
      }
    };

    openBtn?.addEventListener('click', () => {
      updateSnippet();
      modal?.classList.add('active');
    });

    closeBtns?.forEach(b => b.addEventListener('click', () => modal?.classList.remove('active')));

    const tabPy = this.container.querySelector('#tab-code-python');
    const tabJs = this.container.querySelector('#tab-code-js');
    const tabCurl = this.container.querySelector('#tab-code-curl');

    const switchTab = (tab, type) => {
      [tabPy, tabJs, tabCurl].forEach(t => t?.classList.remove('active'));
      tab?.classList.add('active');
      currentSnippetType = type;
      updateSnippet();
    };

    tabPy?.addEventListener('click', () => switchTab(tabPy, 'python'));
    tabJs?.addEventListener('click', () => switchTab(tabJs, 'javascript'));
    tabCurl?.addEventListener('click', () => switchTab(tabCurl, 'curl'));

    copyBtn?.addEventListener('click', () => {
      if (pre?.textContent) {
        navigator.clipboard.writeText(pre.textContent);
        this.showToast('Code snippet copied to clipboard!', 'success');
      }
    });
  },

  buildChatMessages() {
    const formatted = [];
    if (this.systemPrompt) {
      formatted.push({ role: 'system', content: this.systemPrompt });
    }

    for (const m of this.messages) {
      const mediaList = m.media || m.images || [];
      if (mediaList.length > 0) {
        const contentParts = [];
        if (m.content) {
          contentParts.push({ type: 'text', text: m.content });
        }

        for (const item of mediaList) {
          if (typeof item === 'string') {
            contentParts.push({ type: 'image_url', image_url: { url: item } });
          } else if (item.type === 'image') {
            contentParts.push({ type: 'image_url', image_url: { url: item.data } });
          } else if (item.type === 'audio') {
            const cleanB64 = (item.data || '').replace(/^data:[^;]+;base64,/, '');
            contentParts.push({
              type: 'input_audio',
              input_audio: {
                data: cleanB64,
                format: 'wav'
              }
            });
          } else if (item.type === 'file') {
            contentParts.push({
              type: 'image_url',
              image_url: { url: item.data }
            });
          }
        }
        formatted.push({ role: m.role, content: contentParts });
      } else {
        formatted.push({ role: m.role, content: m.content || '' });
      }
    }
    return formatted;
  },

  async sendMessage() {
    const textarea = this.container.querySelector('#chat-prompt-input');
    const prompt = textarea?.value.trim();
    if (!prompt && this.attachedMedia.length === 0) return;

    const activeKey = store.getActiveKey();
    if (!activeKey) {
      this.showToast('Please select or add an active AvalAI API key first.', 'error');
      return;
    }

    const caps = this.getModelCapabilities(this.selectedModel);

    // Add user message
    const userMsg = {
      id: 'msg_' + Date.now(),
      session_id: this.currentSessionId,
      role: 'user',
      content: prompt,
      media: [...this.attachedMedia],
      images: [...this.attachedMedia] // backward compatible with SQLite column
    };
    this.messages.push(userMsg);
    await Database.addChatMessage(userMsg);

    // Auto-update session title from first prompt
    if (this.messages.length === 1 && prompt) {
      const shortTitle = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
      await Database.updateChatSession(this.currentSessionId, { title: shortTitle });
      const current = this.sessions.find(s => s.id === this.currentSessionId);
      if (current) current.title = shortTitle;
    }

    this.attachedMedia = [];
    if (textarea) textarea.value = '';

    // Create placeholder assistant message
    const assistantMsg = {
      id: 'msg_' + (Date.now() + 1),
      session_id: this.currentSessionId,
      role: 'assistant',
      content: '',
      thinking: '',
      audio: null,
      meta: null
    };
    this.messages.push(assistantMsg);

    this.isWaitingFirstToken = true;
    this.render();
    this.scrollToBottom();

    const startTime = Date.now();

    if (this.apiMode === 'responses') {
      try {
        const res = await AvalAIApi.responses({
          apiKey: activeKey.key,
          model: this.selectedModel,
          input: prompt,
          instructions: this.systemPrompt
        });

        this.isWaitingFirstToken = false;
        const latency = Date.now() - startTime;
        if (res.success && res.data) {
          assistantMsg.content = res.data.output_text || res.data.output?.[0]?.content?.[0]?.text || JSON.stringify(res.data);
          assistantMsg.meta = {
            latencyMs: latency,
            serverMs: res.serverLatencyMs,
            requestId: res.requestId,
            model: this.selectedModel
          };
        } else {
          assistantMsg.content = `AvalAI API Error (${res.status}): ${res.data?.message || res.statusText || 'Unknown error'}`;
        }
        await Database.addChatMessage(assistantMsg);
      } catch (err) {
        this.isWaitingFirstToken = false;
        assistantMsg.content = `Network Error: ${err.message}`;
      }
      this.render();
      this.scrollToBottom();
    } else {
      const formattedMessages = this.buildChatMessages();
      formattedMessages.pop(); // remove empty assistant placeholder

      this.isStreaming = true;
      let lastRequestId = null;
      let lastProcessingMs = null;
      let accumulatedAudioBase64 = '';

      const streamOptions = {
        apiKey: activeKey.key,
        model: this.selectedModel,
        messages: formattedMessages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        web_search: this.webSearchEnabled,
        onHeaders: (headersData) => {
          lastRequestId = headersData.requestId;
          lastProcessingMs = headersData.processingMs;
        },
        onChunk: ({ data, raw, done }) => {
          if (done) return;
          if (this.isWaitingFirstToken) {
            this.isWaitingFirstToken = false;
            const skel = this.container.querySelector('#skeleton-assistant-loading');
            if (skel) skel.remove();
          }

          if (data && data.choices && data.choices[0]?.delta) {
            const delta = data.choices[0].delta;
            if (delta.reasoning_content) {
              assistantMsg.thinking += delta.reasoning_content;
            }
            if (delta.content) {
              assistantMsg.content += delta.content;
            }
            if (delta.audio?.data) {
              accumulatedAudioBase64 += delta.audio.data;
            }
            if (delta.audio?.transcript) {
              if (!assistantMsg.content) assistantMsg.content += delta.audio.transcript;
            }
            this.updateLiveAssistantBubble(assistantMsg);
          }
        },
        onEnd: async () => {
          this.isStreaming = false;
          this.isWaitingFirstToken = false;
          
          if (accumulatedAudioBase64) {
            assistantMsg.audio = {
              data: accumulatedAudioBase64,
              format: 'wav',
              voice: 'alloy'
            };
          }

          assistantMsg.meta = {
            latencyMs: Date.now() - startTime,
            serverMs: lastProcessingMs,
            requestId: lastRequestId,
            model: this.selectedModel
          };
          await Database.addChatMessage(assistantMsg);
          this.render();
          this.scrollToBottom();
        },
        onError: (err) => {
          this.isStreaming = false;
          this.isWaitingFirstToken = false;
          assistantMsg.content += `\nStream Error: ${err.error || 'Connection failed'}`;
          this.render();
          this.scrollToBottom();
        }
      };

      // Enable spoken audio output if model supports it
      if (caps.supports_audio_output) {
        streamOptions.modalities = ['text', 'audio'];
        streamOptions.audio = { voice: 'alloy', format: 'wav' };
      }

      this.activeStream = AvalAIApi.streamChatCompletion(streamOptions);
    }
  },

  updateLiveAssistantBubble(msg) {
    const messageRows = this.container.querySelectorAll('.message-row.assistant');
    const lastRow = messageRows[messageRows.length - 1];
    if (lastRow) {
      const bubble = lastRow.querySelector('.message-bubble');
      if (bubble) {
        bubble.innerHTML = this.formatMessageContent(msg.content);
      }
      const thinkingBox = lastRow.querySelector('.thinking-box');
      if (msg.thinking && !thinkingBox) {
        this.render();
      } else if (thinkingBox) {
        const content = thinkingBox.querySelector('.thinking-content');
        if (content) content.textContent = msg.thinking;
      }
      this.scrollToBottom();
    }
  }
};
