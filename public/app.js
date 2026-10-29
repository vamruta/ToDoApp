document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoCategory = document.getElementById('todo-category');
  const todoDueDate = document.getElementById('todo-due-date');
  const todoList = document.getElementById('todo-list');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const categoryFilter = document.getElementById('category-filter');
  const itemsLeftSpan = document.getElementById('items-left');
  const emptyState = document.getElementById('empty-state');
  const emptyStateText = document.getElementById('empty-state-text');
  const todayDateElement = document.getElementById('today-date');

  let todos = [];
  let currentStatusFilter = 'all';
  let currentCategoryFilter = 'all';
  let draggedItem = null;

  // Format today's date in header
  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  todayDateElement.textContent = new Date().toLocaleDateString(undefined, options);

  // Helper to format due date and status
  function formatDueDate(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const target = new Date(year, month, day);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = target - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedShort = `${monthNames[month]} ${day}`;

    if (diffDays < 0) {
      return { text: `Overdue: ${formattedShort}`, status: 'due-overdue' };
    } else if (diffDays === 0) {
      return { text: 'Due Today', status: 'due-today' };
    } else if (diffDays === 1) {
      return { text: 'Due Tomorrow', status: 'due-upcoming' };
    } else {
      return { text: `Due: ${formattedShort}`, status: 'due-upcoming' };
    }
  }

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

  // Render todos based on current filters
  function renderTodos() {
    const filteredTodos = todos.filter(todo => {
      // Status filter
      if (currentStatusFilter === 'active' && todo.completed) return false;
      if (currentStatusFilter === 'completed' && !todo.completed) return false;

      // Category filter
      if (currentCategoryFilter !== 'all') {
        if (!todo.category || todo.category.toLowerCase() !== currentCategoryFilter.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    todoList.innerHTML = '';

    if (filteredTodos.length === 0) {
      emptyState.style.display = 'flex';
      if (currentStatusFilter === 'completed') {
        emptyStateText.textContent = 'No completed tasks yet.';
      } else if (currentStatusFilter === 'active') {
        emptyStateText.textContent = 'All caught up! No active tasks.';
      } else if (currentCategoryFilter !== 'all') {
        emptyStateText.textContent = `No tasks in "${currentCategoryFilter}".`;
      } else {
        emptyStateText.textContent = 'No tasks yet. Add one above!';
      }
    } else {
      emptyState.style.display = 'none';

      filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;
        li.setAttribute('draggable', 'true');

        // Build metadata badges (Category & Due Date)
        let metaHtml = '';
        if (todo.category) {
          const safeCat = escapeHtml(todo.category);
          const catClass = `category-${todo.category.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          metaHtml += `<span class="badge badge-category ${catClass}">${safeCat}</span>`;
        }
        if (todo.dueDate) {
          const dueInfo = formatDueDate(todo.dueDate);
          if (dueInfo) {
            metaHtml += `
              <span class="badge badge-date ${!todo.completed ? dueInfo.status : ''}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${escapeHtml(dueInfo.text)}
              </span>`;
          }
        }

        const metaContainerHtml = metaHtml ? `<div class="todo-meta">${metaHtml}</div>` : '';

        li.innerHTML = `
          <div class="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8" cy="6" r="2"></circle>
              <circle cx="16" cy="6" r="2"></circle>
              <circle cx="8" cy="12" r="2"></circle>
              <circle cx="16" cy="12" r="2"></circle>
              <circle cx="8" cy="18" r="2"></circle>
              <circle cx="16" cy="18" r="2"></circle>
            </svg>
          </div>
          <label class="checkbox-container">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} aria-label="Mark task complete">
            <span class="custom-checkbox">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </label>
          <div class="todo-content">
            <span class="todo-text">${escapeHtml(todo.title)}</span>
            ${metaContainerHtml}
          </div>
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

        // Drag events
        li.addEventListener('dragstart', (e) => {
          if (e.target.closest('input') || e.target.closest('.delete-btn')) {
            e.preventDefault();
            return;
          }
          draggedItem = li;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', todo.id);
          setTimeout(() => li.classList.add('dragging'), 0);
        });

        li.addEventListener('dragend', () => {
          li.classList.remove('dragging');
          draggedItem = null;

          const newIds = Array.from(todoList.querySelectorAll('.todo-item')).map(item => item.dataset.id);
          syncAndSaveOrder(newIds);
        });

        todoList.appendChild(li);
      });
    }

    // Update active count
    const activeCount = todos.filter(t => !t.completed).length;
    itemsLeftSpan.textContent = `${activeCount} ${activeCount === 1 ? 'task' : 'tasks'} left`;
  }

  // Add Todo
  async function addTodo(title, category, dueDate) {
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, dueDate })
      });
      if (!res.ok) throw new Error('Failed to create task');
      const newTodo = await res.json();
      todos.unshift(newTodo);
      renderTodos();
      todoInput.value = '';
      todoDueDate.value = '';
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

  // Drag & drop reordering on container
  todoList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const dragging = document.querySelector('.todo-item.dragging');
    if (!dragging) return;

    const afterElement = getDragAfterElement(todoList, e.clientY);
    if (afterElement == null) {
      todoList.appendChild(dragging);
    } else {
      todoList.insertBefore(dragging, afterElement);
    }
  });

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Sync reordered items with state and server
  async function syncAndSaveOrder(newIds) {
    const idToIndex = new Map(newIds.map((id, index) => [id, index]));
    todos.sort((a, b) => {
      const idxA = idToIndex.has(a.id) ? idToIndex.get(a.id) : Infinity;
      const idxB = idToIndex.has(b.id) ? idToIndex.get(b.id) : Infinity;
      return idxA - idxB;
    });

    try {
      const res = await fetch('/api/todos/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: newIds })
      });
      if (!res.ok) throw new Error('Failed to persist order');
    } catch (err) {
      console.error('Error saving reordered tasks:', err);
      fetchTodos();
    }
  }

  // Form submit
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    const category = todoCategory.value || null;
    const dueDate = todoDueDate.value || null;

    if (title) {
      addTodo(title, category, dueDate);
    }
  });

  // Status Filter click handlers
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatusFilter = btn.dataset.status;
      renderTodos();
    });
  });

  // Category Filter handler
  categoryFilter.addEventListener('change', () => {
    currentCategoryFilter = categoryFilter.value;
    renderTodos();
  });

  // Escape HTML helper
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');

  function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('todo_theme', theme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = getActiveTheme();
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }

  // Listen to OS theme changes if user hasn't explicitly set a preference
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('todo_theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });

  // Initial load
  fetchTodos();
});
