# Clean & Simple To-Do App

A minimalist, responsive to-do application built with **Node.js** and modern vanilla web technologies (HTML5, CSS3, JavaScript).

---

## Features

- **Add Tasks**: Type a task title, choose an optional category and due date, and press <kbd>Enter</kbd> or click **Add**.
- **Categories & Badges**: Organize tasks by categories like **Work**, **Personal**, **Urgent**, **Study**, and **Home** with color-coded badges.
- **Due Dates & Deadlines**: Set deadlines with date pickers. Tasks show dynamic status badges including **Overdue**, **Due Today**, and **Due Tomorrow**.
- **Filter by Status & Category**: Filter simultaneously by completion state (**All**, **Active**, **Completed**) and category.
- **Complete Tasks**: Toggle completion with custom checkbox animations. Completed tasks are strikethrough-styled and updated live.
- **Delete Tasks**: Remove tasks with the delete icon.
- **Dark Mode Support**: One-click toggle between crisp light mode and deep slate dark mode. Remembers your preference in `localStorage` and respects system preferences automatically.
- **Drag & Drop Reordering**: Drag any task using its handle to smoothly reorder tasks. Order is automatically saved to the backend.
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
| `POST` | `/api/todos` | Add a new task (`{ "title": "...", "category": "Work", "dueDate": "2026-10-31" }`) |
| `PATCH` | `/api/todos/:id` | Update task fields (`{ "completed": true, "category": "...", "dueDate": "..." }`) |
| `PUT` | `/api/todos/reorder` | Save new task ordering (`{ "ids": [...] }`) |
| `DELETE` | `/api/todos/:id` | Delete a task by ID |
