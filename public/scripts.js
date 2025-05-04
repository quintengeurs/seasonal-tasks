document.addEventListener('DOMContentLoaded', () => {
  const taskList = document.getElementById('task-list');
  const assignedToFilter = document.getElementById('assignedTo');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const navbar = document.querySelector('.navbar');
  let tasks = [];
  let users = [];

  // Hide navbar for non-admin/manager users
  fetch('/users.json')
    .then(response => response.json())
    .then(data => {
      users = data;
      const user = users.find(u => u.username === document.cookie.split('; ').find(row => row.startsWith('username='))?.split('=')[1]);
      if (!user || !['admin', 'manager'].includes(user.role)) {
        navbar.style.display = 'none';
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
    })
    .catch(error => console.error('Error fetching users:', error));

  // Fetch and display tasks
  const renderTasks = () => {
    fetch('/tasks.json')
      .then(response => response.json())
      .then(data => {
        tasks = data;
        taskList.innerHTML = '';

        if (tasks.length === 0) {
          taskList.innerHTML = '<p>No tasks available.</p>';
          return;
        }

        const typeFilter = document.querySelector('.filter-btn.active')?.dataset.type || 'all';
        const assignedTo = assignedToFilter ? assignedToFilter.value : 'all';

        const filteredTasks = tasks.filter(task => {
          const matchesType = typeFilter === 'all' || task.type === typeFilter;
          const matchesAssigned = assignedTo === 'all' || task.assignedTo === parseInt(assignedTo);
          return matchesType && matchesAssigned;
        });

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
            ` : `
              <div class="task-actions">
                <form action="/tasks/${task.id}/delete" method="POST" style="display:inline;">
                  <button type="submit" class="delete-btn">Delete</button>
                </form>
                <form action="/tasks/${task.id}/archive" method="POST" style="display:inline;">
                  <button type="submit" class="archive-btn" ${task.archived ? 'disabled' : ''}>Archive</button>
                </form>
              </div>
            `}
          `;
          taskList.appendChild(card);
        });
      })
      .catch(error => {
        console.error('Error fetching tasks:', error);
        taskList.innerHTML = '<p>Error loading tasks.</p>';
      });
  };

  renderTasks();
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      renderTasks();
    });
  });
  if (assignedToFilter) {
    assignedToFilter.addEventListener('change', renderTasks);
  }
});