/**
 * Dashboard Module - Overview and Statistics
 */

async function initDashboard() {
    try {
        const stats = await fetchJSON(`${API_BASE}/stats`);
        updateDashboardStats(stats);
        loadDashboardHistory();
    } catch (err) { console.error('Lỗi dashboard:', err); }
}

function updateDashboardStats(stats) {
    // Current Finance Balance
    const balanceEl = document.getElementById('dash-balance');
    const incomeEl = document.getElementById('dash-income');
    const expensesEl = document.getElementById('dash-expenses');
    
    if (balanceEl) balanceEl.innerText = formatVNĐ(stats.finance.remaining);
    if (incomeEl) incomeEl.innerText = formatVNĐ(stats.finance.income);
    if (expensesEl) expensesEl.innerText = formatVNĐ(stats.finance.expenses);

    // Goal (First Goal Progress if exists)
    // You can iterate through all or just the top one
}

async function loadDashboardHistory() {
    const listEl = document.getElementById('dash-recent-history');
    if (!listEl) return;
    try {
        const activities = await fetchJSON(`${API_BASE}/activities?limit=5`);
        listEl.innerHTML = activities.length > 0 ? activities.map(item => createActivityItemHTML(item, true)).join('') : '<div class="text-center py-8 text-gray-400 italic">Chưa có hoạt động mới. Hãy bắt đầu ngay!</div>';
    } catch (err) { console.error('Lỗi tải lịch sử dashboard:', err); }
}

async function loadHistory(limit = 15, offset = 0, append = false) {
    const gridEl = document.getElementById('history-memory-grid');
    if (!gridEl) return;
    
    if (!append) gridEl.innerHTML = '<div class="col-span-full text-center py-20 opacity-50"><i class="fas fa-spinner fa-spin text-3xl mb-4"></i><p>Đang tìm lại kỷ niệm...</p></div>';

    try {
        const activities = await fetchJSON(`${API_BASE}/activities?limit=${limit}&offset=${offset}`);
        
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
                loadMoreBtn.onclick = () => loadHistory(limit, offset + limit, true);
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
