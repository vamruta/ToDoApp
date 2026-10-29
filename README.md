# Clean & Simple To-Do App

A minimalist, responsive to-do application built with **Node.js** and modern vanilla web technologies (HTML5, CSS3, JavaScript).

---

## Features

- **Add Tasks**: Type a task title and press <kbd>Enter</kbd> or click **Add**.
- **Complete Tasks**: Toggle completion with custom checkbox animations. Completed tasks are strikethrough-styled and updated live.
- **Delete Tasks**: Remove tasks with the delete icon.
- **Drag & Drop Reordering**: Drag any task using its handle to smoothly reorder tasks. Order is automatically saved to the backend.
- **Filters**: Quickly filter tasks by **All**, **Active**, and **Completed**.
- **Persistent Storage**: Automatically saves all tasks to a local `todos.json` file.
- **Zero External Dependencies**: Powered entirely by Node.js built-in standard libraries (`http`, `fs`, `path`).

---

## Getting Started

### 1. Start the Server
Run the application with:

```bash
node server.js
```
*(or `npm start`)*

### 2. Open the App in Your Browser
Visit:
```
http://localhost:3000
```

---

## Project Structure

```
To_Do_App/
├── package.json        # Project metadata and start script
├── server.js          # Lightweight Node.js HTTP server & REST API
├── todos.json         # JSON storage for your tasks
└── public/
    ├── index.html     # Semantic, accessible UI structure
    ├── style.css      # Clean, minimalist styling & responsive layout
    └── app.js         # Client-side reactivity, API calls & state management
```

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/todos` | Retrieve all tasks |
| `POST` | `/api/todos` | Add a new task (`{ "title": "..." }`) |
| `PATCH` | `/api/todos/:id` | Update task (`{ "completed": true }`) |
| `PUT` | `/api/todos/reorder` | Save new task ordering (`{ "ids": [...] }`) |
| `DELETE` | `/api/todos/:id` | Delete a task by ID |
