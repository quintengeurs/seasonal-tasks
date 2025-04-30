// Populate staff and user dropdowns
async function populateStaffDropdowns() {
  try {
    const [staffResponse, usersResponse] = await Promise.all([
      fetch('/api/staff'),
      fetch('/api/users')
    ]);
    if (!staffResponse.ok || !usersResponse.ok) {
      throw new Error(`HTTP error: staff ${staffResponse.status}, users ${usersResponse.status}`);
    }
    const staff = await staffResponse.json();
    const users = await usersResponse.json();
    const taskStaffSelect = document.getElementById('task-staff');
    const staffFilterSelect = document.getElementById('staff-filter');

    // Combine staff and users for dropdowns
    const combinedOptions = [
      ...staff.map((s) => ({ name: s.name, display: s.name })),
      ...users.map((u) => ({ name: u.username, display: `${u.username} (${u.accountType.charAt(0).toUpperCase() + u.accountType.slice(1)})` }))
    ];

    if (taskStaffSelect) {
      taskStaffSelect.innerHTML = combinedOptions
        .map((option) => `<option value="${option.name}">${option.display}</option>`)
        .join('');
    }

    if (staffFilterSelect) {
      staffFilterSelect.innerHTML = `<option value="All">All Staff</option>` + 
        combinedOptions
          .map((option) => `<option value="${option.name}">${option.display}</option>`)
          .join('');
    }
  } catch (error) {
    console.error('Error populating staff and user dropdowns:', error);
  }
}

// Update nav bar based on session
async function updateNavBar() {
  try {
    const response = await fetch('/api/check-session');
    const navLinks = document.getElementById('nav-links');
    const authLink = document.getElementById('auth-link');
    if (!navLinks || !authLink) return;

    if (response.ok) {
      const data = await response.json();
      if (data.user) {
        authLink.textContent = 'Logout';
        authLink.href = '/logout';
        const accountType = data.user.accountType;
        if (accountType === 'generic') {
          navLinks.innerHTML = `
            <a href="/" class="font-semibold hover:underline">Home</a>
            <a href="/logout" class="font-semibold hover:underline" id="auth-link">Logout</a>
          `;
        } else if (accountType === 'manager') {
          navLinks.innerHTML = `
            <a href="/" class="font-semibold hover:underline">Home</a>
            <a href="/admin" class="font-semibold hover:underline">Admin</a>
            <a href="/archive" class="font-semibold hover:underline">Archive</a>
            <a href="/logout" class="font-semibold hover:underline" id="auth-link">Logout</a>
          `;
        } else if (accountType === 'admin') {
          navLinks.innerHTML = `
            <a href="/" class="font-semibold hover:underline">Home</a>
            <a href="/admin" class="font-semibold hover:underline">Admin</a>
            <a href="/archive" class="font-semibold hover:underline">Archive</a>
            <a href="/staff" class="font-semibold hover:underline">Staff</a>
            <a href="/logout" class="font-semibold hover:underline" id="auth-link">Logout</a>
          `;
        }
      } else {
        authLink.textContent = 'Login';
        authLink.href = '/login';
        navLinks.innerHTML = `
          <a href="/" class="font-semibold hover:underline">Home</a>
          <a href="/login" class="font-semibold hover:underline" id="auth-link">Login</a>
        `;
      }
    } else {
      authLink.textContent = 'Login';
      authLink.href = '/login';
      navLinks.innerHTML = `
        <a href="/" class="font-semibold hover:underline">Home</a>
        <a href="/login" class="font-semibold hover:underline" id="auth-link">Login</a>
      `;
    }
  } catch (error) {
    console.error('Error updating nav bar:', error);
  }
}

// Determine current season based on date
function getCurrentSeason() {
  const today = new Date();
  const month = today.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Autumn';
  return 'Winter';
}

// Check if task is in season
function isTaskInSeason(task) {
  const taskMonth = parseInt(task.dueDate.split('-')[1], 10);
  const season = getCurrentSeason();
  if (season === 'Spring') return taskMonth >= 3 && taskMonth <= 5;
  if (season === 'Summer') return taskMonth >= 6 && taskMonth <= 8;
  if (season === 'Autumn') return taskMonth >= 9 && taskMonth <= 11;
  return taskMonth === 12 || taskMonth === 1 || taskMonth === 2;
}

// Check if task is overdue
function isTaskOverdue(task) {
  if (task.completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.dueDate);
  return dueDate < today;
}

// Fetch and display tasks on main page
async function loadTasks(selectedCategory = 'All', selectedStaff = 'All') {
  try {
    const response = await fetch('/api/tasks');
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const tasks = await response.json();
    console.log('Main page fetched tasks:', tasks);
    const currentSeason = getCurrentSeason();
    const currentSeasonElement = document.getElementById('current-season');
    if (currentSeasonElement) {
      currentSeasonElement.textContent = `Current Season: ${currentSeason}`;
    }

    const categories = [
      'Tree Work',
      'Shrub Work',
      'Lawn Care',
      'Pond Maintenance',
      'Wildflower Meadow Work',
    ];

    // Render category filter buttons
    const categoryFilters = document.getElementById('category-filters');
    if (categoryFilters) {
      categoryFilters.innerHTML = `
        <button class="category-button ${selectedCategory === 'All' ? 'active' : ''}" data-category="All">All</button>
        ${categories
          .map(
            (category) => `
              <button class="category-button ${selectedCategory === category ? 'active' : ''}" data-category="${category}">${category}</button>
            `
          )
          .join('')}
      `;

      // Add event listeners to filter buttons
      document.querySelectorAll('.category-button').forEach((button) => {
        button.addEventListener('click', () => {
          const category = button.getAttribute('data-category');
          loadTasks(category, selectedStaff);
        });
      });

      // Add event listener to staff filter
      const staffFilter = document.getElementById('staff-filter');
      if (staffFilter) {
        staffFilter.value = selectedStaff;
        staffFilter.addEventListener('change', () => {
          loadTasks(selectedCategory, staffFilter.value);
        });
      }
    }

    // Filter tasks by season, category, staff, and exclude archived
    const filteredTasks = tasks.filter(
      (task) =>
        !task.archived &&
        isTaskInSeason(task) &&
        (selectedCategory === 'All' || task.category === selectedCategory) &&
        (selectedStaff === 'All' || task.staff === selectedStaff)
    );

    const taskCategories = document.getElementById('task-categories');
    if (taskCategories) {
      taskCategories.innerHTML = '';
      categories.forEach((category) => {
        const seasonalTasks = filteredTasks.filter((task) => task.category === category);
        if (seasonalTasks.length > 0) {
          const categoryDiv = document.createElement('div');
          categoryDiv.innerHTML = `
            <h2 class="text-xl font-semibold mb-4">${category}</h2>
            <div class="space-y-4">
              ${seasonalTasks
                .map(
                  (task, index) => `
                    <div class="task-card bg-white p-4 rounded shadow-md season-${task.season?.toLowerCase() || 'spring'} ${isTaskOverdue(task) ? 'overdue' : ''}" data-task-id="${task.id}">
                      <div class="task-header">
                        <h3 class="text-lg font-bold">${task.title}</h3>
                        <p class="text-sm text-gray-600">Task ${index + 1} | ${task.category}</p>
                      </div>
                      <div class="task-details">
                        <p class="mt-2">${task.description}</p>
                        ${task.image ? `<img src="${task.image}" alt="${task.title}" class="task-image">` : ''}
                        <p class="mt-2 text-sm text-gray-600">Assigned to: ${task.staff || 'Unassigned'}</p>
                        <p class="text-sm text-gray-600">Due: ${task.dueDate}</p>
                        <p class="text-sm text-gray-600">Season: ${task.season}</p>
                        ${task.completed ? `<p class="completed-flag mt-2">Completed</p>` : ''}
                      </div>
                      ${
                        task.completed
                          ? ''
                          : `<button class="completed-button mt-2" data-id="${task.id}">Completed</button>`
                      }
                    </div>
                  `
                )
                .join('')}
            </div>
          `;
          taskCategories.appendChild(categoryDiv);
        }
      });

      // Add click handlers for expanding/collapsing task cards
      document.querySelectorAll('.task-card').forEach((card) => {
        card.querySelector('.task-header').addEventListener('click', (e) => {
          e.stopPropagation();
          card.classList.toggle('expanded');
        });
      });

      // Add click handlers for completed buttons
      document.querySelectorAll('.completed-button').forEach((button) => {
        button.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = button.getAttribute('data-id');
          console.log('Marking task as completed:', id);
          try {
            const response = await fetch(`/api/tasks/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ completed: true })
            });
            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            console.log('Task marked as completed:', id);
            loadTasks(selectedCategory, selectedStaff);
          } catch (error) {
            console.error('Error marking task as completed:', error);
            alert('Failed to mark task as completed. Check console for details.');
          }
        });
      });
    }
  } catch (error) {
    console.error('Error loading main page tasks:', error);
    alert('Failed to load tasks. Check console for details.');
  }
}

// Admin page: Load tasks
async function loadAdminTasks() {
  try {
    const response = await fetch('/api/tasks');
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const tasks = await response.json();
    console.log('Admin page fetched tasks:', tasks);
    const taskList = document.getElementById('task-list');
    if (taskList) {
      taskList.innerHTML = tasks
        .filter((task) => !task.archived)
        .map(
          (task) => `
            <div class="flex justify-between items-center p-4 border-b">
              <div>
                <h3 class="font-bold">${task.title}</h3>
                <p>${task.category} | Due: ${task.dueDate} | Assigned to: ${task.staff || 'Unassigned'}</p>
                ${task.image ? `<img src="${task.image}" alt="${task.title}" class="w-16 h-16 object-cover mt-2">` : ''}
                ${task.completed ? `<p class="completed-flag mt-2">Completed</p>` : ''}
              </div>
              <div class="flex gap-2">
                <button class="archive-button py-1 px-3 rounded" data-id="${task.id}">Archive</button>
                <button class="bg-red-600 text-white py-1 px-3 rounded delete-task" data-id="${task.id}">Delete</button>
              </div>
            </div>
          `
        )
        .join('');

      // Add click handlers for delete buttons
      document.querySelectorAll('.delete-task').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.getAttribute('data-id');
          console.log('Deleting task with id:', id);
          try {
            const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            await loadAdminTasks();
          } catch (error) {
            console.error('Error deleting task:', error);
            alert('Failed to delete task. Check console for details.');
          }
        });
      });

      // Add click handlers for archive buttons
      document.querySelectorAll('.archive-button').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.getAttribute('data-id');
          console.log('Archiving task with id:', id);
          try {
            const response = await fetch(`/api/tasks/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ archived: true })
            });
            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            console.log('Task archived:', id);
            await loadAdminTasks();
          } catch (error) {
            console.error('Error archiving task:', error);
            alert('Failed to archive task. Check console for details.');
          }
        });
      });
    }
  } catch (error) {
    console.error('Error loading admin tasks:', error);
    alert('Failed to load tasks. Check console for details.');
  }
}

// Archive page: Load archived tasks
async function loadArchiveTasks() {
  try {
    const response = await fetch('/api/tasks');
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const tasks = await response.json();
    console.log('Archive page fetched tasks:', tasks);
    const archiveList = document.getElementById('archive-list');
    if (archiveList) {
      archiveList.innerHTML = tasks
        .filter((task) => task.archived)
        .map(
          (task) => `
            <div class="flex justify-between items-center p-4 border-b">
              <div>
                <p class="font-bold">${task.title}</p>
                <p class="text-sm text-gray-600">${task.category} | Due: ${task.dueDate} | Assigned to: ${task.staff || 'Unassigned'} | Completed: ${task.completed ? 'Yes' : 'No'}</p>
              </div>
              <button class="bg-red-600 text-white py-1 px-3 rounded delete-task" data-id="${task.id}">Delete</button>
            </div>
          `
        )
        .join('') || '<p class="text-gray-600">No archived tasks.</p>';

      // Add click handlers for delete buttons
      document.querySelectorAll('.delete-task').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.getAttribute('data-id');
          console.log('Deleting archived task with id:', id);
          try {
            const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            await loadArchiveTasks();
          } catch (error) {
            console.error('Error deleting archived task:', error);
            alert('Failed to delete archived task. Check console for details.');
          }
        });
      });
    }
  } catch (error) {
    console.error('Error loading archive tasks:', error);
    alert('Failed to load archived tasks. Check console for details.');
  }
}

// Staff page: Load staff
async function loadStaff() {
  try {
    const response = await fetch('/api/staff');
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const staff = await response.json();
    console.log('Staff page fetched staff:', staff);
    const staffList = document.getElementById('staff-list');
    if (staffList) {
      staffList.innerHTML = staff
        .map(
          (s) => `
            <div class="flex justify-between items-center p-4 border-b">
              <div>
                <p class="font-bold">${s.name}</p>
              </div>
              <div class="flex gap-2">
                <button class="edit-button py-1 px-3 rounded" data-id="${s.id}" data-name="${s.name}">Edit</button>
                <button class="bg-red-600 text-white py-1 px-3 rounded delete-staff" data-id="${s.id}">Delete</button>
              </div>
            </div>
          `
        )
        .join('');

      // Add click handlers for delete buttons
      document.querySelectorAll('.delete-staff').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.getAttribute('data-id');
          console.log('Deleting staff with id:', id);
          try {
            const response = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            await loadStaff();
          } catch (error) {
            console.error('Error deleting staff:', error);
            alert('Failed to delete staff. Check console for details.');
          }
        });
      });

      // Add click handlers for edit buttons
      document.querySelectorAll('.edit-button').forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.getAttribute('data-id');
          const name = button.getAttribute('data-name');
          const staffNameInput = document.getElementById('staff-name');
          const staffForm = document.getElementById('staff-form');
          staffNameInput.value = name;
          staffForm.onsubmit = async (e) => {
            e.preventDefault();
            const newName = staffNameInput.value;
            console.log('Editing staff id:', id, 'to name:', newName);
            try {
              const response = await fetch(`/api/staff/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
              });
              if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
              }
              staffForm.reset();
              staffForm.onsubmit = handleStaffSubmission;
              await loadStaff();
            } catch (error) {
              console.error('Error editing staff:', error);
              alert('Failed to edit staff. Check console for details.');
            }
          };
        });
      });
    }
  } catch (error) {
    console.error('Error loading staff:', error);
    alert('Failed to load staff. Check console for details.');
  }
}

// Staff page: Load users
async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const users = await response.json();
    console.log('Staff page fetched users:', users);
    const userList = document.getElementById('user-list');
    if (userList) {
      userList.innerHTML = users
        .map(
          (u) => `
            <div class="p-4 border-b">
              <div class="flex justify-between items-center">
                <p class="font-bold">${u.username} (${u.accountType})</p>
                <div class="flex gap-2">
                  <button class="edit-button py-1 px-3 rounded toggle-edit-form" data-id="${u.id}" data-username="${u.username}" data-password="${u.password}" data-account-type="${u.accountType}">Edit</button>
                  <button class="bg-red-600 text-white py-1 px-3 rounded delete-user" data-id="${u.id}">Delete</button>
                </div>
              </div>
              <form class="user-edit-form mt-2" id="edit-user-form-${u.id}" style="display: none;">
                <div class="mb-4">
                  <label class="block text-gray-700">Username</label>
                  <input type="text" name="username" value="${u.username}" class="w-full p-2 border rounded" required>
                </div>
                <div class="mb-4">
                  <label class="block text-gray-700">Password</label>
                  <input type="password" name="password" value="${u.password}" class="w-full p-2 border rounded" required>
                </div>
                <div class="mb-4">
                  <label class="block text-gray-700">Account Type</label>
                  <select name="accountType" class="w-full p-2 border rounded" required>
                    <option value="generic" ${u.accountType === 'generic' ? 'selected' : ''}>Generic</option>
                    <option value="manager" ${u.accountType === 'manager' ? 'selected' : ''}>Manager</option>
                    <option value="admin" ${u.accountType === 'admin' ? 'selected' : ''}>Admin</option>
                  </select>
                </div>
                <button type="submit" class="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700">Update User</button>
              </form>
            </div>
          `
        )
        .join('');

      // Add click handlers for toggle edit form
      document.querySelectorAll('.toggle-edit-form').forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.getAttribute('data-id');
          const form = document.getElementById(`edit-user-form-${id}`);
          const isExpanded = form.style.display === 'block';
          document.querySelectorAll('.user-edit-form').forEach(f => f.style.display = 'none');
          form.style.display = isExpanded ? 'none' : 'block';
          form.classList.toggle('expanded', !isExpanded);
        });
      });

      // Add click handlers for edit form submission
      document.querySelectorAll('.user-edit-form').forEach((form) => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const id = form.id.split('-').pop();
          const formData = new FormData(form);
          const updatedUser = {
            username: formData.get('username'),
            password: formData.get('password'),
            accountType: formData.get('accountType')
          };
          console.log('Editing user id:', id, 'to:', updatedUser);
          try {
            const response = await fetch(`/api/users/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedUser)
            });
            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            await loadUsers();
          } catch (error) {
            console.error('Error editing user:', error);
            alert('Failed to edit user. Check console for details.');
          }
        });
      });

      // Add click handlers for delete buttons
      document.querySelectorAll('.delete-user').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.getAttribute('data-id');
          console.log('Deleting user with id:', id);
          try {
            const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            await loadUsers();
          } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user. Check console for details.');
          }
        });
      });
    }
  } catch (error) {
    console.error('Error loading users:', error);
    alert('Failed to load users. Check console for details.');
  }
}

// Admin page: Handle task form submission
function handleFormSubmission() {
  const form = document.getElementById('task-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dueDate = document.getElementById('task-due-date').value;
      if (!dueDate) {
        alert('Please select a due date');
        return;
      }

      const formData = new FormData(form);
      formData.append('season', getCurrentSeason());
      console.log('Submitting task form data');
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          body: formData
        });
        console.log('POST response:', response.status, response.statusText);
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        const result = await response.text();
        console.log('POST result:', result);
        form.reset();
        await loadAdminTasks();
      } catch (error) {
        console.error('Error adding task:', error);
        alert('Failed to add task. Check console for details.');
      }
    });
  }

  // Handle season quick-fill buttons
  const seasonButtons = document.querySelectorAll('.season-fill');
  seasonButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const season = button.getAttribute('data-season');
      const dueDateInput = document.getElementById('task-due-date');
      if (season === 'Spring') {
        dueDateInput.value = '2025-03-01';
      } else if (season === 'Summer') {
        dueDateInput.value = '2025-06-01';
      } else if (season === 'Autumn') {
        dueDateInput.value = '2025-09-01';
      } else if (season === 'Winter') {
        dueDateInput.value = '2025-12-01';
      }
    });
  });
}

// Staff page: Handle staff form submission
function handleStaffSubmission() {
  const form = document.getElementById('staff-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('staff-name').value;
      console.log('Submitting staff form data:', name);
      try {
        const response = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        form.reset();
        await loadStaff();
      } catch (error) {
        console.error('Error adding staff:', error);
        alert('Failed to add staff. Check console for details.');
      }
    });
  }
}

// Staff page: Handle user form submission
function handleUserSubmission() {
  const form = document.getElementById('user-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('user-username').value;
      const password = document.getElementById('user-password').value;
      const accountType = document.getElementById('user-account-type').value;
      console.log('Submitting user form data:', username, accountType);
      try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, accountType })
        });
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        form.reset();
        await loadUsers();
      } catch (error) {
        console.error('Error adding user:', error);
        alert('Failed to add user. Check console for details.');
      }
    });
  }
}

// Login page: Handle login form submission
function handleLoginSubmission() {
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const username = formData.get('username');
      const password = formData.get('password');
      console.log('Submitting login form:', username);
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ username, password })
        });
        if (response.redirected) {
          console.log('Login successful, redirecting to:', response.url);
          window.location.href = response.url;
        } else if (response.ok) {
          console.log('Login successful, but no redirect provided');
          window.location.href = '/'; // Fallback to index page
        } else {
          const errorText = await response.text();
          console.error('Login failed:', errorText);
          alert(errorText || 'Invalid credentials');
          form.reset();
        }
      } catch (error) {
        console.error('Error logging in:', error);
        alert('Failed to login. Check console for details.');
        form.reset();
      }
    });
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  await updateNavBar();
  await populateStaffDropdowns();

  if (document.getElementById('task-categories')) {
    await loadTasks();
  }
  if (document.getElementById('task-form')) {
    await loadAdminTasks();
    handleFormSubmission();
  }
  if (document.getElementById('archive-list')) {
    await loadArchiveTasks();
  }
  if (document.getElementById('staff-form')) {
    await loadStaff();
    await loadUsers();
    handleStaffSubmission();
    handleUserSubmission();
  }
  if (document.getElementById('login-form')) {
    handleLoginSubmission();
  }
});