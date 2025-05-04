document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  const tasksContainer = document.getElementById('tasks');
  const staffContainer = document.getElementById('staff-list');
  const addStaffForm = document.getElementById('add-staff-form');
  const editModal = document.getElementById('edit-modal');
  const editStaffForm = document.getElementById('edit-staff-form');
  const closeModal = document.querySelector('.modal .close');

  // Navbar setup
  if (navbar) {
      fetch('/api/staff')
          .then(res => res.json())
          .then(user => {
              const currentUser = user.find(u => u.username === (sessionStorage.getItem('username') || ''));
              if (currentUser && ['admin', 'manager'].includes(currentUser.role)) {
                  navbar.innerHTML = `
                      <a href="/">Tasks</a>
                      <a href="/admin">Admin</a>
                      <a href="/archive">Archive</a>
                      <a href="/staff">Staff Management</a>
                      <a href="/logout">Logout</a>
                  `;
              }
          });
  }

  // Task rendering
  if (tasksContainer) {
      const filterButtons = document.querySelectorAll('.filter-btn');
      filterButtons.forEach(btn => {
          btn.addEventListener('click', () => {
              filterButtons.forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              loadTasks(btn.dataset.type);
          });
      });
      loadTasks('all');
  }

  function loadTasks(type) {
      fetch('/api/tasks')
          .then(res => res.json())
          .then(tasks => {
              tasksContainer.innerHTML = '';
              const today = new Date().toISOString().split('T')[0];
              tasks
                  .filter(task => !task.archived)
                  .filter(task => type === 'all' || task.type === type)
                  .forEach(task => {
                      const isDueToday = task.dueDate === today;
                      const isUrgent = task.urgency === 'urgent' || isDueToday;
                      const card = document.createElement('div');
                      card.className = `task-card ${task.completed ? 'completed' : ''} ${isUrgent ? 'urgent' : ''}`;
                      card.dataset.id = task.id;
                      card.innerHTML = `
                          <h3 class="task-title">${task.title}</h3>
                          <p class="task-type">Type: ${task.type}</p>
                          <div class="task-details ${task.completed ? 'collapsed' : ''}">
                              <p>Description: ${task.description}</p>
                              <p>Due: ${task.dueDate}</p>
                              <p>Urgency: ${task.urgency}</p>
                              ${task.image ? `<img src="${task.image}" alt="Task Image" class="task-image">` : ''}
                              ${!task.completed ? `<button class="complete-btn">Task Completed</button>` : ''}
                          </div>
                      `;
                      card.addEventListener('click', (e) => {
                          if (!e.target.classList.contains('complete-btn')) {
                              const details = card.querySelector('.task-details');
                              details.classList.toggle('collapsed');
                          }
                      });
                      tasksContainer.appendChild(card);
                  });

              document.querySelectorAll('.complete-btn').forEach(btn => {
                  btn.addEventListener('click', () => {
                      const card = btn.closest('.task-card');
                      fetch(`/api/tasks/${card.dataset.id}/complete`, { method: 'POST' })
                          .then(res => res.json())
                          .then(data => {
                              if (data.success) {
                                  card.classList.add('completed');
                                  const details = card.querySelector('.task-details');
                                  details.classList.add('collapsed');
                                  btn.remove();
                              }
                          });
                  });
              });
          });
  }

  // Staff management
  if (staffContainer) {
      fetch('/api/staff')
          .then(res => res.json())
          .then(users => {
              const currentUser = users.find(u => u.username === (sessionStorage.getItem('username') || ''));
              staffContainer.innerHTML = '';
              users.forEach(user => {
                  const card = document.createElement('div');
                  card.className = 'staff-card';
                  card.innerHTML = `
                      <p>Username: ${user.username}</p>
                      <p>Role: ${user.role}</p>
                      ${currentUser && currentUser.role === 'admin' ? `
                          <button class="edit-btn" data-id="${user.id}">Edit</button>
                          <button class="delete-btn" data-id="${user.id}">Delete</button>
                      ` : ''}
                  `;
                  staffContainer.appendChild(card);
              });

              if (currentUser && currentUser.role === 'admin') {
                  document.querySelectorAll('.edit-btn').forEach(btn => {
                      btn.addEventListener('click', () => {
                          const user = users.find(u => u.id === parseInt(btn.dataset.id));
                          document.getElementById('edit-staff-id').value = user.id;
                          document.getElementById('edit-staff-username').value = user.username;
                          document.getElementById('edit-staff-role').value = user.role;
                          editModal.style.display = 'block';
                      });
                  });

                  document.querySelectorAll('.delete-btn').forEach(btn => {
                      btn.addEventListener('click', () => {
                          fetch(`/api/staff/${btn.dataset.id}`, { method: 'DELETE' })
                              .then(res => res.json())
                              .then(data => {
                                  if (data.success) {
                                      btn.closest('.staff-card').remove();
                                  }
                              });
                      });
                  });
              }
          });
  }

  if (addStaffForm) {
      addStaffForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const username = document.getElementById('staff-username').value;
          const password = document.getElementById('staff-password').value;
          const role = document.getElementById('staff-role').value;
          fetch('/api/staff', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password, role })
          })
              .then(res => res.json())
              .then(user => {
                  const card = document.createElement('div');
                  card.className = 'staff-card';
                  card.innerHTML = `
                      <p>Username: ${user.username}</p>
                      <p>Role: ${user.role}</p>
                      <button class="edit-btn" data-id="${user.id}">Edit</button>
                      <button class="delete-btn" data-id="${user.id}">Delete</button>
                  `;
                  staffContainer.appendChild(card);
                  addStaffForm.reset();
              });
      });
  }

  if (editStaffForm) {
      editStaffForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const id = document.getElementById('edit-staff-id').value;
          const username = document.getElementById('edit-staff-username').value;
          const password = document.getElementById('edit-staff-password').value;
          const role = document.getElementById('edit-staff-role').value;
          fetch(`/api/staff/${id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password, role })
          })
              .then(res => res.json())
              .then(data => {
                  if (data.success) {
                      editModal.style.display = 'none';
                      window.location.reload();
                  }
              });
      });
  }

  if (closeModal) {
      closeModal.addEventListener('click', () => {
          editModal.style.display = 'none';
      });
  }

  window.addEventListener('click', (e) => {
      if (e.target === editModal) {
          editModal.style.display = 'none';
      }
  });
});