// AvalAI Comprehensive API Client Layer

import { store } from './store.js';

const DEFAULT_BASE_URL = 'https://api.avalai.ir';

function getAuthHeader(apiKey) {
  const key = apiKey || store.getActiveKey()?.key;
  if (!key) throw new Error('No AvalAI API key available. Please add or select an active key.');
  return { Authorization: `Bearer ${key}` };
}

export const AvalAIApi = {
  // --- USER API ---
  async getHealth(apiKey) {
    const url = `${DEFAULT_BASE_URL}/user/v1/health`;
    const headers = getAuthHeader(apiKey);
    return window.avalai.request({ url, method: 'GET', headers });
  },

  async getCredit(apiKey) {
    const url = `${DEFAULT_BASE_URL}/user/v1/credit`;
    const headers = getAuthHeader(apiKey);
    return window.avalai.request({ url, method: 'GET', headers });
  },

  async getTransactions(apiKey, { hours_ago = 24, page = 1, page_size = 50, model, provider } = {}) {
    let url = `${DEFAULT_BASE_URL}/user/v1/transactions?hours_ago=${hours_ago}&page=${page}&page_size=${page_size}`;
    if (model) url += `&model=${encodeURIComponent(model)}`;
    if (provider) url += `&provider=${encodeURIComponent(provider)}`;
    const headers = getAuthHeader(apiKey);
    return window.avalai.request({ url, method: 'GET', headers });
  },

  async lookupTransactions(apiKey, transactionIds = []) {
    const url = `${DEFAULT_BASE_URL}/user/v1/transactions/lookup`;
    const headers = {
      ...getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    };
    return window.avalai.request({
      url,
      method: 'POST',
      headers,
      body: { transaction_ids: transactionIds }
    });
  },

  async getTransactionsSummary(apiKey, { hours_ago = 24, group_by = 'model' } = {}) {
    let url = `${DEFAULT_BASE_URL}/user/v1/transactions/summary?hours_ago=${hours_ago}`;
    if (group_by) url += `&group_by=${encodeURIComponent(group_by)}`;
    const headers = getAuthHeader(apiKey);
    return window.avalai.request({ url, method: 'GET', headers });
  },

  // --- MODELS API ---
  async getModels(apiKey) {
    const url = `${DEFAULT_BASE_URL}/v1/models`;
    const headers = getAuthHeader(apiKey);
    return window.avalai.request({ url, method: 'GET', headers });
  },

  async getModelDetails(apiKey, modelId) {
    const url = `${DEFAULT_BASE_URL}/v1/models/${encodeURIComponent(modelId)}`;
    const headers = getAuthHeader(apiKey);
    return window.avalai.request({ url, method: 'GET', headers });
  },

  // --- CHAT & STREAMING ---
  async chatCompletion({ apiKey, model, messages, temperature = 0.7, max_tokens = 2048, stream = false, tools, web_search = false, modalities, audio }) {
    const url = `${DEFAULT_BASE_URL}/v1/chat/completions`;
    const headers = {
      ...getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    };

    const body = {
      model,
      messages,
      temperature: Number(temperature),
      max_tokens: Number(max_tokens),
      stream: Boolean(stream)
    };

    if (modalities) body.modalities = modalities;
    if (audio) body.audio = audio;

    if (web_search) {
      body.tools = [{ type: 'web_search' }];
    } else if (tools && tools.length) {
      body.tools = tools;
    }

    return window.avalai.request({ url, method: 'POST', headers, body, timeout: 90000 });
  },

  // Native SSE Streaming Chat
  streamChatCompletion({ apiKey, model, messages, temperature = 0.7, max_tokens = 2048, web_search = false, modalities, audio, onHeaders, onChunk, onEvent, onEnd, onError }) {
    const streamId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const url = `${DEFAULT_BASE_URL}/v1/chat/completions`;
    const headers = getAuthHeader(apiKey);

    const body = {
      model,
      messages,
      temperature: Number(temperature),
      max_tokens: Number(max_tokens)
    };

    if (modalities) body.modalities = modalities;
    if (audio) body.audio = audio;

    if (web_search) {
      body.tools = [{ type: 'web_search' }];
    }

    const unsubs = [];
    if (onHeaders) unsubs.push(window.avalai.onStreamHeaders(streamId, onHeaders));
    if (onChunk) unsubs.push(window.avalai.onStreamChunk(streamId, onChunk));
    if (onEvent) unsubs.push(window.avalai.onStreamEvent(streamId, onEvent));
    if (onEnd) {
      unsubs.push(window.avalai.onStreamEnd(streamId, (data) => {
        unsubs.forEach(u => u());
        onEnd(data);
      }));
    }
    if (onError) {
      unsubs.push(window.avalai.onStreamError(streamId, (err) => {
        unsubs.forEach(u => u());
        onError(err);
      }));
    }

    window.avalai.startStream({ streamId, url, headers, body });
    return {
      streamId,
      cancel: () => {
        unsubs.forEach(u => u());
        return window.avalai.cancelStream(streamId);
      }
    };
  },

  // --- RESPONSES API ---
  async responses({ apiKey, model, input, instructions = '', tools }) {
    const url = `${DEFAULT_BASE_URL}/v1/responses`;
    const headers = {
      ...getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    };

    const body = {
      model,
      input,
      instructions
    };
    if (tools && tools.length) body.tools = tools;

    return window.avalai.request({ url, method: 'POST', headers, body, timeout: 90000 });
  },

  // --- IMAGE GENERATION API ---
  async generateImage({ apiKey, model = 'gpt-image-2', prompt, size = '1024x1024', quality = 'medium', n = 1, style }) {
    const url = `${DEFAULT_BASE_URL}/v1/images/generations`;
    const headers = {
      ...getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    };

    const body = {
      model,
      prompt,
      size,
      quality,
      n: Number(n)
    };
    if (style) body.style = style;

    return window.avalai.request({ url, method: 'POST', headers, body, timeout: 120000 });
  },

  // --- AUDIO / TTS API ---
  async textToSpeech({ apiKey, model = 'gpt-4o-mini-tts', input, voice = 'coral', speed = 1.0, instructions = '' }) {
    const url = `${DEFAULT_BASE_URL}/v1/audio/speech`;
    const headers = {
      ...getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    };

    const body = {
      model,
      input,
      voice,
      speed: Number(speed)
    };
    if (instructions) body.instructions = instructions;

    return window.avalai.request({ url, method: 'POST', headers, body, timeout: 60000 });
  },

  // --- AUDIO / TRANSCRIPTIONS API ---
  async transcribeAudio({ apiKey, model = 'whisper-1', fileBase64, filename = 'voice.wav', mime = 'audio/wav', language, prompt }) {
    const url = `${DEFAULT_BASE_URL}/v1/audio/transcriptions`;
    const headers = getAuthHeader(apiKey);

    const fields = {
      model,
      response_format: 'json'
    };
    if (language) fields.language = language;
    if (prompt) fields.prompt = prompt;

    const body = {
      isMultipart: true,
      fields,
      file: {
        base64: fileBase64,
        filename,
        mime,
        fieldName: 'file'
      }
    };

    return window.avalai.request({ url, method: 'POST', headers, body, timeout: 60000 });
  },

  // --- SEARCH API ---
  async search({ apiKey, search_tool_name = 'serper-search', query, max_results = 8, country }) {
    const url = `${DEFAULT_BASE_URL}/v1/search`;
    const headers = {
      ...getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    };

    const body = {
      search_tool_name,
      query,
      max_results: Number(max_results)
    };
    if (country) body.country = country;

    return window.avalai.request({ url, method: 'POST', headers, body, timeout: 45000 });
  },

  // --- RERANK API ---
  async rerank({ apiKey, model = 'cohere-rerank-v4.0-pro', query, documents = [], top_n = 5 }) {
    const url = `${DEFAULT_BASE_URL}/v1/rerank`;
    const headers = {
      ...getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    };

    const body = {
      model,
      query,
      documents,
      top_n: Number(top_n),
      return_documents: true
    };

    return window.avalai.request({ url, method: 'POST', headers, body, timeout: 45000 });
  },

  // --- EMBEDDINGS API ---
  async embeddings({ apiKey, model = 'text-embedding-3-small', input }) {
    const url = `${DEFAULT_BASE_URL}/v1/embeddings`;
    const headers = {
      ...getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    };

    const body = {
      model,
      input
    };

    return window.avalai.request({ url, method: 'POST', headers, body, timeout: 45000 });
  }
};
