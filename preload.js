const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avalai', {
  // Store
  getStore: () => ipcRenderer.invoke('store:get'),
  saveStore: (data) => ipcRenderer.invoke('store:save', data),

  // SQLite Database
  db: {
    init: () => ipcRenderer.invoke('db:init'),
    all: (sql, params) => ipcRenderer.invoke('db:all', { sql, params }),
    run: (sql, params) => ipcRenderer.invoke('db:run', { sql, params }),
    export: () => ipcRenderer.invoke('db:export'),
    showInFolder: () => ipcRenderer.invoke('db:show-in-folder')
  },

  // Network & Health
  pingDomain: (domain) => ipcRenderer.invoke('network:ping', domain),

  // Direct AvalAI API Request
  request: (options) => ipcRenderer.invoke('avalai:request', options),

  // Streaming SSE
  startStream: (options) => ipcRenderer.invoke('avalai:stream-start', options),
  cancelStream: (streamId) => ipcRenderer.invoke('avalai:stream-cancel', streamId),

  onStreamHeaders: (streamId, callback) => {
    const channel = `avalai:stream-headers:${streamId}`;
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  onStreamChunk: (streamId, callback) => {
    const channel = `avalai:stream-chunk:${streamId}`;
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  onStreamEvent: (streamId, callback) => {
    const channel = `avalai:stream-event:${streamId}`;
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  onStreamEnd: (streamId, callback) => {
    const channel = `avalai:stream-end:${streamId}`;
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  onStreamError: (streamId, callback) => {
    const channel = `avalai:stream-error:${streamId}`;
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // Shell
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // Auto-Updater
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    getVersion: () => ipcRenderer.invoke('updater:get-version')
  }
});

