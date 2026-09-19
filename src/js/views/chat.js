// Chat Playground View with Live SSE Streaming, Reasoning, SQLite Sessions, and Skeletons
import { store } from '../store.js';
import { Database } from '../db.js';
import { AvalAIApi } from '../api.js';
import { generateChatCode, generateResponsesCode } from '../utils/code-gen.js';

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
    this.attachedImages = []; // base64 images
    this.isStreaming = false;
    this.isWaitingFirstToken = false;
    this.activeStream = null;

    // Load sessions from SQLite
    await this.loadSessions();
    this.render();

    store.subscribe(() => {
      this.updateModelSelector();
    });
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

      // Load messages for active session
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
  },

  render() {
    this.container.innerHTML = `
      <div class="playground-layout">
        <!-- Sessions Sidebar (SQLite Backed) -->
        <div class="chat-sessions-sidebar">
          <button class="btn btn-primary btn-sm" id="btn-new-chat-session" style="width: 100%;">
            + New Chat
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
            <div class="chat-model-indicator">
              <select class="form-select" id="select-chat-model" style="font-weight: 700;">
                <option value="gpt-6-astra">OpenAI: GPT-6 Astra (Flagship)</option>
                <option value="claude-fable-5-1">Anthropic: Claude Fable 5.1 (1M Context)</option>
                <option value="gemini-3.8-flash">Google: Gemini 3.8 Flash</option>
                <option value="glm-5.3">Z.AI: GLM-5.3 (Reasoning)</option>
                <option value="deepseek-v4-pro">DeepSeek: DeepSeek-V4-Pro</option>
                <option value="qwen3.8-27b">Alibaba: Qwen3.8-27B</option>
                <option value="gpt-5.6-luna">OpenAI: GPT-5.6 Luna</option>
                <option value="grok-4.5">xAI: Grok 4.5</option>
                <option value="kimi-k3">Moonshot: Kimi K3</option>
                <option value="mistral-large-3">Mistral: Mistral Large 3</option>
              </select>

              <div style="display: flex; gap: 4px; background: var(--bg-base); padding: 3px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                <button class="btn btn-sm ${this.apiMode === 'chat' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-chat">/v1/chat</button>
                <button class="btn btn-sm ${this.apiMode === 'responses' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-responses">/v1/responses</button>
              </div>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" id="btn-export-code" title="Export Code">
                📄 View Code
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-clear-chat" title="Clear Conversation">
                🗑️ Clear
              </button>
            </div>
          </div>

          <!-- Chat Messages Area -->
          <div class="chat-messages" id="chat-messages-box">
            ${this.messages.length === 0 ? `
              <div class="chat-welcome">
                <div class="chat-welcome-icon">💬</div>
                <h3 style="font-size: 18px; font-weight: 700;">AvalAI Playground</h3>
                <p style="max-width: 480px; font-size: 13px;">
                  Test any AvalAI model with real-time token streaming, thinking/reasoning token inspection, image attachments, and tool calling.
                </p>
              </div>
            ` : this.renderMessages()}

            ${this.isWaitingFirstToken ? `
              <div class="message-row assistant" id="skeleton-assistant-loading">
                <div class="message-avatar">⚡</div>
                <div class="message-content-wrapper" style="width: 280px;">
                  <div class="message-bubble" style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="skeleton skeleton-text" style="width: 85%;"></div>
                    <div class="skeleton skeleton-text" style="width: 55%;"></div>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Chat Input Area -->
          <div class="chat-input-area">
            ${this.attachedImages.length > 0 ? `
              <div class="input-attachments-preview">
                ${this.attachedImages.map((img, idx) => `
                  <div class="attachment-chip">
                    <span>🖼️ Image ${idx + 1}</span>
                    <span class="attachment-chip-remove" data-idx="${idx}">&times;</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div class="chat-input-controls">
              <textarea class="chat-textarea" id="chat-prompt-input" placeholder="Type your prompt... (Press Enter to send, Shift+Enter for newline)" rows="1"></textarea>
              <div class="chat-action-buttons">
                <input type="file" id="input-chat-file" accept="image/*" style="display: none;" />
                <button class="btn btn-secondary btn-sm btn-icon-only" id="btn-attach-image" title="Attach Vision Image">
                  🖼️
                </button>
                <button class="btn btn-primary btn-sm" id="btn-chat-send" style="padding: 8px 16px;">
                  Send 🚀
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
            <div style="font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">SQLite Persistence</div>
            <div>Chat Saved in: <strong>avalai_vault.sqlite</strong></div>
            <div style="margin-top: 4px;">Protocol: <strong>${this.apiMode === 'chat' ? '/v1/chat/completions' : '/v1/responses'}</strong></div>
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
            <button class="btn btn-primary" id="btn-copy-snippet">📋 Copy Code</button>
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
      return `
        <div class="message-row ${isUser ? 'user' : 'assistant'}">
          <div class="message-avatar">
            ${isUser ? '👤' : '⚡'}
          </div>
          <div class="message-content-wrapper">
            ${m.images && m.images.length > 0 ? `
              <div class="message-images">
                ${m.images.map(img => `<img src="${img}" class="message-img-preview" />`).join('')}
              </div>
            ` : ''}

            ${m.thinking ? `
              <div class="thinking-box">
                <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
                  <div class="thinking-indicator">
                    <span class="thinking-pulse"></span>
                    <span>Reasoning Process</span>
                  </div>
                  <span>▾</span>
                </div>
                <div class="thinking-content">${this.escapeHtml(m.thinking)}</div>
              </div>
            ` : ''}

            <div class="message-bubble">
              ${this.formatMessageContent(m.content)}
            </div>

            ${m.meta ? `
              <div class="message-meta">
                <span class="meta-item">⏱️ ${m.meta.latencyMs}ms</span>
                ${m.meta.serverMs ? `<span class="meta-item">⚡ Server: ${m.meta.serverMs}ms</span>` : ''}
                ${m.meta.requestId ? `
                  <span class="meta-item meta-id-copy" data-id="${m.meta.requestId}" title="Click to copy Request ID">
                    🆔 ${m.meta.requestId.slice(0, 8)}...
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

    // Image Attachment
    const fileInput = this.container.querySelector('#input-chat-file');
    const attachBtn = this.container.querySelector('#btn-attach-image');

    attachBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          this.attachedImages.push(re.target.result);
          this.render();
        };
        reader.readAsDataURL(file);
      }
    });

    // Remove Attachment Chip
    this.container.querySelectorAll('.attachment-chip-remove').forEach(chip => {
      chip.addEventListener('click', () => {
        const idx = parseInt(chip.getAttribute('data-idx'), 10);
        this.attachedImages.splice(idx, 1);
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

  setupCodeModal() {
    const modal = this.container.querySelector('#modal-code-snippet');
    const openBtn = this.container.querySelector('#btn-export-code');
    const closeBtns = modal?.querySelectorAll('.modal-close');
    const pre = this.container.querySelector('#code-snippet-pre');
    const copyBtn = this.container.querySelector('#btn-copy-snippet');

    let currentSnippetType = 'python';

    const updateSnippet = () => {
      const activeKey = store.getActiveKey()?.key || 'YOUR_AVALAI_KEY';
      const promptMessages = this.buildChatMessages("Sample prompt");

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
          messages: promptMessages,
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

  buildChatMessages(latestPrompt) {
    const formatted = [];
    if (this.systemPrompt) {
      formatted.push({ role: 'system', content: this.systemPrompt });
    }

    for (const m of this.messages) {
      if (m.images && m.images.length > 0) {
        const contentParts = [{ type: 'text', text: m.content }];
        m.images.forEach(img => {
          contentParts.push({ type: 'image_url', image_url: { url: img } });
        });
        formatted.push({ role: m.role, content: contentParts });
      } else {
        formatted.push({ role: m.role, content: m.content });
      }
    }
    return formatted;
  },

  async sendMessage() {
    const textarea = this.container.querySelector('#chat-prompt-input');
    const prompt = textarea?.value.trim();
    if (!prompt && this.attachedImages.length === 0) return;

    const activeKey = store.getActiveKey();
    if (!activeKey) {
      this.showToast('Please select or add an active AvalAI API key first.', 'error');
      return;
    }

    // Add user message
    const userMsg = {
      id: 'msg_' + Date.now(),
      session_id: this.currentSessionId,
      role: 'user',
      content: prompt,
      images: [...this.attachedImages]
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

    this.attachedImages = [];
    if (textarea) textarea.value = '';

    // Create placeholder assistant message
    const assistantMsg = {
      id: 'msg_' + (Date.now() + 1),
      session_id: this.currentSessionId,
      role: 'assistant',
      content: '',
      thinking: '',
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
          assistantMsg.content = `⚠️ AvalAI API Error (${res.status}): ${res.data?.message || res.statusText || 'Unknown error'}`;
        }
        await Database.addChatMessage(assistantMsg);
      } catch (err) {
        this.isWaitingFirstToken = false;
        assistantMsg.content = `⚠️ Network Error: ${err.message}`;
      }
      this.render();
      this.scrollToBottom();
    } else {
      const formattedMessages = this.buildChatMessages();
      formattedMessages.pop(); // remove empty assistant message

      this.isStreaming = true;
      let lastRequestId = null;
      let lastProcessingMs = null;

      this.activeStream = AvalAIApi.streamChatCompletion({
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
            this.updateLiveAssistantBubble(assistantMsg);
          }
        },
        onEnd: async () => {
          this.isStreaming = false;
          this.isWaitingFirstToken = false;
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
          assistantMsg.content += `\n⚠️ Stream Error: ${err.error || 'Connection failed'}`;
          this.render();
          this.scrollToBottom();
        }
      });
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
