document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const itemsLeftSpan = document.getElementById('items-left');
  const emptyState = document.getElementById('empty-state');
  const emptyStateText = document.getElementById('empty-state-text');
  const todayDateElement = document.getElementById('today-date');

  let todos = [];
  let currentFilter = 'all';

  // Format today's date
  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  todayDateElement.textContent = new Date().toLocaleDateString(undefined, options);

  // Fetch todos from server
  async function fetchTodos() {
    try {
      const res = await fetch('/api/todos');
      if (!res.ok) throw new Error('Failed to load tasks');
      todos = await res.json();
      renderTodos();
    } catch (err) {
      console.error(err);
    }
  }

  // Render todos based on current filter
  function renderTodos() {
    const filteredTodos = todos.filter(todo => {
      if (currentFilter === 'active') return !todo.completed;
      if (currentFilter === 'completed') return todo.completed;
      return true;
    });

    todoList.innerHTML = '';

    if (filteredTodos.length === 0) {
      emptyState.style.display = 'flex';
      if (currentFilter === 'completed') {
        emptyStateText.textContent = 'No completed tasks yet.';
      } else if (currentFilter === 'active') {
        emptyStateText.textContent = 'All caught up! No active tasks.';
      } else {
        emptyStateText.textContent = 'No tasks yet. Add one above!';
      }
    } else {
      emptyState.style.display = 'none';

      filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        li.innerHTML = `
          <label class="checkbox-container">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} aria-label="Mark task complete">
            <span class="custom-checkbox">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </label>
          <span class="todo-text">${escapeHtml(todo.title)}</span>
          <button class="delete-btn" aria-label="Delete task">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        `;

        // Checkbox toggle
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));

        // Delete button
        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

        todoList.appendChild(li);
      });
    }

    // Update active count
    const activeCount = todos.filter(t => !t.completed).length;
    itemsLeftSpan.textContent = `${activeCount} ${activeCount === 1 ? 'task' : 'tasks'} left`;
  }

  // Add Todo
  async function addTodo(title) {
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (!res.ok) throw new Error('Failed to create task');
      const newTodo = await res.json();
      todos.unshift(newTodo);
      renderTodos();
      todoInput.value = '';
    } catch (err) {
      console.error(err);
      alert('Could not add task. Please check server connection.');
    }
  }

  // Toggle Todo completion
  async function toggleTodo(id, completed) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const previousStatus = todo.completed;
    todo.completed = completed;
    renderTodos();

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
      });
      if (!res.ok) throw new Error('Failed to update task');
    } catch (err) {
      console.error(err);
      todo.completed = previousStatus;
      renderTodos();
    }
  }

  // Delete Todo
  async function deleteTodo(id) {
    const previousTodos = [...todos];
    todos = todos.filter(t => t.id !== id);
    renderTodos();

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete task');
    } catch (err) {
      console.error(err);
      todos = previousTodos;
      renderTodos();
    }
  }

  // Form submit
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (title) {
      addTodo(title);
    }
  });

  // Filter click handlers
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTodos();
    });
  });

  // Escape HTML helper
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initial load
  fetchTodos();
});

