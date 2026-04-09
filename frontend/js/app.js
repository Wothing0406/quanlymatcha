// Navigation
function showTab(tabId) {
    document.querySelectorAll('main > section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    // Update Nav UI
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if(nav.dataset.tab === tabId) nav.classList.add('active');
    });

    if(tabId === 'dashboard') loadDashboard();
    if(tabId === 'tasks') loadTasks();
}

// Global state
let financeChartInstance = null;
let taskFile = null;
let purFile = null;

// ================= FETCH DATA FUNCTIONS =================

async function fetchJSON(url, method = 'GET', body = null) {
    const options = { method, headers: {} };
    if (body) {
        if (body instanceof FormData) {
            options.body = body;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }
    const res = await fetch(url, options);
    return res.json();
}

async function loadDashboard() {
    const [finance, goals, tasks, purchases] = await Promise.all([
        fetchJSON('/api/finance'),
        fetchJSON('/api/goals'),
        fetchJSON('/api/tasks'),
        fetchJSON('/api/purchases')
    ]);

    // Update stats
    const totalSaving = finance.reduce((acc, row) => acc + row.saving, 0);
    const totalRemaining = finance.reduce((acc, row) => acc + row.remaining, 0);
    const latest = finance[0] || { income: 0, expenses: 0, remaining: 0, saving: 0 };

    document.getElementById('dash-total-saving').innerText = `$${totalSaving}`;
    document.getElementById('dash-current-remaining').innerText = `$${latest.remaining}`;

    // Tasks list
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    document.getElementById('dash-tasks-list').innerHTML = pendingTasks.length > 0
        ? pendingTasks.map(t => `
            <div class="flex justify-between items-center p-3 bg-matcha-light dark:bg-matcha-dark rounded-2xl border border-matcha-border">
                <div>
                   <p class="font-bold">${t.task_name}</p>
                   <p class="text-xs opacity-60">${t.start_time} - ${t.end_time}</p>
                </div>
                <button onclick="openVerifyModal(${t.id}, '${t.task_name}')" class="bg-matcha-accent px-3 py-1 rounded-full text-white text-xs">Xong</button>
            </div>`).join('')
        : '<p class="text-center opacity-50 py-4 italic text-sm">Hôm nay chưa có lịch gì chill.</p>';

    // Purchases
    document.getElementById('dash-recent-purchases').innerHTML = purchases.length > 0
        ? purchases.map(p => `
            <div class="flex-none w-28 bg-matcha-card border border-matcha-border rounded-2xl p-2 text-center shadow-sm">
                <img src="${p.photo_path || 'https://via.placeholder.com/100?text=Matcha'}" class="w-full h-20 object-cover rounded-xl mb-2">
                <p class="text-[10px] font-bold truncate opacity-80">${p.item_name}</p>
                <p class="text-xs font-bold text-matcha-accent">$${p.amount}</p>
            </div>`).join('')
        : '<p class="opacity-40 text-xs">Chưa có chi tiêu.</p>';

    updateChart(finance);
}

function updateChart(financeData) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    const data = [...financeData].reverse();
    const labels = data.map(d => d.month);
    const savings = data.map(d => d.saving);
    if(financeChartInstance) financeChartInstance.destroy();
    
    financeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: savings,
                borderColor: '#8fb9a8',
                backgroundColor: 'rgba(143, 185, 168, 0.2)',
                tension: 0.4,
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { 
                y: { display: false },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

// ================= TASKS =================

async function loadTasks() {
    const tasks = await fetchJSON('/api/tasks');
    const container = document.getElementById('task-list-container');
    container.innerHTML = tasks.length > 0 ? tasks.map(t => {
        let statusColor = "bg-orange-100 text-orange-600";
        let statusText = "Đang chờ";
        if(t.status === 'done') { statusColor = "bg-green-100 text-green-600"; statusText = "Đã xong"; }
        if(t.status === 'skipped') { statusColor = "bg-red-100 text-red-600"; statusText = "Báo bận"; }

        return `
        <div class="card flex justify-between items-center">
            <div>
                <h4 class="font-bold">${t.task_name}</h4>
                <p class="text-xs opacity-60">${t.start_time} - ${t.end_time}</p>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] px-2 py-1 rounded-full font-bold ${statusColor}">${statusText}</span>
                ${t.status === 'pending' ? `<button onclick="openVerifyModal(${t.id}, '${t.task_name}')" class="text-matcha-accent"><i class="fas fa-camera text-xl"></i></button>` : ''}
            </div>
        </div>`;
    }).join('') : '<div class="text-center py-10 opacity-50 italic">Chill đi, không có task nào.</div>';
}

function openAddTask() {
    document.getElementById('modal-add-task').classList.remove('hidden');
}
function closeAddTask() {
    document.getElementById('modal-add-task').classList.add('hidden');
}

function openVerifyModal(id, name) {
    document.getElementById('verify-task-id').value = id;
    document.getElementById('verify-task-title').innerText = name;
    document.getElementById('modal-verify-task').classList.remove('hidden');
    // reset
    taskFile = null;
    document.getElementById('task-photo-preview').classList.add('hidden');
    document.getElementById('btn-task-submit').classList.add('hidden');
    document.getElementById('task-camera-input').value = '';
}

function closeVerifyModal() {
    document.getElementById('modal-verify-task').classList.add('hidden');
}

// Handle Camera Input (Tasks)
document.getElementById('task-camera-input').addEventListener('change', function(e) {
    if(this.files && this.files[0]) {
        taskFile = this.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('task-photo-preview');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            document.getElementById('btn-task-submit').classList.remove('hidden');
        };
        reader.readAsDataURL(taskFile);
    }
});

async function submitTaskDone() {
    if(!taskFile) return alert('Hãy chụp ảnh để xác nhận nhé!');
    const id = document.getElementById('verify-task-id').value;
    const formData = new FormData();
    formData.append('id', id);
    formData.append('photo', taskFile);
    await fetchJSON('/api/tasks/complete', 'POST', formData);
    closeVerifyModal();
    loadDashboard();
    loadTasks();
    alert('Matcha đã ghi nhận! Giỏi lắm.');
}
document.getElementById('btn-task-submit').onclick = submitTaskDone;

async function submitTaskSkip() {
    const reason = document.getElementById('task-skip-reason').value;
    if(!reason) return alert('Hãy cho mình biết lý do vì sao bạn bận nhé!');
    const id = document.getElementById('verify-task-id').value;
    await fetchJSON('/api/tasks/skip', 'POST', { id, reason });
    closeVerifyModal();
    loadDashboard();
    loadTasks();
    alert('Đã báo bận thành công.');
}

// ================= PURCHASES =================
document.getElementById('pur-camera-input').addEventListener('change', function(e) {
    if(this.files && this.files[0]) {
        purFile = this.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('pur-photo-preview');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(purFile);
    }
});

document.getElementById('form-purchase').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!purFile) return alert('Chụp ảnh món đồ bạn mua cái nào!');
    const formData = new FormData();
    formData.append('item_name', document.getElementById('pur-name').value);
    formData.append('amount', document.getElementById('pur-amount').value);
    formData.append('photo', purFile);
    await fetchJSON('/api/purchases', 'POST', formData);
    e.target.reset();
    document.getElementById('pur-photo-preview').classList.add('hidden');
    purFile = null;
    alert('Đã lưu chi tiêu rồi nha.');
    loadDashboard();
});

// ================= FINANCE & GOALS =================
document.getElementById('form-finance').onsubmit = async (e) => {
    e.preventDefault();
    await fetchJSON('/api/finance', 'POST', {
        month: document.getElementById('fin-month').value,
        income: Number(document.getElementById('fin-income').value),
        expenses: Number(document.getElementById('fin-expenses').value),
        saving: Number(document.getElementById('fin-saving').value)
    });
    alert('Xong! Tài khoản đã cập nhật.');
    loadDashboard();
};

document.getElementById('form-goals').onsubmit = async (e) => {
    e.preventDefault();
    await fetchJSON('/api/goals', 'POST', {
        goal_name: document.getElementById('goal-name').value,
        target_amount: Number(document.getElementById('goal-target').value),
        deadline_months: 6,
        current_saved: 0
    });
    alert('Mục tiêu mới đã được tạo!');
    loadDashboard();
};

// ================= BACKUP =================
async function exportBackup() {
    const data = await fetchJSON('/api/backup/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `matcha_backup_${new Date().toLocaleDateString()}.json`;
    a.click();
}

async function importBackup(input) {
    if(!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = JSON.parse(e.target.result);
        await fetchJSON('/api/backup/import', 'POST', data);
        alert('Khôi phục xong! 🌀');
        window.location.reload();
    };
    reader.readAsText(input.files[0]);
}

// Add task form
document.getElementById('form-task').onsubmit = async (e) => {
    e.preventDefault();
    await fetchJSON('/api/tasks', 'POST', {
        task_name: document.getElementById('task-name').value,
        start_time: document.getElementById('task-start').value,
        end_time: document.getElementById('task-end').value,
        weekday: 'Any'
    });
    closeAddTask();
    loadTasks();
    loadDashboard();
    e.target.reset();
};

// Start
window.onload = () => {
    showTab('dashboard');
};
