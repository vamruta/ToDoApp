const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'todos.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize data file if not present
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([
    { id: '1', title: 'Welcome to your To-Do list! 👋', completed: false, createdAt: new Date().toISOString() },
    { id: '2', title: 'Click the checkbox to mark as complete', completed: true, createdAt: new Date().toISOString() },
    { id: '3', title: 'Hit the trash can icon to delete', completed: false, createdAt: new Date().toISOString() }
  ], null, 2), 'utf8');
}

function readTodos() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading todos:', err);
    return [];
  }
}

function saveTodos(todos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2), 'utf8');
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
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

const server = http.createServer(async (req, res) => {
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

  // API Routes
  if (pathname === '/api/todos' && method === 'GET') {
    const todos = readTodos();
    return sendJsonResponse(res, 200, todos);
  }

  if (pathname === '/api/todos' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const title = (body.title || '').trim();

      if (!title) {
        return sendJsonResponse(res, 400, { error: 'Task title is required' });
      }

      const todos = readTodos();
      const newTodo = {
        id: Date.now().toString(),
        title,
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
});

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

