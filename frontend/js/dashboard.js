/**
 * Dashboard Module - Overview and Statistics
 */

async function initDashboard() {
    try {
        const stats = await fetchJSON(`${API_BASE}/finance/stats`);
        updateDashboardStats(stats);
        
        // Load Today's Agenda (from tasks.js)
        if (typeof initAgenda === 'function') {
            await initAgenda();
            const weekdayEl = document.getElementById('current-weekday-label');
            if (weekdayEl) {
                const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                weekdayEl.innerText = days[new Date().getDay()];
            }
        }

        loadDashboardHistory();
        initGamification(); 
    } catch (err) { 
        console.error('Lỗi dashboard:', err);
        const gridEl = document.getElementById('agenda-task-grid');
        if (gridEl) gridEl.innerHTML = `<div class="text-center py-10 text-red-500 font-bold">Không thể kết nối Database. Vui lòng kiểm tra lại Bot!</div>`;
    }
}


async function initGamification() {
    try {
        const stats = await fetchJSON(`${API_BASE}/user/stats`);
        renderGamification(stats);
    } catch (err) {
        console.error('Lỗi lấy stats gamification:', err);
    }
}

function renderGamification(stats) {
    const levelEl = document.getElementById('user-level');
    const pointsEl = document.getElementById('user-points');
    const expBarEl = document.getElementById('exp-bar');
    const petAvatarEl = document.getElementById('pet-avatar');
    const petStatusEl = document.getElementById('pet-status-text');

    if (levelEl) levelEl.innerText = `Level ${stats.level}`;
    if (pointsEl) pointsEl.innerText = `${stats.current_points} pts`;
    
    // Calculate EXP progress (0-1000)
    const expProgress = (stats.total_exp % 1000) / 10;
    if (expBarEl) expBarEl.style.width = `${expProgress}%`;

    // Pet State UI
    const states = {
        'happy': { emoji: '🍵', text: 'Đang rất vui!' },
        'sad': { emoji: '🍶', text: 'Đang giận dỗi...' },
        'neutral': { emoji: '🍵', text: 'Đang theo dõi bạn' },
        'sick': { emoji: '🔥', text: 'Đang bốc hỏa!' }
    };
    const current = states[stats.pet_state] || states['neutral'];
    if (petAvatarEl) petAvatarEl.innerText = current.emoji;
    if (petStatusEl) petStatusEl.innerText = current.text;
}

function updateDashboardStats(stats) {
    // Current Finance Balance
    const incomeEl = document.getElementById('stat-income');
    const expensesEl = document.getElementById('stat-expenses');
    const savingEl = document.getElementById('stat-saving');
    const remainingEl = document.getElementById('stat-remaining');
    
    if (incomeEl) incomeEl.innerText = formatVNĐ(stats.finance.income);
    if (expensesEl) expensesEl.innerText = formatVNĐ(stats.finance.expenses);
    if (savingEl) savingEl.innerText = formatVNĐ(stats.finance.saving);
    if (remainingEl) remainingEl.innerText = formatVNĐ(stats.finance.remaining);

    // Also populate Budget Health (ProgressBar)
    const healthContainer = document.getElementById('dash-budget-health');
    if (healthContainer && stats.finance.income > 0) {
        const spentRatio = Math.min((stats.finance.expenses / stats.finance.income) * 100, 100);
        const colorClass = spentRatio > 80 ? 'bg-red-500' : (spentRatio > 50 ? 'bg-orange-500' : 'bg-blue-500');
        healthContainer.innerHTML = `
            <div class="flex justify-between items-end mb-4">
                <div>
                    <h4 class="text-xs font-black uppercase text-gray-400 mb-1">Hạn mức chi tiêu</h4>
                    <p class="text-lg font-black">${spentRatio.toFixed(1)}% đã dùng</p>
                </div>
                <p class="text-[10px] font-bold text-gray-400 italic">Mục tiêu: < 80%</p>
            </div>
            <div class="w-full h-4 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden border border-gray-100 dark:border-gray-800">
                <div class="h-full ${colorClass} transition-all duration-1000" style="width: ${spentRatio}%"></div>
            </div>
        `;
    }

    // Chart data mapping
    const spentData = [Math.max(stats.finance.income, 1), stats.finance.expenses, stats.finance.saving];

    
    // Rendering Spending Chart
    const ctxSpend = document.getElementById('chart-spending');
    if (ctxSpend && !window.spendingChart) {
        window.spendingChart = new Chart(ctxSpend, {
            type: 'doughnut',
            data: {
                labels: ['Thu nhập', 'Đã chi', 'Tiết kiệm'],
                datasets: [{
                    data: spentData,
                    backgroundColor: ['#10b981', '#f43f5e', '#3b82f6'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: { cutout: '70%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { family: 'Outfit' } } } } }
        });
    }

    // Task Analytics
    const tasksDone = stats.tasks.find(t => t.status === 'done')?.count || 0;
    const tasksMissed = stats.tasks.find(t => t.status === 'skipped')?.count || 0;
    const tasksPostponed = stats.tasks.find(t => t.status === 'postponed')?.count || 0;
    const tasksOngoing = stats.tasks.find(t => t.status === 'ongoing')?.count || 0;
    const tasksPending = stats.tasks.find(t => t.status === 'pending')?.count || 0;

    const ctxTask = document.getElementById('chart-tasks');
    if (ctxTask && !window.tasksChart) {
        window.tasksChart = new Chart(ctxTask, {
            type: 'bar',
            data: {
                labels: ['Thành công', 'Bị nhỡ', 'Đã dời', 'Đang làm', 'Chưa làm'],
                datasets: [{
                    label: 'Số lượng nhiệm vụ',
                    data: [tasksDone, tasksMissed, tasksPostponed, tasksOngoing, tasksPending],
                    backgroundColor: ['#10b981', '#f43f5e', '#f59e0b', '#3b82f6', '#9ca3af'],
                    borderRadius: 8
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(156, 163, 175, 0.1)' } }, x: { grid: { display: false } } } }
        });
    }
}

async function loadDashboardHistory() {
    const listEl = document.getElementById('dash-recent-history');
    if (!listEl) return;
    try {
        const activities = await fetchJSON(`${API_BASE}/activities?limit=5`);
        listEl.innerHTML = activities.length > 0 ? activities.map(item => createActivityItemHTML(item, true)).join('') : '<div class="text-center py-8 text-gray-400 italic">Chưa có hoạt động mới. Hãy bắt đầu ngay!</div>';
    } catch (err) { console.error('Lỗi tải lịch sử dashboard:', err); }
}

async function loadHistory(type = 'all', limit = 15, offset = 0, append = false) {
    const gridEl = document.getElementById('history-memory-grid');
    if (!gridEl) return;
    
    if (!append) gridEl.innerHTML = '<div class="col-span-full text-center py-20 opacity-50"><i class="fas fa-spinner fa-spin text-3xl mb-4"></i><p>Đang tìm lại kỷ niệm...</p></div>';

    try {
        const activities = await fetchJSON(`${API_BASE}/activities?type=${type}&limit=${limit}&offset=${offset}`);
        
        if (activities.length === 0 && !append) {
            gridEl.innerHTML = '<div class="col-span-full text-center py-20 opacity-50 italic">Bạn chưa có kỷ niệm nào được lưu lại.</div>';
            return;
        }

        const html = activities.map(item => createLocketCardHTML(item)).join('');
        
        if (append) {
            const container = document.createElement('div');
            container.innerHTML = html;
            while (container.firstChild) gridEl.appendChild(container.firstChild);
        } else {
            gridEl.innerHTML = html;
        }

        // Logic for "Load More" button
        const loadMoreBtn = document.getElementById('btn-load-more');
        if (loadMoreBtn) {
            if (activities.length < limit) loadMoreBtn.classList.add('hidden');
            else {
                loadMoreBtn.classList.remove('hidden');
                loadMoreBtn.onclick = () => loadHistory(type, limit, offset + limit, true);
            }
        }
    } catch (err) { console.error('Lỗi tải lịch sử:', err); }
}


function createLocketCardHTML(item) {
    const timeDisplay = formatRelativeTime(new Date(item.created_at));
    const isTask = item.type.startsWith('task');
    const isFin = ['income', 'expense', 'saving'].includes(item.type);
    
    let label = 'Kỷ niệm';
    let icon = 'fa-leaf';
    if (isTask) { label = 'Hoạt động'; icon = 'fa-calendar-check'; }
    if (isFin) { label = 'Tài chính'; icon = 'fa-wallet'; }

    return `
        <div class="glass-card rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all duration-500 shadow-xl relative">
            <div class="aspect-[4/5] relative bg-gray-100 dark:bg-gray-800">
                ${item.photo_path ? `
                    <img src="${item.photo_path}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000">
                ` : `
                    <div class="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                        <i class="fas ${icon} text-6xl"></i>
                    </div>
                `}
                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 pt-12">
                    <p class="text-[10px] text-white/60 font-black uppercase tracking-[0.2em] mb-1">${label}</p>
                    <h4 class="text-white font-bold text-lg leading-tight mb-2">${item.title}</h4>
                    <div class="flex items-center gap-2 text-white/50 text-[10px] font-bold">
                        <i class="far fa-clock"></i> ${timeDisplay}
                        ${item.amount ? `<span class="ml-auto text-blue-400 font-black">${formatVNĐ(item.amount)}</span>` : ''}
                    </div>
                </div>
            </div>
            ${item.photo_path ? `
                <button onclick="openImage('${item.photo_path}')" class="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fas fa-expand-alt"></i>
                </button>
            ` : ''}
        </div>
    `;
}
