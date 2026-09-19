const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let mainWindow = null;

const storeFilePath = path.join(app.getPath('userData'), 'avalai_studio_vault.json');

function loadStore() {
  try {
    if (fs.existsSync(storeFilePath)) {
      const raw = fs.readFileSync(storeFilePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading store file:', err);
  }
  return {
    keys: [],
    activeKeyId: null,
    settings: {
      domain: 'https://api.avalai.ir',
      timeoutMs: 60000,
      saveHistory: true,
      defaultChatModel: 'gpt-6-astra',
      defaultResponsesModel: 'gpt-5.6-luna'
    },
    transactionCache: []
  };
}

function saveStore(data) {
  try {
    fs.mkdirSync(path.dirname(storeFilePath), { recursive: true });
    fs.writeFileSync(storeFilePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Error saving store file:', err);
    return { success: false, error: err.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#080c14',
    title: 'AvalAI Studio & API Manager',
    icon: path.join(__dirname, 'src', 'assets', 'avalai-logo.png'),
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const isTestRun = process.argv.includes('--test-run');
  if (isTestRun) {
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`RENDERER [${level}]: ${message}`);
    });
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Window did-finish-load triggered!');
      setTimeout(() => {
        console.log('TEST_VERIFICATION_PASSED: All components and IPC initialized successfully!');
        app.quit();
      }, 2000);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.name = 'AvalAI Studio';

app.whenReady().then(async () => {
  try {
    await initSqlite();
    console.log('SQLite database initialized at:', dbFilePath);
  } catch (err) {
    console.error('Failed to pre-init SQLite:', err);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('store:get', async () => {
  return loadStore();
});

ipcMain.handle('store:save', async (event, data) => {
  return saveStore(data);
});

const initSqlJs = require('sql.js');

let sqlDb = null;
const dbFilePath = path.join(app.getPath('userData'), 'avalai_vault.sqlite');

async function initSqlite() {
  if (sqlDb) return sqlDb;
  try {
    const SQL = await initSqlJs({
      locateFile: file => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
    });

    if (fs.existsSync(dbFilePath)) {
      const fileBuffer = fs.readFileSync(dbFilePath);
      sqlDb = new SQL.Database(fileBuffer);
    } else {
      sqlDb = new SQL.Database();
    }

    sqlDb.run(`
      CREATE TABLE IF NOT EXISTS keys (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        key TEXT NOT NULL,
        notes TEXT,
        tier INTEGER,
        balance_irt REAL,
        balance_usd REAL,
        exchange_rate INTEGER,
        packages_json TEXT,
        grants_json TEXT,
        status TEXT,
        created_at TEXT,
        last_tested TEXT
      );
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT NOT NULL,
        api_mode TEXT NOT NULL,
        system_prompt TEXT,
        temperature REAL,
        max_tokens INTEGER,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        thinking TEXT,
        images_json TEXT,
        meta_json TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS image_generations (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        model TEXT NOT NULL,
        size TEXT NOT NULL,
        quality TEXT,
        image_url TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS audio_generations (
        id TEXT PRIMARY KEY,
        input_text TEXT NOT NULL,
        model TEXT NOT NULL,
        voice TEXT NOT NULL,
        speed REAL,
        audio_url TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    persistSqlite();
  } catch (err) {
    console.error('Failed to init SQLite:', err);
  }
  return sqlDb;
}

function persistSqlite() {
  if (!sqlDb) return;
  try {
    const data = sqlDb.export();
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    fs.writeFileSync(dbFilePath, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist SQLite database:', err);
  }
}

ipcMain.handle('db:init', async () => {
  await initSqlite();
  return { success: true, path: dbFilePath };
});

ipcMain.handle('db:all', async (event, { sql, params = [] }) => {
  await initSqlite();
  if (!sqlDb) return [];
  try {
    const results = sqlDb.exec(sql, params);
    if (!results || results.length === 0) return [];
    const { columns, values } = results[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  } catch (err) {
    console.error('SQLite query error:', err.message, 'SQL:', sql);
    return [];
  }
});

ipcMain.handle('db:run', async (event, { sql, params = [] }) => {
  await initSqlite();
  if (!sqlDb) return { success: false, error: 'DB not initialized' };
  try {
    sqlDb.run(sql, params);
    persistSqlite();
    return { success: true };
  } catch (err) {
    console.error('SQLite run error:', err.message, 'SQL:', sql);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:export', async () => {
  await initSqlite();
  if (!sqlDb) return null;
  persistSqlite();
  const buffer = fs.readFileSync(dbFilePath);
  return {
    path: dbFilePath,
    size: buffer.length,
    base64: buffer.toString('base64')
  };
});

ipcMain.handle('db:show-in-folder', async () => {
  await initSqlite();
  persistSqlite();
  if (fs.existsSync(dbFilePath)) {
    shell.showItemInFolder(dbFilePath);
    return { success: true, path: dbFilePath };
  }
  return { success: false, error: 'Database file not found' };
});

ipcMain.handle('app:open-external', async (event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('network:ping', async (event, domain = 'https://api.avalai.ir') => {
  const startTime = Date.now();
  try {
    const cleanUrl = domain.replace(/\/v1\/?$/, '');
    const resp = await fetch(cleanUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'AvalAI-Studio/1.0' },
      signal: AbortSignal.timeout(5000)
    });
    const latency = Date.now() - startTime;
    return { ok: resp.ok, status: resp.status, latencyMs: latency };
  } catch (err) {
    return { ok: false, error: err.message, latencyMs: Date.now() - startTime };
  }
});

// Native HTTP request executor to handle AvalAI endpoints, headers, and CORS freedom
ipcMain.handle('avalai:request', async (event, { url, method = 'GET', headers = {}, body = null, timeout = 60000 }) => {
  const startTime = Date.now();
  try {
    const fetchOptions = {
      method,
      headers: {
        ...headers
      },
      signal: AbortSignal.timeout(timeout)
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (body.isMultipart) {
        const fd = new FormData();
        if (body.fields) {
          Object.entries(body.fields).forEach(([k, v]) => {
            if (v !== undefined && v !== null) fd.append(k, String(v));
          });
        }
        if (body.file && body.file.base64) {
          const rawBase64 = body.file.base64.replace(/^data:[^;]+;base64,/, '');
          const fileBuf = Buffer.from(rawBase64, 'base64');
          const fileBlob = new Blob([fileBuf], { type: body.file.mime || 'audio/wav' });
          fd.append(body.file.fieldName || 'file', fileBlob, body.file.filename || 'recording.wav');
        }
        fetchOptions.body = fd;
        delete fetchOptions.headers['Content-Type'];
        delete fetchOptions.headers['content-type'];
      } else if (typeof body === 'object' && !(body instanceof Uint8Array)) {
        fetchOptions.body = JSON.stringify(body);
        if (!fetchOptions.headers['Content-Type'] && !fetchOptions.headers['content-type']) {
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
      } else {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(url, fetchOptions);
    const durationMs = Date.now() - startTime;

    // Collect all headers cleanly
    const responseHeaders = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key.toLowerCase()] = val;
    });

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.includes('audio/') || contentType.includes('image/') || contentType.includes('application/octet-stream')) {
      const buffer = await response.arrayBuffer();
      data = Buffer.from(buffer).toString('base64');
    } else {
      data = await response.text();
    }

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      durationMs,
      data,
      requestId: responseHeaders['avalai-request-id'] || responseHeaders['x-request-id'] || null,
      rateLimits: {
        limitRequests: responseHeaders['x-ratelimit-limit-requests'] || null,
        remainingRequests: responseHeaders['x-ratelimit-remaining-requests'] || null,
        limitTokens: responseHeaders['x-ratelimit-limit-tokens'] || null,
        remainingTokens: responseHeaders['x-ratelimit-remaining-tokens'] || null,
        resetRequests: responseHeaders['x-ratelimit-reset-requests'] || null,
        resetTokens: responseHeaders['x-ratelimit-reset-tokens'] || null
      },
      serverLatencyMs: responseHeaders['openai-processing-ms'] || null
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      statusText: 'Network / Client Error',
      error: err.message,
      durationMs: Date.now() - startTime
    };
  }
});

// Native Streaming SSE client for chat completions and responses
const activeStreams = new Map();

ipcMain.handle('avalai:stream-start', (event, { streamId, url, headers = {}, body = {} }) => {
  try {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify({ ...body, stream: true });

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(
      parsedUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...headers,
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        const responseHeaders = {};
        for (const [k, v] of Object.entries(res.headers)) {
          responseHeaders[k.toLowerCase()] = v;
        }

        const requestId = responseHeaders['avalai-request-id'] || responseHeaders['x-request-id'] || null;
        const processingMs = responseHeaders['openai-processing-ms'] || null;

        event.sender.send(`avalai:stream-headers:${streamId}`, {
          status: res.statusCode,
          headers: responseHeaders,
          requestId,
          processingMs
        });

        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // keepalive or comment

            if (trimmed.startsWith('data: ')) {
              const dataContent = trimmed.slice(6);
              if (dataContent === '[DONE]') {
                event.sender.send(`avalai:stream-chunk:${streamId}`, { done: true });
              } else {
                try {
                  const parsed = JSON.parse(dataContent);
                  event.sender.send(`avalai:stream-chunk:${streamId}`, { data: parsed, raw: dataContent });
                } catch {
                  event.sender.send(`avalai:stream-chunk:${streamId}`, { raw: dataContent });
                }
              }
            } else if (trimmed.startsWith('event: ')) {
              event.sender.send(`avalai:stream-event:${streamId}`, trimmed.slice(7));
            }
          }
        });

        res.on('end', () => {
          if (buffer.trim().startsWith('data: [DONE]')) {
            event.sender.send(`avalai:stream-chunk:${streamId}`, { done: true });
          }
          event.sender.send(`avalai:stream-end:${streamId}`, { complete: true });
          activeStreams.delete(streamId);
        });

        res.on('error', (err) => {
          event.sender.send(`avalai:stream-error:${streamId}`, { error: err.message });
          activeStreams.delete(streamId);
        });
      }
    );

    req.on('error', (err) => {
      event.sender.send(`avalai:stream-error:${streamId}`, { error: err.message });
      activeStreams.delete(streamId);
    });

    req.write(postData);
    req.end();

    activeStreams.set(streamId, req);
    return { ok: true, streamId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('avalai:stream-cancel', (event, streamId) => {
  if (activeStreams.has(streamId)) {
    try {
      const req = activeStreams.get(streamId);
      req.destroy();
      activeStreams.delete(streamId);
      return { cancelled: true };
    } catch (err) {
      return { cancelled: false, error: err.message };
    }
  }
  return { cancelled: false, reason: 'Not found' };
});

// GitHub Release Auto-Updater
function isNewerVersion(latest, current) {
  if (!latest || !current) return false;
  const clean = (v) => v.replace(/^v/, '').split('-')[0];
  const l = clean(latest).split('.').map(n => parseInt(n, 10) || 0);
  const c = clean(current).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lNum = l[i] || 0;
    const cNum = c[i] || 0;
    if (lNum > cNum) return true;
    if (lNum < cNum) return false;
  }
  return false;
}

ipcMain.handle('updater:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('updater:check', async () => {
  const currentVersion = app.getVersion();
  const repo = 'milibots/avalai-studio';
  const url = `https://api.github.com/repos/${repo}/releases/latest`;

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        method: 'GET',
        headers: {
          'User-Agent': 'AvalAI-Studio-Desktop',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(data);
              const latestTag = release.tag_name || '';
              const latestVersion = latestTag.replace(/^v/, '');
              const hasUpdate = isNewerVersion(latestVersion, currentVersion);
              
              // Find installer asset (.exe)
              const exeAsset = (release.assets || []).find(a => 
                a.name.endsWith('.exe') && !a.name.includes('blockmap')
              );
              
              resolve({
                success: true,
                hasUpdate,
                currentVersion,
                latestVersion,
                tagName: latestTag,
                name: release.name || latestTag,
                publishedAt: release.published_at,
                notes: release.body || '',
                htmlUrl: release.html_url,
                downloadUrl: exeAsset ? exeAsset.browser_download_url : release.html_url,
                assetName: exeAsset ? exeAsset.name : null,
                assetSize: exeAsset ? exeAsset.size : null
              });
            } catch (e) {
              resolve({ success: false, error: 'Failed to parse release: ' + e.message, currentVersion });
            }
          } else if (res.statusCode === 404) {
            resolve({ success: true, hasUpdate: false, currentVersion, message: 'No releases found on GitHub repository.' });
          } else {
            resolve({ success: false, error: `GitHub API returned HTTP ${res.statusCode}`, currentVersion });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message, currentVersion });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Connection to GitHub timed out', currentVersion });
      });
      req.end();
    } catch (err) {
      resolve({ success: false, error: err.message, currentVersion });
    }
  });
});

