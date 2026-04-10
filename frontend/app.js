// Matcha System - Shared Logic & State
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:3000/api' 
    : '/api';

function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
        updateToggleState(true);
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
        updateToggleState(false);
    }
}

function initDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
}

// Helper: Format VNĐ
function formatVNĐ(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

// Helper: Get Vietnamese Weekday
function getCurrentWeekdayVi() {
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[new Date().getDay()];
}

// Helper: Check if current time is within or after task start time
function isTaskTime(startTimeStr) {
    const now = new Date();
    const currMins = now.getHours() * 60 + now.getMinutes();
    const [h, m] = startTimeStr.split(':').map(Number);
    return currMins >= (h * 60 + m);
}

// Helper: Check if current time is within the task window
function isTaskActive(start, end) {
    const now = new Date();
    const currMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return currMins >= (sh * 60 + sm) && currMins <= (eh * 60 + em);
}

function updateToggleState(isDark) {
    const btnLight = document.getElementById('btn-light-mode');
    const btnDark = document.getElementById('btn-dark-mode');
    if (!btnLight || !btnDark) return;

    if (isDark) {
        btnDark.classList.add('bg-white', 'shadow-sm', 'text-blue-500');
        btnDark.classList.remove('text-gray-400');
        btnLight.classList.remove('bg-white', 'shadow-sm', 'text-yellow-500');
        btnLight.classList.add('text-gray-400');
    } else {
        btnLight.classList.add('bg-white', 'shadow-sm', 'text-yellow-500');
        btnLight.classList.remove('text-gray-400');
        btnDark.classList.remove('bg-white', 'shadow-sm', 'text-blue-500');
        btnDark.classList.add('text-gray-400');
    }
}

// ─── Mobile Sidebar System (Toggle + Swipe + Backdrop) ────────────────────
(function initMobileSidebar() {
    document.addEventListener('DOMContentLoaded', () => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // 1. Create backdrop overlay
        const backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-40 opacity-0 pointer-events-none transition-opacity duration-300 md:hidden';
        document.body.appendChild(backdrop);

        function openSidebar() {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('opacity-0', 'pointer-events-none');
            backdrop.classList.add('opacity-100', 'pointer-events-auto');
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('opacity-0', 'pointer-events-none');
            backdrop.classList.remove('opacity-100', 'pointer-events-auto');
            document.body.style.overflow = '';
        }

        function isSidebarOpen() {
            return !sidebar.classList.contains('-translate-x-full');
        }

        // 2. Hamburger button toggle
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isSidebarOpen() ? closeSidebar() : openSidebar();
            });
        }

        // 3. Tap backdrop to close
        backdrop.addEventListener('click', closeSidebar);

        // 4. Close on nav link click (mobile)
        sidebar.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 768) closeSidebar();
            });
        });

        // 5. Swipe gestures (refined for native feel)
        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoveX = 0;
        let isSwiping = false;
        const SWIPE_THRESHOLD = 70; // Increased to avoid accidental triggers
        const EDGE_ZONE = 40; 

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = false;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            touchMoveX = e.touches[0].clientX;
            const diffX = touchMoveX - touchStartX;
            const diffY = Math.abs(e.touches[0].clientY - touchStartY);

            // Only horizontal swipes + ignore if we're scrolling vertically
            if (Math.abs(diffX) > diffY && Math.abs(diffX) > 15) {
                isSwiping = true;
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            const diffX = touchMoveX - touchStartX;

            if (window.innerWidth >= 768) return;

            // Swipe Right → Open
            if (diffX > SWIPE_THRESHOLD && touchStartX < EDGE_ZONE && !isSidebarOpen()) {
                openSidebar();
                e.preventDefault(); // Prevent accidental clicks during swipe
            }
            // Swipe Left → Close
            if (diffX < -SWIPE_THRESHOLD && isSidebarOpen()) {
                closeSidebar();
                e.preventDefault(); 
            }
            isSwiping = false;
        }, { passive: false }); // Needs to be non-passive to preventDefault

        // Make globally available
        window.openSidebar = openSidebar;
        window.closeSidebar = closeSidebar;

        // ✨ Initialize New V5.0 Systems
        initSmartMoneyInput();
        injectPremiumStyles();
        initDarkMode(); // Ensure theme is initialized
        initExport(); // Bind backup buttons
    });
})();

function initExport() {
    const exportBtns = document.querySelectorAll('#btn-export');
    exportBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            exportData();
        };
    });
}

async function exportData() {
    try {
        const response = await fetch(`${API_BASE}/export`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `matcha_backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        alert('🌿 Sao lưu dữ liệu thành công! File đã được tải xuống.');
    } catch (err) {
        console.error('Lỗi sao lưu:', err);
        alert('❌ Có lỗi xảy ra khi sao lưu dữ liệu.');
    }
}

function injectPremiumStyles() {
    if (document.getElementById('matcha-premium-styles')) return;
    const style = document.createElement('style');
    style.id = 'matcha-premium-styles';
    style.innerHTML = `
        :root {
            --glass-bg: rgba(255, 255, 255, 0.7);
            --glass-border: rgba(255, 255, 255, 0.3);
        }
        .dark {
            --glass-bg: rgba(31, 41, 55, 0.6);
            --glass-border: rgba(75, 85, 99, 0.3);
        }
        .glass-card {
            background: var(--glass-bg);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            border: 1px solid var(--glass-border);
        }
        .premium-gradient {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }
        .hover-lift {
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @media (min-width: 768px) {
            .hover-lift:hover { transform: translateY(-5px); }
        }
        
        /* Mobile-Specific Refinements */
        @media (max-width: 640px) {
            .responsive-card-p { padding: 1.25rem !important; }
            .responsive-title { font-size: 1.5rem !important; line-height: 2rem !important; }
            .responsive-amount { font-size: 1.125rem !important; }
            .sidebar-item { padding: 0.75rem !important; }
            
            /* Fix for excessive horizontal spacing on small screens */
            .main-content-p { padding: 1rem !important; }
            .grid-gap-small { gap: 1rem !important; }
        }
    `;
    document.head.appendChild(style);
}

// Legacy compat
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('-translate-x-full')) {
        window.openSidebar?.();
    } else {
        window.closeSidebar?.();
    }
}

// Fetch Wrapper
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
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return res.json();
}

// Navigation Helper
function highlightSidebar() {
    const path = window.location.pathname;
    const items = document.querySelectorAll('.sidebar-item');
    items.forEach(item => {
        const href = item.getAttribute('href');
        if (path.endsWith(href) || (path === '/' && href === 'dashboard.html')) {
            item.classList.add('bg-blue-500', 'font-bold');
            item.classList.remove('hover:bg-gray-700');
        } else {
            item.classList.remove('bg-blue-500', 'font-bold');
            item.classList.add('hover:bg-gray-700');
        }
    });
}

// Backup Logic
async function exportBackup() {
    try {
        const data = await fetchJSON(`${API_BASE}/backup/export`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `matcha_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) { console.error('Xuất bản sao lưu thất bại:', err); }
}

async function importBackup(input) {
    if (!input.files || !input.files[0]) return;
    if (!confirm('Hành động này sẽ ghi đè toàn bộ dữ liệu hiện tại. Chạy tiếp?')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            await fetchJSON(`${API_BASE}/backup/import`, 'POST', data);
            alert('Khôi phục dữ liệu thành công!'); window.location.reload();
        } catch (err) { alert('Lỗi khôi phục: Tệp không hợp lệ.'); }
    };
    reader.readAsText(input.files[0]);
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
    highlightSidebar();
    startClock(); 
    initAOS(); // Start animations observer
    initSharedListeners(); // Wire up modals and shared inputs
    loadSidebarAgenda(); // Global agenda visibility
    const sidebarBtn = document.getElementById('sidebar-toggle');
    if (sidebarBtn) sidebarBtn.addEventListener('click', toggleSidebar);
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.addEventListener('click', exportBackup);
});

function initSharedListeners() {
    // Shared Task Verification Logic
    const vPhotoInput = document.getElementById('verify-photo-input');
    if(vPhotoInput) {
        vPhotoInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = e => {
                    document.getElementById('verify-preview-img').src = e.target.result;
                    document.getElementById('verify-preview-img').classList.remove('hidden');
                    document.getElementById('verify-preview-container').classList.add('hidden');
                    document.getElementById('btn-confirm-done').disabled = false;
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    const btnConfirmDone = document.getElementById('btn-confirm-done');
    if(btnConfirmDone) {
        btnConfirmDone.addEventListener('click', async () => {
            const id = document.getElementById('verify-task-id').value;
            const photo = document.getElementById('verify-photo-input').files[0];
            const formData = new FormData();
            formData.append('id', id);
            formData.append('photo', photo);
            const originalText = btnConfirmDone.innerText;
            try {
                btnConfirmDone.innerText = 'Đang gửi...'; btnConfirmDone.disabled = true;
                await fetchJSON(`${API_BASE}/tasks/complete`, 'POST', formData);
                alert('Tuyệt vời! Đã xác nhận hoàn thành công việc.');
                location.reload();
            } catch (err) { 
                alert('Lỗi xác nhận!'); 
                btnConfirmDone.innerText = originalText; btnConfirmDone.disabled = false; 
            }
        });
    }
}

function initAOS() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('aos-animate');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-aos]').forEach(el => {
        el.classList.add('aos-init');
        observer.observe(el);
    });
}


function startClock() {
    const clockEl = document.getElementById('real-time-clock');
    if (!clockEl) return;
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
        clockEl.innerHTML = `<span class="text-blue-500 font-bold">${timeStr}</span> <span class="text-gray-400 text-xs ml-2">${dateStr}</span>`;
    }, 1000);
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = (now - date) / 1000; // seconds
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Hôm nay, ${timeStr}`;
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Hôm qua, ${timeStr}`;
    
    return `${date.toLocaleDateString('vi-VN')} lúc ${timeStr}`;
}


// ================= THE REAL STUFF / BUSINESS LOGIC =================

// --- Dashboard & Agenda ---
// --- Dashboard & Agenda (New Modular Logic) ---
async function initDashboard() {
    try {
        const stats = await fetchJSON(`${API_BASE}/stats`);
        const tasks = await fetchJSON(`${API_BASE}/tasks`);
        const purchases = await fetchJSON(`${API_BASE}/purchases`);

        renderDashboardStats(stats);
        renderTodayAgenda(tasks);
        renderCharts(stats, tasks);
        updateWorkingNow(tasks);
    } catch (err) {
        console.error('Lỗi khởi tạo Dashboard:', err);
    }
}

function renderDashboardStats(stats) {
    const { finance, spent } = stats;
    // ✨ SYNC MATH: Calculate remaining dynamically to ensure consistency
    const currentRemaining = (finance.income || 0) - (spent || 0) - (finance.saving || 0);
    
    document.getElementById('stat-income').innerText = formatVNĐ(finance.income || 0);
    document.getElementById('stat-expenses').innerText = formatVNĐ(spent || 0);
    document.getElementById('stat-saving').innerText = formatVNĐ(finance.saving || 0);
    document.getElementById('stat-remaining').innerText = formatVNĐ(currentRemaining);

    // Health Bar
    const healthSection = document.getElementById('dash-budget-health');
    if (healthSection) {
        const budget = finance.expenses || 1;
        const budgetPercent = Math.min(Math.round((spent / budget) * 100), 150);
        let colorClass = 'bg-blue-500';
        let msg = 'Ngân sách đang ổn định.';
        if(budgetPercent >= 80) { colorClass = 'bg-orange-500'; msg = 'Sắp chạm giới hạn rồi!'; }
        if(budgetPercent >= 100) { colorClass = 'bg-red-500'; msg = 'Tiêu vượt ngân sách!'; }
        
        healthSection.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <span class="text-sm font-black uppercase text-gray-400">Tình hình ví tháng</span>
                <span class="text-xs font-bold ${budgetPercent > 100 ? 'text-red-500' : 'text-gray-500'}">${formatVNĐ(spent)} / ${formatVNĐ(budget)}</span>
            </div>
            <div class="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-4 mb-3 p-1">
                <div class="${colorClass} h-2 rounded-full transition-all duration-1000 shadow-sm" style="width: ${budgetPercent}%"></div>
            </div>
            <p class="text-[10px] italic text-gray-400 font-medium"><i class="fas fa-info-circle mr-1"></i> ${msg}</p>
        `;
    }
}

function renderTodayAgenda(tasks) {
    const currentViDay = getCurrentWeekdayVi();
    const todayTasks = tasks.filter(t => t.weekday === currentViDay && (t.status === 'pending' || t.status === 'postponed'));
    const agendaEl = document.getElementById('dash-today-tasks');
    const weekdayLabel = document.getElementById('current-weekday-label');
    
    if (weekdayLabel) weekdayLabel.innerText = currentViDay;
    if (agendaEl) {
        agendaEl.innerHTML = todayTasks.length > 0 ? todayTasks.map(t => {
            const canDo = isTaskTime(t.start_time);
            return `
                <div class="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gray-50 dark:bg-gray-700/30 rounded-3xl border border-transparent hover:border-blue-500/20 transition-all group gap-4">
                    <div>
                        <p class="font-black text-lg flex items-center gap-2">
                            ${t.task_name}
                            ${t.status === 'postponed' ? '<span class="text-[8px] bg-orange-100 text-orange-500 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Dời lịch</span>' : ''}
                        </p>
                        <p class="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">${t.start_time} - ${t.end_time}</p>
                    </div>
                    <div class="flex gap-2">
                        ${canDo ? 
                            `<button onclick="openVerifyModal(${t.id}, '${t.task_name}')" class="bg-blue-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 hover:shadow-lg transition-all active:scale-95 shadow-md shadow-blue-200 dark:shadow-none">Xong <i class="fas fa-check ml-1"></i></button>
                             <button onclick="openSkipModal(${t.id})" class="bg-white dark:bg-gray-800 text-gray-500 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95 border border-gray-100 dark:border-gray-700">Bận</button>` :
                            `<span class="text-[10px] text-gray-300 font-bold italic">Đang chờ khung giờ...</span>`
                        }
                    </div>
                </div>
            `;
        }).join('') : '<div class="text-center py-10"><p class="text-gray-400 italic font-medium">✨ Không còn việc gì cho hôm nay. Nghỉ ngơi đi!</p></div>';
    }
}

function updateWorkingNow(tasks) {
    const currentViDay = getCurrentWeekdayVi();
    const workingTask = tasks.find(t => t.weekday === currentViDay && isTaskActive(t.start_time, t.end_time) && t.status !== 'done');
    const container = document.getElementById('working-now-container');
    const content = document.getElementById('working-now-content');

    if (container && content) {
        if (workingTask) {
            container.classList.remove('hidden');
            content.innerHTML = `
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
                    <div class="space-y-4">
                        <h4 class="text-2xl md:text-4xl font-black">${workingTask.task_name}</h4>
                        <p class="text-sm opacity-80 font-medium tracking-tight">Từ ${workingTask.start_time} đến ${workingTask.end_time} — Bạn đang làm rất tốt!</p>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="openVerifyModal(${workingTask.id}, '${workingTask.task_name}')" class="px-8 py-4 bg-white text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">Xác nhận <i class="fas fa-check-circle ml-1"></i></button>
                        <button onclick="openSkipModal(${workingTask.id})" class="px-8 py-4 bg-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/20">Bận</button>
                    </div>
                </div>
            `;
        } else {
            container.classList.add('hidden');
        }
    }
}

// Stats Chart Implementation
let charts = {};
function renderCharts(stats, tasks) {
    // 1. Spending Chart (Comparison)
    const ctxSpend = document.getElementById('chart-spending');
    if (ctxSpend) {
        if (charts.spend) charts.spend.destroy();
        charts.spend = new Chart(ctxSpend, {
            type: 'bar',
            data: {
                labels: ['Ngân sách', 'Đã tiêu', 'Tiết kiệm'],
                datasets: [{
                    label: 'Số dư (VNĐ)',
                    data: [stats.finance.expenses, stats.spent, stats.finance.saving],
                    backgroundColor: ['#3b82f6', '#ef4444', '#10b981'],
                    borderRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return ` ${context.dataset.label}: ${formatVNĐ(context.raw)}`;
                            }
                        }
                    }
                },
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        grid: { display: false },
                        ticks: {
                            callback: (value) => value.toLocaleString('vi-VN') + ' đ'
                        }
                    }, 
                    x: { grid: { display: false } } 
                }
            }
        });
    }

    // 2. Task Stats Chart
    const ctxTasks = document.getElementById('chart-tasks');
    if (ctxTasks) {
        if (charts.tasks) charts.tasks.destroy();
        const done = stats.tasks.find(s => s.status === 'done')?.count || 0;
        const pending = stats.tasks.find(s => s.status === 'pending')?.count || 0;
        const failed = stats.tasks.find(s => s.status === 'skipped' || s.status === 'missed')?.count || 0;

        charts.tasks = new Chart(ctxTasks, {
            type: 'doughnut',
            data: {
                labels: ['Hoàn thành', 'Đang chờ', 'Bỏ qua'],
                datasets: [{
                    data: [done, pending, failed],
                    backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } }
            }
        });
    }
}

async function handleFinanceSubmit(e) {
    e.preventDefault();
    const income = parseSmartAmount(document.getElementById('fin-income').value);
    const expenses = parseSmartAmount(document.getElementById('fin-expenses').value);
    const saving = parseSmartAmount(document.getElementById('fin-saving').value);
    const remaining = income - expenses - saving;
    try {
        await fetchJSON(`${API_BASE}/finance`, 'POST', {
            month: new Date().toISOString().slice(0, 7),
            income, expenses, saving
        });
        
        // Also log as generic activity if it's a major update
        await fetchJSON(`${API_BASE}/finance/income`, 'POST', { amount: income, title: 'Cập nhật ngân sách tháng' });
        
        document.getElementById('fin-result').innerText = formatVNĐ(remaining);
        document.getElementById('fin-result-card').classList.remove('hidden');
        alert('Đã cập nhật báo cáo tháng!');
    } catch (err) { alert('Lỗi lưu báo cáo!'); }
}

async function handleGoalSubmit(e) {
    e.preventDefault();
    const goal_name = document.getElementById('goal-name').value;
    const target_amount = parseSmartAmount(document.getElementById('goal-target').value);
    const deadline_months = Number(document.getElementById('goal-deadline').value);
    try {
        await fetchJSON(`${API_BASE}/goals`, 'POST', {
            goal_name, target_amount, deadline_months, current_saved: 0
        });
        alert('Đã thêm mục tiêu tiết kiệm mới!');
        location.reload();
    } catch (err) { alert('Lỗi thêm mục tiêu!'); }
}

// --- History / Nhật ký Unified Feed V5.0 ---
async function loadHistory(filterType = 'all') {
    const listEl = document.getElementById('history-timeline');
    if (!listEl) return;
    try {
        const activities = await fetchJSON(`${API_BASE}/activities`);
        
        let filtered = activities;
        if (filterType === 'task') filtered = activities.filter(a => a.type.startsWith('task'));
        if (filterType === 'purchase' || filterType === 'expense') filtered = activities.filter(a => a.type === 'expense');

        listEl.innerHTML = filtered.length > 0 ? filtered.map(item => {
            const timeDisplay = formatRelativeTime(new Date(item.created_at));
            const isTask = item.type.startsWith('task');
            const isIncome = item.type === 'income';
            const isSaving = item.type === 'saving';
            const isExpense = item.type === 'expense';
            
            // Icon & Color Logic
            let icon = 'fa-shopping-cart';
            let colorClass = 'blue';
            let label = 'Hoạt động';

            if (isTask) { icon = 'fa-check-circle'; colorClass = 'purple'; label = 'Công việc'; }
            if (isIncome) { icon = 'fa-plus-circle'; colorClass = 'green'; label = 'Thu nhập'; }
            if (isSaving) { icon = 'fa-piggy-bank'; colorClass = 'teal'; label = 'Tiết kiệm'; }
            if (isExpense) { icon = 'fa-shopping-cart'; colorClass = 'red'; label = 'Chi tiêu'; }

            return `
                <div class="glass-card bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-xl border border-white/20 dark:border-gray-700/30 hover:scale-[1.02] transition-all duration-300" 
                     data-aos="fade-up">
                    <div class="flex justify-between items-start gap-4">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-${colorClass}-100 dark:bg-${colorClass}-900/30 text-${colorClass}-500 rounded-2xl flex items-center justify-center shadow-inner">
                                <i class="fas ${icon} text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-${colorClass}-500/80 uppercase font-black tracking-[0.2em] mb-1">${label}</p>
                                <h4 class="font-bold text-lg leading-tight text-gray-900 dark:text-white">${item.title}</h4>
                            </div>
                        </div>
                        <div class="text-right">
                            ${item.amount ? `<p class="text-xl font-black ${isIncome ? 'text-green-500' : 'text-blue-500'}">${isIncome ? '+' : ''}${formatVNĐ(item.amount)}</p>` : ''}
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">${timeDisplay}</p>
                        </div>
                    </div>
                    ${item.photo_path ? `
                        <div class="mt-5 relative group overflow-hidden rounded-3xl shadow-lg cursor-zoom-in" onclick="openImage('${item.photo_path}')">
                            <img src="${item.photo_path}" class="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-110">
                            <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                        </div>` : ''}
                </div>
            `;
        }).join('') : '<div class="col-span-full text-center py-20 opacity-50 italic text-gray-500">Chưa có dấu chân nào trong nhật ký...</div>';
    } catch (err) { console.error('Lỗi tải nhật ký:', err); }
}

// ✨ Smart Money Input Formatting
function initSmartMoneyInput() {
    const amountInputs = document.querySelectorAll('input[type="number"], input#pur-amount, input#fin-income, input#fin-expenses, input#fin-saving');
    amountInputs.forEach(input => {
        // Replace number inputs with text to support dots and 'k' suffixes
        if (input.type === 'number') {
            input.type = 'text';
            input.inputMode = 'text';
        }
        
        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9ktr mbt,.]/gi, '');
            // Auto-format with dots if it's just numbers
            if (/^\d+$/.test(val.replace(/[.,]/g, ''))) {
                const numeric = val.replace(/[.,]/g, '');
                e.target.value = new Intl.NumberFormat('vi-VN').format(numeric);
            } else {
                e.target.value = val;
            }
        });
    });
}

function parseSmartAmount(text) {
    if (!text) return 0;
    let valStr = String(text).toLowerCase().replace(/[^0-9ktr mbt,.]/g, '').replace(/[.,]/g, '');
    let val = parseFloat(valStr) || 0;
    
    if (valStr.includes('k')) val *= 1000;
    if (valStr.includes('tr') || valStr.includes('m')) val *= 1000000;
    if (valStr.includes('b')) val *= 1000000000;
    
    return val;
}
                        ${item.photo_path ? `
                            <div class="relative group overflow-hidden rounded-2xl">
                                <img src="${item.photo_path}" class="w-full max-h-72 object-cover transition-transform duration-500 group-hover:scale-110 cursor-pointer" onclick="openImage('${item.photo_path}')">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                    <span class="text-white text-xs font-bold"><i class="fas fa-search-plus mr-1"></i> Xem chi tiết</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                const isDone = item.status === 'done';
                const colorClass = isDone ? 'text-green-500' : 'text-red-500';
                const bgClass = isDone ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30';
                const icon = isDone ? 'fa-check-circle' : 'fa-times-circle';
                
                return `
                    <div class="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-lg border border-transparent hover:border-blue-500 transition-all duration-300 space-y-4">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 ${bgClass} ${colorClass} rounded-2xl flex items-center justify-center">
                                    <i class="fas ${isDone ? 'fa-tasks' : 'fa-exclamation-triangle'} text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest">Công việc</p>
                                    <h4 class="font-bold text-lg">${item.task_name}</h4>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-sm font-black ${colorClass}">${isDone ? 'HOÀN THÀNH' : 'BÁO BẬN'}</p>
                                <p class="text-[10px] text-gray-400 font-bold">${timeDisplay}</p>
                            </div>
                        </div>
                        ${item.photo_path ? `
                            <div class="relative group overflow-hidden rounded-2xl">
                                <img src="${item.photo_path}" class="w-full max-h-72 object-cover transition-transform duration-500 group-hover:scale-110 cursor-pointer" onclick="openImage('${item.photo_path}')">
                            </div>
                        ` : ''}
                        ${item.reason ? `<div class="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border-l-4 border-red-500"><p class="text-xs italic text-red-600 dark:text-red-400">Lý do: ${item.reason}</p></div>` : ''}
                    </div>
                `;
            }
        }).join('') : '<div class="text-center py-10 text-gray-400 italic">Chưa có hoạt động nào được ghi lại.</div>';
    } catch (err) { console.error('Lỗi khi tải nhật ký:', err); }
}

// Verification & Reports Logic
function openVerifyModal(id, title) {
    document.getElementById('verify-task-id').value = id;
    document.getElementById('verify-task-title').innerText = title;
    document.getElementById('modal-verify-task').classList.remove('hidden');
    // Reset view
    document.getElementById('verify-preview-img').classList.add('hidden');
    document.getElementById('verify-preview-container').classList.remove('hidden');
    document.getElementById('btn-confirm-done').disabled = true;
    document.getElementById('verify-photo-input').value = '';
}

function closeVerifyModal() { document.getElementById('modal-verify-task').classList.add('hidden'); }

function openSkipModal(id) {
    document.getElementById('verify-task-id').value = id;
    document.getElementById('modal-skip-task').classList.remove('hidden');
}

function closeSkipModal() { document.getElementById('modal-skip-task').classList.add('hidden'); }

async function confirmSkipAction(status) {
    const id = document.getElementById('verify-task-id').value;
    const reason = document.getElementById('skip-reason').value;
    if(!reason) return alert('Hãy cho mình biết lý do bận nhé!');
    
    try {
        await fetchJSON(`${API_BASE}/tasks/skip`, 'POST', { id, reason, status });
        alert(status === 'postponed' ? 'Đã hẹn lại công việc này!' : 'Đã bỏ qua công việc hôm nay.');
        location.reload();
    } catch (err) { alert('Lỗi gửi báo cáo!'); }
}

// --- Schedule Layout rendering ---
function loadTasks() {
    const listEl = document.getElementById('tasks-list');
    if (!listEl) return;
    try {
        fetchJSON(`${API_BASE}/tasks`).then(tasks => {
            listEl.innerHTML = tasks.length > 0 ? tasks.map(t => {
                const isPending = t.status === 'pending' || t.status === 'postponed';
                const canDo = isTaskTime(t.start_time);
                
                let badgeClass = 'bg-yellow-100 text-yellow-700';
                let statusText = 'Đang chờ';
                if (t.status === 'done') { badgeClass = 'bg-green-100 text-green-700'; statusText = 'Xong'; }
                if (t.status === 'skipped') { badgeClass = 'bg-red-100 text-red-700'; statusText = 'Bỏ qua'; }
                if (t.status === 'postponed') { badgeClass = 'bg-orange-100 text-orange-700'; statusText = 'Đang dời'; }

                return `
                    <div class="bg-white dark:bg-gray-800 rounded-[2rem] shadow-lg p-8 space-y-6 border border-transparent hover:border-blue-500/20 transition-all duration-500 group">
                        <div class="flex justify-between items-start">
                            <div class="space-y-1">
                               <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest">${t.weekday} | ${t.start_time} - ${t.end_time}</p>
                               <h4 class="font-black text-xl">${t.task_name}</h4>
                            </div>
                            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${badgeClass}">${statusText}</span>
                        </div>
                        ${isPending ? `
                            <div class="flex gap-3 pt-2">
                               <button onclick="${canDo ? `openVerifyModal(${t.id}, '${t.task_name}')` : ''}" 
                                       class="flex-1 ${canDo ? 'bg-blue-600 shadow-blue-200 dark:shadow-none translate-y-0 opacity-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'} text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95">
                                       <i class="fas fa-camera mr-2"></i> Hoàn thành
                               </button>
                               <button onclick="${canDo ? `openSkipModal(${t.id})` : ''}" 
                                       class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-red-50 hover:text-red-500">
                                       <i class="fas fa-calendar-times"></i>
                               </button>
                            </div>
                        ` : (t.photo_path ? `
                            <div class="relative overflow-hidden rounded-[1.5rem] border border-gray-100 dark:border-gray-700">
                                <img src="${t.photo_path}" class="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer" onclick="openImage('${t.photo_path}')">
                                <div class="absolute top-3 right-3 bg-white/80 backdrop-blur-md px-2 py-1 rounded-lg text-[8px] font-black uppercase text-blue-600">Đã chụp</div>
                            </div>
                        ` : '')}
                    </div>
                `;
            }).join('') : '<div class="text-center py-20 text-gray-400 font-medium italic">Chưa có lịch trình được thiết lập. Hãy thêm mới ngay bên trên!</div>';
        });
    } catch (err) { console.error('Lỗi tải lịch trình:', err); }
}

// --- Finance Purchase Feed ---
async function loadPurchaseFeed() {
    const listEl = document.getElementById('finance-purchase-list');
    if (!listEl) return;
    try {
        const purchases = await fetchJSON(`${API_BASE}/purchases`);
        listEl.innerHTML = purchases.length > 0 ? purchases.map(p => `
            <div class="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex gap-4 items-center">
                ${p.photo_path ? `<img src="${p.photo_path}" class="w-16 h-16 object-cover rounded-lg cursor-pointer flex-shrink-0" onclick="openImage('${p.photo_path}')">` : `<div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400"><i class="fas fa-tag"></i></div>`}
                <div class="flex-1 overflow-hidden">
                    <p class="font-bold truncate">${p.item_name}</p>
                    <p class="text-xs text-gray-400">${new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <span class="text-red-500 font-bold">${formatVNĐ(p.amount)}</span>
            </div>
        `).join('') : '<p class="text-center py-4 text-gray-400 italic">Hôm nay bạn chưa tiêu gì. Thật giỏi!</p>';
    } catch (err) { console.error('Lỗi tải danh mục thu chi:', err); }
}

async function initAgenda() {
    try {
        const tasks = await fetchJSON(`${API_BASE}/tasks`);
        renderAgendaTasks(tasks);
    } catch (err) {
        console.error('Lỗi khởi tạo Agenda:', err);
    }
}

function renderAgendaTasks(tasks) {
    const gridEl = document.getElementById('agenda-task-grid');
    if (!gridEl) return;
    
    const currentViDay = getCurrentWeekdayVi();
    const todayTasks = tasks.filter(t => t.weekday === currentViDay);

    if (todayTasks.length === 0) {
        gridEl.innerHTML = '<div class="col-span-full text-center py-20 opacity-50 italic">Hôm nay chưa có lịch trình nào được thiết lập.</div>';
        return;
    }

    gridEl.innerHTML = todayTasks.map((t, idx) => {
        const active = isTaskActive(t.start_time, t.end_time) && t.status !== 'done';
        const done = t.status === 'done';
        const postponed = t.status === 'postponed';

        let statusBadge = '<span class="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-3 py-1 rounded-full uppercase tracking-widest font-black">Chưa đến</span>';
        if (done) statusBadge = '<span class="text-[10px] bg-green-100 text-green-600 px-3 py-1 rounded-full uppercase tracking-widest font-black">Hoàn thành</span>';
        if (postponed) statusBadge = '<span class="text-[10px] bg-orange-100 text-orange-500 px-3 py-1 rounded-full uppercase tracking-widest font-black">Đã dời lịch</span>';
        if (active) statusBadge = '<span class="text-[10px] bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest font-black animate-pulse">Đang diễn ra</span>';

        return `
            <div data-aos="fade-up" data-aos-delay="${idx * 100}" 
                 class="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 responsive-card-p shadow-sm border ${active ? 'border-blue-500/50 shadow-xl shadow-blue-500/10' : 'border-gray-100 dark:border-gray-700'} relative overflow-hidden group transition-all hover:scale-[1.02]">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-14 h-14 rounded-2xl ${active ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-blue-500'} flex items-center justify-center text-xl shadow-lg">
                        <i class="fas ${done ? 'fa-check-circle' : 'fa-calendar-check'}"></i>
                    </div>
                    ${statusBadge}
                </div>
                
                <h4 class="text-xl font-black mb-1 truncate responsive-title">${t.task_name}</h4>
                <div class="flex items-center gap-2 text-gray-400 text-xs font-bold mb-8 italic">
                    <i class="far fa-clock"></i> ${t.start_time} - ${t.end_time}
                </div>

                <div class="grid grid-cols-2 gap-3 mt-auto">
                    ${!done ? `
                        <button onclick="openVerifyModal(${t.id}, '${t.task_name}')" class="col-span-2 px-6 py-4 bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none">
                            <i class="fas fa-camera"></i> Xác thực ngay
                        </button>
                        <button onclick="openSkipModal(${t.id})" class="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-orange-500 transition-all">Báo bận</button>
                        <button onclick="postponeTask(${t.id})" class="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-blue-500 transition-all">Dời lịch</button>
                    ` : `
                        <div class="col-span-2 py-4 text-center text-green-500 font-bold text-sm bg-green-50 dark:bg-green-900/10 rounded-2xl">
                            <i class="fas fa-check-double mr-2"></i> Đã ghi nhận minh chứng
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

async function loadSidebarAgenda() {
    const listEl = document.getElementById('sidebar-agenda-list');
    if (!listEl) return;
    try {
        const tasks = await fetchJSON(`${API_BASE}/tasks`);
        const currentViDay = getCurrentWeekdayVi();
        const activeTasks = tasks.filter(t => t.weekday === currentViDay && isTaskActive(t.start_time, t.end_time) && t.status !== 'done');
        const upcomingTasks = tasks.filter(t => t.weekday === currentViDay && !isTaskActive(t.start_time, t.end_time) && (t.status === 'pending' || t.status === 'postponed'))
                                    .slice(0, 2);

        if (activeTasks.length === 0 && upcomingTasks.length === 0) {
            listEl.innerHTML = '<div class="p-3 text-[10px] text-gray-400 italic">Hôm nay đã xong hết việc! ✨</div>';
            return;
        }

        // Active Tasks (Đang diễn ra)
        activeTasks.forEach(t => {
            html += `
                <div onclick="window.location.href='agenda.html'" 
                     class="sidebar-item flex items-center justify-between p-3 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/20 transition-all cursor-pointer group mb-1">
                    <div class="flex items-center gap-3 overflow-hidden text-white">
                        <i class="fas fa-bolt w-6 text-center animate-pulse"></i>
                        <div class="overflow-hidden">
                            <p class="text-sm font-bold truncate">${t.task_name}</p>
                            <p class="text-[10px] opacity-80 font-medium whitespace-nowrap">Đang diễn ra</p>
                        </div>
                    </div>
                </div>
            `;
        });

        // Upcoming Tasks (Sắp tới)
        upcomingTasks.forEach(t => {
            html += `
                <div onclick="window.location.href='agenda.html'" 
                     class="sidebar-item flex items-center justify-between p-3 rounded-2xl hover:bg-gray-700 transition-all cursor-pointer group">
                    <div class="flex items-center gap-3 overflow-hidden text-gray-300">
                        <i class="fas fa-calendar-check w-6 text-center"></i>
                        <div class="overflow-hidden">
                            <p class="text-sm font-bold truncate">${t.task_name}</p>
                            <p class="text-[10px] opacity-50 font-medium whitespace-nowrap">${t.start_time} - ${t.end_time}</p>
                        </div>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
    } catch (err) { console.error('Sidebar agenda error:', err); }
}

async function loadGoals() {
    const listEl = document.getElementById('goals-list');
    if (!listEl) return;
    try {
        const goals = await fetchJSON(`${API_BASE}/goals`);
        listEl.innerHTML = goals.length > 0 ? goals.map(g => {
            const progress = Math.min(100, Math.round(g.progress || 0));
            return `
                <div class="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg border border-transparent hover:border-blue-500 transition-all group">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fas fa-bullseye"></i>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest">Tiến độ</p>
                            <p class="text-xl font-black text-blue-500">${progress}%</p>
                        </div>
                    </div>
                    <h4 class="text-lg font-bold mb-1">${g.goal_name}</h4>
                    <p class="text-xs text-gray-400 mb-6 font-medium">Mục tiêu: <span class="text-gray-900 dark:text-gray-100 font-bold">${formatVNĐ(g.target_amount)}</span></p>
                    
                    <div class="space-y-2">
                        <div class="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-3 p-1">
                            <div class="bg-blue-500 h-1 rounded-full transition-all duration-1000 shadow-sm shadow-blue-500/50" style="width: ${progress}%"></div>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                            <span>0 VNĐ</span>
                            <span>${formatVNĐ(g.target_amount)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('') : '<div class="col-span-full text-center py-20 opacity-50 italic">Bạn chưa thiết lập mục tiêu nào. Hãy bắt đầu ngay!</div>';
    } catch (err) { console.error('Lỗi tải mục tiêu:', err); }
}

// Map page logic initialization
if (window.location.pathname.includes('dashboard.html') || window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
    initDashboard();
}
if (window.location.pathname.includes('agenda.html')) {
    initAgenda();
}
if (window.location.pathname.includes('history.html')) {
    loadHistory();
}
if (window.location.pathname.includes('finance.html')) {
    loadPurchaseFeed();
    const form = document.getElementById('form-finance');
    if (form) form.addEventListener('submit', handleFinanceSubmit);

    // Purchase with Photo logic
    const purForm = document.getElementById('form-purchase-with-photo');
    const purPhotoInput = document.getElementById('pur-photo-input');
    
    if(purPhotoInput) {
        purPhotoInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = e => {
                    document.getElementById('pur-preview-img').src = e.target.result;
                    document.getElementById('pur-preview-img').classList.remove('hidden');
                    document.getElementById('pur-preview-container').classList.add('hidden');
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    if(purForm) {
        purForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('pur-name').value;
            const amountRaw = document.getElementById('pur-amount').value;
            const amount = parseSmartAmount(amountRaw);
            const photo = document.getElementById('pur-photo-input').files[0];
            const btn = document.getElementById('btn-save-purchase');

            if (amount <= 0) return alert('Số tiền không hợp lệ! Thử gõ 30k hoặc 1.5tr xem sao.');

            const formData = new FormData();
            formData.append('item_name', name);
            formData.append('amount', amount);
            if(photo) formData.append('photo', photo);

            try {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Đang lưu...'; 
                btn.disabled = true;
                await fetchJSON(`${API_BASE}/purchases`, 'POST', formData);
                alert('Đã ghi nhận chi tiêu!'); 
                location.reload();
            } catch (err) { 
                alert('Lỗi lưu chi tiêu!'); 
                btn.innerText = 'Lưu chi tiêu ngay'; 
                btn.disabled = false; 
            }
        });
    }
}
if (window.location.pathname.includes('goals.html')) {
    const formG = document.getElementById('form-goals');
    if (formG) formG.addEventListener('submit', handleGoalSubmit);
    
    const formF = document.getElementById('form-finance');
    if (formF) formF.addEventListener('submit', handleFinanceSubmit);

    loadGoals();
}
if (window.location.pathname.includes('schedule.html')) {
    const form = document.getElementById('form-schedule');
    if (form) form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const task_name = document.getElementById('task-name').value;
        const weekday = document.getElementById('task-weekday').value;
        const start_time = document.getElementById('task-start').value;
        const end_time = document.getElementById('task-end').value;
        try {
            await fetchJSON(`${API_BASE}/tasks`, 'POST', { task_name, weekday, start_time, end_time });
            alert('Đã thêm công việc vào lịch trình!'); location.reload();
        } catch (err) { alert('Lỗi lưu lịch trình!'); }
    });
    loadTasks();
}
