// State & Vault Manager for AvalAI Studio backed by SQLite Database
import { Database } from './db.js';

class Store {
  constructor() {
    this.state = {
      keys: [],
      activeKeyId: null,
      theme: 'dark', // 'dark' or 'light'
      settings: {
        domain: 'https://api.avalai.ir',
        timeoutMs: 60000,
        defaultChatModel: 'gpt-6-astra',
        defaultResponsesModel: 'gpt-5.6-luna'
      },
      cachedModels: []
    };
    this.listeners = new Set();
  }

  async init() {
    try {
      // 1. Initialize SQLite Database
      await Database.init();

      // 2. Load keys from SQLite
      let dbKeys = await Database.getAllKeys();

      // Migration: If SQLite is empty, check legacy store file
      if (dbKeys.length === 0 && window.avalai?.getStore) {
        const legacyData = await window.avalai.getStore();
        if (legacyData?.keys?.length > 0) {
          for (const k of legacyData.keys) {
            await Database.saveKey(k);
          }
          dbKeys = await Database.getAllKeys();
        }
      }

      this.state.keys = dbKeys;

      // 3. Load settings & active key from SQLite
      const activeKeyId = await Database.getSetting('activeKeyId', null);
      if (activeKeyId && this.state.keys.some(k => k.id === activeKeyId)) {
        this.state.activeKeyId = activeKeyId;
      } else if (this.state.keys.length > 0) {
        this.state.activeKeyId = this.state.keys[0].id;
      }

      const savedTheme = await Database.getSetting('theme', 'dark');
      this.state.theme = savedTheme || 'dark';

      // Apply theme to document
      document.documentElement.setAttribute('data-theme', this.state.theme);

    } catch (err) {
      console.error('Failed to initialize SQLite store:', err);
    }

    this.notify();
    return this.state;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Listener error in store:', err);
      }
    }
  }

  getKeys() {
    return this.state.keys || [];
  }

  getActiveKey() {
    if (!this.state.activeKeyId) {
      return this.state.keys && this.state.keys.length > 0 ? this.state.keys[0] : null;
    }
    return this.state.keys.find(k => k.id === this.state.activeKeyId) || this.state.keys[0] || null;
  }

  async setActiveKeyId(id) {
    this.state.activeKeyId = id;
    await Database.setSetting('activeKeyId', id);
    this.notify();
  }

  getTheme() {
    return this.state.theme;
  }

  async setTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    await Database.setSetting('theme', theme);
    this.notify();
  }

  async toggleTheme() {
    const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
    await this.setTheme(newTheme);
    return newTheme;
  }

  async addKey({ label, key, notes = '' }) {
    const trimmedKey = key.trim();
    if (!trimmedKey) throw new Error('API key cannot be empty');

    const newKey = {
      id: 'key_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      label: label.trim() || 'AvalAI Key ' + (this.state.keys.length + 1),
      key: trimmedKey,
      notes: notes.trim(),
      tier: null,
      balance_irt: null,
      balance_usd: null,
      exchange_rate: null,
      packages: [],
      grants: [],
      createdAt: new Date().toISOString(),
      lastTested: null,
      status: 'untested'
    };

    await Database.saveKey(newKey);
    this.state.keys.unshift(newKey);

    if (!this.state.activeKeyId) {
      await this.setActiveKeyId(newKey.id);
    }
    this.notify();
    return newKey;
  }

  async updateKey(id, updates) {
    const idx = this.state.keys.findIndex(k => k.id === id);
    if (idx !== -1) {
      const updated = { ...this.state.keys[idx], ...updates };
      this.state.keys[idx] = updated;
      await Database.saveKey(updated);
      this.notify();
      return updated;
    }
    return null;
  }

  async deleteKey(id) {
    await Database.deleteKey(id);
    this.state.keys = this.state.keys.filter(k => k.id !== id);
    if (this.state.activeKeyId === id) {
      const nextId = this.state.keys.length > 0 ? this.state.keys[0].id : null;
      await this.setActiveKeyId(nextId);
    }
    this.notify();
  }

  setCachedModels(models) {
    this.state.cachedModels = models;
    this.notify();
  }

  getCachedModels() {
    return this.state.cachedModels || [];
  }
}

export const store = new Store();
