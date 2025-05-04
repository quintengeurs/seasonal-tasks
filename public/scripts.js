document.addEventListener('DOMContentLoaded', () => {
  const taskList = document.getElementById('task-list');
  const assignedToFilter = document.getElementById('assignedTo');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const navbar = document.querySelector('.navbar');
  const staffList = document.getElementById('staff-list');
  const addStaffForm = document.getElementById('add-staff-form');
  let tasks = [];
  let users = [];

  // Handle navbar visibility
  fetch('/users.json')
    .then(response => response.json())
    .then(data => {
      users = data;
      const username = document.cookie.split('; ').find(row => row.startsWith('username='))?.split('=')[1];
      const user = users.find(u => u.username === username);
      if (!user || !['admin', 'manager'].includes(user.role)) {
        navbar.style.display = 'none';
      } else {
        // Update Login/Logout link
        const logoutLink = navbar.querySelector('a[href="/logout"]');
        if (username) {
          logoutLink.textContent = 'Logout';
        } else {
          logoutLink.textContent = 'Login';
          logoutLink.href = '/login';
        }
      }
      // Populate assignedTo dropdown
      if (assignedToFilter) {
        users.forEach(user => {
          const option = document.createElement('option');
          option.value = user.id;
          option.textContent = user.name;
          assignedToFilter.appendChild(option);
        });
      }
      // Render staff list
      if (staffList) {
        renderStaff();
      }
    })
    .catch(error => console.error('Error fetching users:', error));

  // Render tasks
  const renderTasks = () => {
    if (!taskList) return;
    fetch('/tasks.json')
      .then(response => response.json())
      .then(data => {
        tasks = data;
        taskList.innerHTML = '';

        if (tasks.length === 0) {
          taskList.innerHTML = '<p>No tasks available.</p>';
          return;
        }

        let filteredTasks = tasks;
        if (window.location.pathname === '/index' && assignedToFilter && filterButtons.length) {
          const typeFilter = document.querySelector('.filter-btn.active')?.dataset.type || 'all';
          const assignedTo = assignedToFilter.value;
          filteredTasks = tasks.filter(task => {
            const matchesType = typeFilter === 'all' || task.type === typeFilter;
            const matchesAssigned = assignedTo === 'all' || task.assignedTo === parseInt(assignedTo);
            return matchesType && matchesAssigned;
          });
        } else if (window.location.pathname === '/archive') {
          filteredTasks = tasks.filter(task => task.archived);
        }

        filteredTasks.forEach(task => {
          const card = document.createElement('div');
          card.className = `task-card ${task.status === 'completed' ? 'completed-task' : ''}`;
          card.innerHTML = `
            <h3>${task.title}</h3>
            <p>${task.dueDate ? `Due: ${new Date(task.dueDate).toDateString()}` : 'No due date'}</p>
            <p>Season: ${task.season || 'None'}</p>
            <p>Type: ${task.type}</p>
            <p>Status: ${task.status}</p>
            <p>Assigned To: ${users.find(u => u.id === task.assignedTo)?.name || 'None'}</p>
            ${task.imagePath ? `<img src="${task.imagePath}" alt="Task Image" class="task-image" onerror="this.style.display='none'">` : ''}
            ${window.location.pathname === '/index' ? `
              <form action="/tasks/${task.id}/complete" method="POST">
                <button type="submit" class="complete-btn" ${task.status === 'completed' ? 'disabled' : ''}>Task Completed</button>
              </form>
            ` : window.location.pathname === '/admin' ? `
              <div class="task-actions">
                <form action="/tasks/${task.id}/delete" method="POST" style="display:inline;">
                  <button type="submit" class="delete-btn">Delete</button>
                </form>
                <form action="/tasks/${task.id}/archive" method="POST" style="display:inline;">
                  <button type="submit" class="archive-btn" ${task.archived ? 'disabled' : ''}>Archive</button>
                </form>
              </div>
            ` : ''}
          `;
          taskList.appendChild(card);
        });
      })
      .catch(error => {
        console.error('Error fetching tasks:', error);
        taskList.innerHTML = '<p>Error loading tasks.</p>';
      });
  };

  // Render staff
  const renderStaff = () => {
    if (!staffList) return;
    fetch('/users.json')
      .then(response => response.json())
      .then(data => {
        users = data;
        staffList.innerHTML = '';

        if (users.length === 0) {
          staffList.innerHTML = '<p>No staff members.</p>';
          return;
        }

        users.forEach(user => {
          const card = document.createElement('div');
          card.className = 'staff-card';
          card.innerHTML = `
            <h3>${user.name}</h3>
            <p>Username: ${user.username}</p>
            <p>Role: ${user.role}</p>
            <button class="delete-btn" data-id="${user.id}">Delete</button>
          `;
          staffList.appendChild(card);
        });

        // Add delete handlers
        staffList.querySelectorAll('.delete-btn').forEach(button => {
          button.addEventListener('click', () => {
            const userId = button.dataset.id;
            if (confirm('Are you sure you want to delete this staff member?')) {
              fetch(`/staff/${userId}`, { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                  if (data.success) {
                    renderStaff();
                  } else {
                    alert(`Error: ${data.error}`);
                  }
                })
                .catch(error => alert(`Error: ${error.message}`));
            }
          });
        });
      })
      .catch(error => {
        console.error('Error fetching staff:', error);
        staffList.innerHTML = '<p>Error loading staff.</p>';
      });
  };

  // Handle task filters
  if (filterButtons.length && assignedToFilter) {
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        renderTasks();
      });
    });
    assignedToFilter.addEventListener('change', renderTasks);
  }

  // Handle staff form submission
  if (addStaffForm) {
    addStaffForm.addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(addStaffForm);
      const data = {
        username: formData.get('username'),
        password: formData.get('password'),
        name: formData.get('name'),
        role: formData.get('role'),
      };

      fetch('/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            addStaffForm.reset();
            renderStaff();
          } else {
            alert(`Error: ${result.error}`);
          }
        })
        .catch(error => alert(`Error: ${error.message}`));
    });
  }

  // Initial render
  renderTasks();
});