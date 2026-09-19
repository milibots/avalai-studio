# ⚡ AvalAI Studio & API Manager
### The Ultimate Desktop Suite for AvalAI Developers & Teams

A full-featured, state-of-the-art Electron desktop application designed to manage unlimited AvalAI API keys, run deep diagnostic audits, explore models with live pricing, and interactively test every single endpoint documented on the AvalAI platform.

---

## 🌟 Key Features

### 1. 🔑 Multi-API Key Vault & Switcher
- **Unlimited Key Storage**: Add, label, tag, and organize as many AvalAI keys as you need (e.g. `Production Bot`, `Client A`, `Personal Dev`, `Testing`).
- **One-Click Active Switcher**: Switch the active key anytime directly from the top header.
- **Auto-Sync & Validation**: Checks validity and displays account tier (Tier 0 to Tier 5), remaining balance (in Iranian Toman), and USD equivalent.
- **Safe Local Storage**: Securely stored on your local disk in your user app data directory. Never transmitted to any third party.
- **Export / Import**: One-click JSON backup and restore for your key collection.

### 2. 🩺 Diagnostic Audit & Account Health
- **Live Latency & Ping**: Real-time roundtrip latency to `https://api.avalai.ir`.
- **Health Check**: Automated validation against `GET /user/v1/health`.
- **Credit & Limits**: Reads `remaining_irt`, `remaining_unit` (USD), `total_unit`, and live `exchange_rate` (Toman per USD) via `GET /user/v1/credit`.
- **Credit Packages & Grants Breakdown**: Lists all active packages with template IDs, package names, remaining Toman, expiration dates, and eligible model scopes (`scope_details.api`).
- **Response Headers & Rate Limits Inspector**: Live telemetry of:
  - `avalai-request-id` (UUID v7 for exact cost lookup and audit trails)
  - `x-ratelimit-limit-requests` & `x-ratelimit-remaining-requests`
  - `x-ratelimit-limit-tokens` & `x-ratelimit-remaining-tokens`
  - `x-ratelimit-reset-requests` & `x-ratelimit-reset-tokens`
  - `openai-processing-ms` (Upstream model processing latency)

### 3. 🧠 Model Explorer & Live Pricing Matrix
- Comprehensive catalog of 100+ models from top providers:
  - **OpenAI**: `gpt-6-astra`, `gpt-5.6-luna`, `gpt-5.4-mini`, `gpt-image-2`, `gpt-4o-mini-tts`
  - **Anthropic**: `claude-fable-5-1` (1M context), `claude-sonnet-5`, `claude-opus-5`
  - **Google**: `gemini-3.8-flash`, `gemini-3.1-flash-image` (Nano Banana), `gemini-embedding-2`
  - **DeepSeek**: `deepseek-v4-pro`, `deepseek-v4-flash`
  - **Alibaba**: `qwen3.8-27b`, `qwen3.8-flash`, `qwen-image-3.0`, `qwen3-rerank`
  - **Z.AI**: `glm-5.3`, `glm-5.3-flash`
  - **xAI**: `grok-4.5`
  - **Moonshot**: `kimi-k3`
  - **Mistral**: `mistral-large-3`
  - **ElevenLabs**: `eleven_v3`
- Search & filter by Provider, Modality, and Minimum Account Tier.
- Displays Input, Cached Input, and Output cost per 1M tokens in USD.
- Quick "Open in Chat" shortcut for any model.

### 4. 💬 Chat & Reasoning Playground
- **Dual API Support**:
  - `/v1/chat/completions` (OpenAI format with live Server-Sent Events SSE streaming)
  - `/v1/responses` (Modern unified Responses API with instructions, input, and output_text)
- **Reasoning / Thinking Inspector**: Collapsible thought process stream for reasoning models (DeepSeek, o3, GLM, Claude).
- **Multimodal Vision**: Drag and drop or attach images (PNG, JPEG, WebP) directly into prompts.
- **Integrated Web Search**: Toggle built-in AvalAI web search tool during chat.
- **Hyperparameter Controls**: Adjust Temperature, Max Tokens, and System / Developer Instructions.
- **Code Generator**: Instantly view and copy exact runnable code in **Python (OpenAI SDK)**, **JavaScript (OpenAI SDK)**, and **cURL**.

### 5. 🎨 Image Generation Studio
- Test `POST /v1/images/generations` with `gpt-image-2`, `seedream-4.5`, `flux.2-pro`, `gemini-3.1-flash-image`, and `qwen-image-3.0`.
- Customizable resolution (1024x1024, 1024x1536, 1536x1024) and quality presets.
- Full-resolution preview canvas, direct PNG download, and history gallery.

### 6. 🎙️ Audio & Speech Studio
- Text-to-Speech synthesis with `POST /v1/audio/speech`.
- Voice options: `coral`, `alloy`, `marin`, `cedar`, `echo`, `fable`, `onyx`, `nova`, `shimmer`.
- Built-in interactive audio player with waveform playback and MP3 download.

### 7. 🌐 Standalone Web Search Lab
- Test dedicated `POST /v1/search` with 10 search tools:
  - `serper-search` ($0.001 / query - Google Powered)
  - `tavily-search` ($0.008 / query)
  - `exa_ai-search` ($0.025 / query - Neural Search)
  - `firecrawl-search` ($0.008 / query - Web Scraping & Content Extraction)
  - `perplexity-search` ($0.005 / query - AI Search)
  - `dataforseo-search` ($0.003 / query)
  - `parallel_ai-search` ($0.004 / query)

### 8. 🧬 Vector Embeddings & Rerank Lab
- Compute vector embeddings with `text-embedding-3-small`, `cohere-embed-v4`, `gemini-embedding-2`.
- **Semantic Cosine Similarity Meter**: Compare two texts and calculate exact mathematical similarity percentage.
- **Document Reranker**: Query sample documents using `cohere-rerank-v4.0-pro` or `qwen3-rerank` and view relevancy scores.

### 10. 🗄️ Embedded SQLite Database Engine (`avalai_vault.sqlite`)
- **Native Database Storage**: Powered by WebAssembly SQLite (`sql.js`), saving directly to `%APPDATA%\avalai-api-manager\avalai_vault.sqlite`.
- **Relational Tables**: Complete data schemas for `keys`, `chat_sessions`, `chat_messages`, `image_generations`, `audio_generations`, and `app_settings`.
- **Backup & Explorer Tools**: Export the `.sqlite` binary with one click (`💾`) or reveal the database location in Windows Explorer (`📂`).

### 11. ☀️ Light Mode & 🌙 Dark Mode System
- Full dual-theme system switchable with the header toggle button.
- Tailored color palettes with high-contrast borders and rich gradients.
- Persian typography support via **Vazirmatn** font for Iranian Rial/Toman numbers and Persian text.

### 12. ✨ Shimmer Skeleton Loaders
- Integrated animated skeleton loading states across **every single view** (Key vault, Diagnostics, Models, Chat streaming placeholder, Image canvas, Audio waveform, Search results, Embeddings gauge, and Transactions table).

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node.js 24)

### Running the App
From the `D:\avalai` directory, run:

```bash
npm start
```

Or run with electron directly:

```bash
npx electron .
```

---

## 🎨 Design Philosophy
- **Dark Space & Clean Light Modes**: Curated deep slate tones (`#080c14`, `#0e1524`) and daytime-optimized bright themes (`#f8fafc`), electric indigo and cyan accents (`#6366f1`, `#06b6d4`), and glowing status indicators.
- **Native Freedom**: Network requests handled directly through Electron's background layer, completely eliminating browser CORS limitations and giving accurate response header inspection.
- **Zero Bloat & Offline-First**: Fast launch, responsive layout, fluid micro-interactions, instant key switching, and local SQLite data persistence.
