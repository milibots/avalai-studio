// Client SQLite Database Interface
export const Database = {
  async init() {
    if (window.avalai?.db) {
      await window.avalai.db.init();
    }
  },

  async query(sql, params = []) {
    if (!window.avalai?.db) return [];
    return window.avalai.db.all(sql, params);
  },

  async run(sql, params = []) {
    if (!window.avalai?.db) return { success: false };
    return window.avalai.db.run(sql, params);
  },

  // --- KEYS TABLE ---
  async getAllKeys() {
    const rows = await this.query('SELECT * FROM keys ORDER BY created_at DESC;');
    return rows.map(r => ({
      ...r,
      packages: r.packages_json ? JSON.parse(r.packages_json) : [],
      grants: r.grants_json ? JSON.parse(r.grants_json) : []
    }));
  },

  async saveKey(k) {
    const existing = await this.query('SELECT id FROM keys WHERE id = ?;', [k.id]);
    const packagesJson = JSON.stringify(k.packages || []);
    const grantsJson = JSON.stringify(k.grants || []);

    if (existing.length > 0) {
      await this.run(`
        UPDATE keys SET
          label = ?, key = ?, notes = ?, tier = ?, balance_irt = ?,
          balance_usd = ?, exchange_rate = ?, packages_json = ?,
          grants_json = ?, status = ?, last_tested = ?
        WHERE id = ?;
      `, [
        k.label, k.key, k.notes || '', k.tier, k.balance_irt,
        k.balance_usd, k.exchange_rate, packagesJson,
        grantsJson, k.status || 'untested', k.lastTested || null,
        k.id
      ]);
    } else {
      await this.run(`
        INSERT INTO keys (
          id, label, key, notes, tier, balance_irt, balance_usd,
          exchange_rate, packages_json, grants_json, status, created_at, last_tested
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        k.id, k.label, k.key, k.notes || '', k.tier, k.balance_irt,
        k.balance_usd, k.exchange_rate, packagesJson, grantsJson,
        k.status || 'untested', k.createdAt || new Date().toISOString(), k.lastTested || null
      ]);
    }
  },

  async deleteKey(id) {
    await this.run('DELETE FROM keys WHERE id = ?;', [id]);
  },

  // --- CHAT SESSIONS & MESSAGES ---
  async getChatSessions() {
    return this.query('SELECT * FROM chat_sessions ORDER BY updated_at DESC;');
  },

  async createChatSession({ id, title, model, api_mode = 'chat', system_prompt = '', temperature = 0.7, max_tokens = 4096 }) {
    const now = new Date().toISOString();
    await this.run(`
      INSERT INTO chat_sessions (id, title, model, api_mode, system_prompt, temperature, max_tokens, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [id, title, model, api_mode, system_prompt, temperature, max_tokens, now, now]);
    return { id, title, model, api_mode, system_prompt, temperature, max_tokens, created_at: now, updated_at: now };
  },

  async updateChatSession(id, updates) {
    const sets = [];
    const params = [];
    for (const [key, val] of Object.entries(updates)) {
      sets.push(`${key} = ?`);
      params.push(val);
    }
    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    await this.run(`UPDATE chat_sessions SET ${sets.join(', ')} WHERE id = ?;`, params);
  },

  async deleteChatSession(id) {
    await this.run('DELETE FROM chat_messages WHERE session_id = ?;', [id]);
    await this.run('DELETE FROM chat_sessions WHERE id = ?;', [id]);
  },

  async getSessionMessages(sessionId) {
    const rows = await this.query('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC;', [sessionId]);
    return rows.map(r => ({
      ...r,
      images: r.images_json ? JSON.parse(r.images_json) : [],
      meta: r.meta_json ? JSON.parse(r.meta_json) : null
    }));
  },

  async addChatMessage({ id, session_id, role, content, thinking = '', images = [], meta = null }) {
    const now = new Date().toISOString();
    await this.run(`
      INSERT INTO chat_messages (id, session_id, role, content, thinking, images_json, meta_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      id || 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      session_id,
      role,
      content,
      thinking || '',
      JSON.stringify(images || []),
      JSON.stringify(meta || null),
      now
    ]);
    await this.updateChatSession(session_id, {});
  },

  // --- IMAGE GENERATIONS ---
  async getImages() {
    return this.query('SELECT * FROM image_generations ORDER BY created_at DESC LIMIT 50;');
  },

  async addImage({ id, prompt, model, size, quality, image_url }) {
    await this.run(`
      INSERT INTO image_generations (id, prompt, model, size, quality, image_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `, [
      id || 'img_' + Date.now(),
      prompt,
      model,
      size,
      quality || 'medium',
      image_url,
      new Date().toISOString()
    ]);
  },

  // --- AUDIO GENERATIONS ---
  async getAudios() {
    return this.query('SELECT * FROM audio_generations ORDER BY created_at DESC LIMIT 50;');
  },

  async addAudio({ id, input_text, model, voice, speed, audio_url }) {
    await this.run(`
      INSERT INTO audio_generations (id, input_text, model, voice, speed, audio_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `, [
      id || 'aud_' + Date.now(),
      input_text,
      model,
      voice,
      speed || 1.0,
      audio_url,
      new Date().toISOString()
    ]);
  },

  // --- APP SETTINGS ---
  async getSetting(key, defaultValue = null) {
    const rows = await this.query('SELECT value FROM app_settings WHERE key = ?;', [key]);
    if (rows.length > 0) {
      try {
        return JSON.parse(rows[0].value);
      } catch {
        return rows[0].value;
      }
    }
    return defaultValue;
  },

  async setSetting(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);', [key, serialized]);
  },

  // --- EXPORT & REVEAL DATABASE ---
  async exportDatabase() {
    if (!window.avalai?.db) return;
    const res = await window.avalai.db.export();
    if (res && res.base64) {
      const link = document.createElement('a');
      link.href = `data:application/x-sqlite3;base64,${res.base64}`;
      link.download = `avalai_vault_backup_${Date.now()}.sqlite`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return { success: true, size: res.size };
    }
    return { success: false };
  },

  async showInFolder() {
    if (window.avalai?.db?.showInFolder) {
      return await window.avalai.db.showInFolder();
    }
    return { success: false };
  }
};
