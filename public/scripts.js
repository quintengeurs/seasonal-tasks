document.addEventListener('DOMContentLoaded', () => {
  const taskList = document.getElementById('task-list');

  // Fetch tasks from server
  fetch('/tasks.json')
    .then(response => response.json())
    .then(tasks => {
      if (tasks.length === 0) {
        taskList.innerHTML = '<p>No tasks available.</p>';
        return;
      }

      const ul = document.createElement('ul');
      ul.className = 'task-list';

      tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.status === 'completed' ? 'completed-task' : ''}`;
        li.innerHTML = `
          ${task.title} - 
          ${task.dueDate ? `Due: ${new Date(task.dueDate).toDateString()}` : 'No due date'} -
          Season: ${task.season || 'None'} - 
          Status: ${task.status}
          ${task.imagePath ? `<br><img src="${task.imagePath}" alt="Task Image" class="task-image" onerror="this.style.display='none'">` : ''}
        `;
        ul.appendChild(li);
      });

      taskList.appendChild(ul);
    })
    .catch(error => {
      console.error('Error fetching tasks:', error);
      taskList.innerHTML = '<p>Error loading tasks.</p>';
    });
});