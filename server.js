const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;

// Resolve paths for standalone executable or development
function resolveDataFile() {
  const candidateDirs = [];

  // 1. Where the executable / script is located
  if (process.pkg) {
    candidateDirs.push(path.dirname(process.execPath));
  } else {
    candidateDirs.push(__dirname);
  }

  // 2. Current working directory
  candidateDirs.push(process.cwd());

  // 3. Fallback candidates
  candidateDirs.push(__dirname);

  // Check if an existing todos.json already exists in one of the locations
  for (const dir of candidateDirs) {
    if (dir && typeof dir === 'string') {
      const candidateFile = path.join(dir, 'todos.json');
      if (fs.existsSync(candidateFile)) {
        return candidateFile;
      }
    }
  }

  // Default to directory next to executable or script
  const primaryDir = process.pkg ? path.dirname(process.execPath) : __dirname;
  return path.join(primaryDir, 'todos.json');
}

const DATA_FILE = resolveDataFile();
console.log(`[Persistence] Tasks file location: ${DATA_FILE}`);

// Prefer external public/ folder if provided, otherwise use packaged assets
let PUBLIC_DIR = path.join(__dirname, 'public');
if (process.pkg) {
  const externalPublic = path.join(path.dirname(process.execPath), 'public');
  if (fs.existsSync(externalPublic)) {
    PUBLIC_DIR = externalPublic;
  }
}

// Initialize data file with welcome tasks only if it truly does not exist
if (!fs.existsSync(DATA_FILE)) {
  const initialWelcome = [
    { id: '1', title: 'Welcome to your To-Do list! 👋', category: 'Personal', dueDate: null, completed: false, createdAt: new Date().toISOString() },
    { id: '2', title: 'Click the checkbox to mark as complete', category: 'Work', dueDate: null, completed: true, createdAt: new Date().toISOString() },
    { id: '3', title: 'Hit the trash can icon to delete', category: 'Urgent', dueDate: null, completed: false, createdAt: new Date().toISOString() }
  ];
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialWelcome, null, 2), 'utf8');
  console.log(`[Persistence] Initialized new tasks file at ${DATA_FILE}`);
} else {
  const existing = readTodos();
  console.log(`[Persistence] Loaded ${existing.length} existing tasks on startup.`);
}

function readTodos() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    if (!data || !data.trim()) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`[Persistence] Error reading todos from ${DATA_FILE}:`, err);
    return [];
  }
}

function saveTodos(todos) {
  try {
    const data = JSON.stringify(todos, null, 2);
    // Write and flush synchronously to guarantee persistence on disk
    const fd = fs.openSync(DATA_FILE, 'w');
    fs.writeFileSync(fd, data, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    console.log(`[Persistence] Successfully saved ${todos.length} tasks to ${DATA_FILE}`);
  } catch (err) {
    console.error(`[Persistence] Error saving todos to ${DATA_FILE}:`, err);
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // Safeguard against oversized payloads
        req.socket.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const handleRequest = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // Backup & Restore Routes
  if (pathname === '/api/backup/export' && method === 'GET') {
    const todos = readTodos();
    const dateStr = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="todos-backup-${dateStr}.json"`,
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(todos, null, 2));
  }

  if (pathname === '/api/backup/import' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const incomingList = Array.isArray(body) ? body : (Array.isArray(body.todos) ? body.todos : null);

      if (!incomingList) {
        return sendJsonResponse(res, 400, { error: 'Invalid backup format. Expected a JSON array of todos.' });
      }

      const validatedTodos = incomingList.map((item, idx) => {
        const title = (item && typeof item.title === 'string') ? item.title.trim() : '';
        if (!title) {
          throw new Error(`Task at index ${idx + 1} is missing a title.`);
        }
        return {
          id: (item.id && String(item.id).trim()) ? String(item.id).trim() : (Date.now() + idx).toString(),
          title: title,
          category: (typeof item.category === 'string' && item.category.trim()) ? item.category.trim() : null,
          dueDate: (typeof item.dueDate === 'string' && item.dueDate.trim()) ? item.dueDate.trim() : null,
          completed: Boolean(item.completed),
          createdAt: item.createdAt || new Date().toISOString()
        };
      });

      saveTodos(validatedTodos);
      return sendJsonResponse(res, 200, {
        success: true,
        message: `Successfully imported ${validatedTodos.length} tasks`,
        todos: validatedTodos
      });
    } catch (err) {
      return sendJsonResponse(res, 400, { error: err.message || 'Failed to parse backup JSON' });
    }
  }

  // API Routes
  if (pathname === '/api/todos' && method === 'GET') {
    const todos = readTodos();
    return sendJsonResponse(res, 200, todos);
  }

  // Reorder Todos
  if (pathname === '/api/todos/reorder' && (method === 'PUT' || method === 'POST')) {
    try {
      const body = await parseJsonBody(req);
      const orderedIds = body.ids;
      if (!Array.isArray(orderedIds)) {
        return sendJsonResponse(res, 400, { error: 'ids array is required' });
      }

      const todos = readTodos();
      const todoMap = new Map(todos.map(t => [t.id, t]));
      
      const newTodos = [];
      for (const id of orderedIds) {
        if (todoMap.has(id)) {
          newTodos.push(todoMap.get(id));
          todoMap.delete(id);
        }
      }
      // Preserve any items that weren't in the active view/reorder list
      for (const remaining of todoMap.values()) {
        newTodos.push(remaining);
      }

      saveTodos(newTodos);
      return sendJsonResponse(res, 200, newTodos);
    } catch (err) {
      return sendJsonResponse(res, 400, { error: 'Invalid JSON body' });
    }
  }

  if (pathname === '/api/todos' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const title = (body.title || '').trim();

      if (!title) {
        return sendJsonResponse(res, 400, { error: 'Task title is required' });
      }

      const todos = readTodos();
      const category = (typeof body.category === 'string' && body.category.trim()) ? body.category.trim() : null;
      const dueDate = (typeof body.dueDate === 'string' && body.dueDate.trim()) ? body.dueDate.trim() : null;

      const newTodo = {
        id: Date.now().toString(),
        title,
        category,
        dueDate,
        completed: false,
        createdAt: new Date().toISOString()
      };

      todos.unshift(newTodo);
      saveTodos(todos);

      return sendJsonResponse(res, 201, newTodo);
    } catch (err) {
      return sendJsonResponse(res, 400, { error: 'Invalid JSON body' });
    }
  }

  const todoIdMatch = pathname.match(/^\/api\/todos\/([a-zA-Z0-9_-]+)$/);
  if (todoIdMatch) {
    const id = todoIdMatch[1];
    const todos = readTodos();
    const todoIndex = todos.findIndex(t => t.id === id);

    if (method === 'PATCH') {
      if (todoIndex === -1) {
        return sendJsonResponse(res, 404, { error: 'Task not found' });
      }

      try {
        const body = await parseJsonBody(req);
        if (typeof body.completed === 'boolean') {
          todos[todoIndex].completed = body.completed;
        }
        if (typeof body.title === 'string' && body.title.trim()) {
          todos[todoIndex].title = body.title.trim();
        }
        if (body.category !== undefined) {
          todos[todoIndex].category = (typeof body.category === 'string' && body.category.trim()) ? body.category.trim() : null;
        }
        if (body.dueDate !== undefined) {
          todos[todoIndex].dueDate = (typeof body.dueDate === 'string' && body.dueDate.trim()) ? body.dueDate.trim() : null;
        }

        saveTodos(todos);
        return sendJsonResponse(res, 200, todos[todoIndex]);
      } catch (err) {
        return sendJsonResponse(res, 400, { error: 'Invalid JSON body' });
      }
    }

    if (method === 'DELETE') {
      if (todoIndex === -1) {
        return sendJsonResponse(res, 404, { error: 'Task not found' });
      }

      const deleted = todos.splice(todoIndex, 1)[0];
      saveTodos(todos);
      return sendJsonResponse(res, 200, { success: true, deleted });
    }
  }

  // Serve Frontend Static Files
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  // Check if file exists, default to index.html for root or unknown
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveStaticFile(res, filePath);
  } else {
    // If route doesn't match a file, try serving index.html
    const fallback = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(fallback)) {
      return serveStaticFile(res, fallback);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
};

function openBrowser(url) {
  const platform = process.platform;

  if (platform === 'win32') {
    // Try Start-Process via powershell first, with cmd start fallback
    exec(`powershell -NoProfile -Command "Start-Process '${url}'"`, (err) => {
      if (err) {
        exec(`cmd.exe /c start "" "${url}"`, (fallbackErr) => {
          if (fallbackErr) {
            console.warn(`Could not automatically open browser: ${fallbackErr.message}`);
            console.log(`Please visit ${url} in your browser.`);
          }
        });
      }
    });
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

function startServer(port, attemptsLeft = 10) {
  const server = http.createServer(handleRequest);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log(`Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1, attemptsLeft - 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`To-Do App is running at ${url}`);
    if (process.pkg || process.env.OPEN_BROWSER !== 'false') {
      openBrowser(url);
    }
  });
}

startServer(PORT);

