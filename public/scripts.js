document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const tasksContainer = document.getElementById('tasks');
    const staffContainer = document.getElementById('staff-list');
    const addStaffForm = document.getElementById('add-staff-form');
    const editModal = document.getElementById('edit-modal');
    const editStaffForm = document.getElementById('edit-staff-form');
    const closeModal = document.querySelector('.modal .close');
    const taskForm = document.getElementById('task-form');

    // Navbar setup
    if (navbar) {
        fetch('/api/current-user')
            .then(res => res.json())
            .then(user => {
                if (user && ['admin', 'manager'].includes(user.role)) {
                    navbar.innerHTML = `
                        <a href="/">Tasks</a>
                        <a href="/admin">Admin</a>
                        <a href="/archive">Archive</a>
                        <a href="/staff">Staff Management</a>
                        <a href="/logout">Logout</a>
                    `;
                    navbar.style.display = 'flex';
                } else {
                    navbar.style.display = 'none';
                }
            })
            .catch(err => console.error('Navbar fetch error:', err));
    }

    // Populate allocatedTo select in admin
    if (taskForm) {
        fetch('/api/staff')
            .then(res => res.json())
            .then(users => {
                const select = document.getElementById('task-allocated-to');
                users.forEach(user => {
                    if (user.role !== 'admin') {
                        const option = document.createElement('option');
                        option.value = user.username;
                        option.textContent = user.username;
                        select.appendChild(option);
                    }
                });
            });

        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('title', document.getElementById('task-title').value);
            formData.append('type', document.getElementById('task-type').value);
            formData.append('description', document.getElementById('task-description').value);
            formData.append('dueDate', document.getElementById('task-due-date').value);
            formData.append('urgency', document.getElementById('task-urgency').value);
            formData.append('allocatedTo', document.getElementById('task-allocated-to').value);
            formData.append('image', document.getElementById('task-image').files[0]);

            const res = await fetch('/api/tasks', {
                method: 'POST',
                body: formData
            });
            const task = await res.json();
            const card = document.createElement('div');
            card.className = 'task-card';
            card.dataset.id = task.id;
            card.innerHTML = `
                <h3>${task.title}</h3>
                <p>Type: ${task.type}</p>
                <p>Allocated To: ${task.allocated_to || 'None'}</p>
                <button class="archive-btn">Archive</button>
                <button class="delete-btn">Delete</button>
            `;
            tasksContainer.appendChild(card);
            taskForm.reset();
        });
    }

    // Task rendering
    if (tasksContainer && window.location.pathname === '/') {
        const filterButtons = document.querySelectorAll('.filter-btn');
        let currentUser = null;
        fetch('/api/current-user')
            .then(res => res.json())
            .then(user => {
                currentUser = user;
                filterButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        filterButtons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        loadTasks(btn.dataset.type);
                    });
                });
                loadTasks('all');
            });

        function loadTasks(type) {
            fetch('/api/tasks')
                .then(res => res.json())
                .then(tasks => {
                    tasksContainer.innerHTML = '';
                    const today = new Date().toISOString().split('T')[0];
                    tasks
                        .filter(task => !task.archived)
                        .filter(task => {
                            if (type === 'all') return true;
                            if (type === 'allocated') return task.allocated_to === currentUser?.username;
                            return task.type === type;
                        })
                        .forEach(task => {
                            const isDueToday = task.due_date === today;
                            const isUrgent = task.urgency === 'urgent' || isDueToday;
                            const card = document.createElement('div');
                            card.className = `task-card ${task.completed ? 'completed' : ''} ${isUrgent ? 'urgent' : ''}`;
                            card.dataset.id = task.id;
                            card.innerHTML = `
                                <h3 class="task-title">${task.title}</h3>
                                <p class="task-type">Type: ${task.type}</p>
                                <div class="task-details ${task.completed ? 'collapsed' : ''}">
                                    <p>Description: ${task.description}</p>
                                    <p>Due: ${task.due_date}</p>
                                    <p>Urgency: ${task.urgency}</p>
                                    <p>Allocated To: ${task.allocated_to || 'None'}</p>
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
    }

    // Admin task management
    if (tasksContainer && window.location.pathname === '/admin') {
        fetch('/api/tasks')
            .then(res => res.json())
            .then(tasks => {
                tasksContainer.innerHTML = '';
                tasks.forEach(task => {
                    const card = document.createElement('div');
                    card.className = 'task-card';
                    card.dataset.id = task.id;
                    card.innerHTML = `
                        <h3>${task.title}</h3>
                        <p>Type: ${task.type}</p>
                        <p>Allocated To: ${task.allocated_to || 'None'}</p>
                        <button class="archive-btn">Archive</button>
                        <button class="delete-btn">Delete</button>
                    `;
                    tasksContainer.appendChild(card);
                });

                document.querySelectorAll('.archive-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        fetch(`/api/tasks/${btn.closest('.task-card').dataset.id}/archive`, { method: 'POST' })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    btn.closest('.task-card').remove();
                                }
                            });
                    });
                });

                document.querySelectorAll('.delete-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        fetch(`/api/tasks/${btn.closest('.task-card').dataset.id}`, { method: 'DELETE' })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    btn.closest('.task-card').remove();
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
                fetch('/api/current-user')
                    .then(res => res.json())
                    .then(currentUser => {
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