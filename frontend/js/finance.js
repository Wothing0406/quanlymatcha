/**
 * Finance Module - Budgeting and Expenditure
 */

async function handleFinanceSubmit(e) {
    e.preventDefault();
    const month = document.getElementById('month-select').value;
    const income = parseFloat(document.getElementById('income-input').value) || 0;
    const expenses = parseFloat(document.getElementById('expenses-input').value) || 0;
    const saving = parseFloat(document.getElementById('saving-input').value) || 0;

    try {
        await fetchJSON(`${API_BASE}/finance`, 'POST', { month, income, expenses, saving });
        alert('Cập nhật tài chính thành công! 💰');
        location.reload();
    } catch (err) { alert('Lỗi: ' + err.message); }
}

async function loadPurchaseFeed() {
    const listEl = document.getElementById('finance-purchase-list');
    if (!listEl) return;
    try {
        const activities = await fetchJSON(`${API_BASE}/activities?limit=20`);
        const finActivities = activities.filter(a => ['income', 'expense', 'saving'].includes(a.type));
        listEl.innerHTML = finActivities.length > 0 ? finActivities.map(item => createActivityItemHTML(item)).join('') : '<div class="text-center py-10 text-gray-400 italic">Chưa có biến động số dư nào...</div>';
    } catch (err) { console.error('Lỗi tải lịch sử tài chính:', err); }
}

async function handleGoalSubmit(e) {
    e.preventDefault();
    const data = {
        goal_name: document.getElementById('goal-name').value,
        target_amount: parseFloat(document.getElementById('target-amount').value),
        deadline_months: parseInt(document.getElementById('deadline').value),
        current_saved: parseFloat(document.getElementById('current-saved').value) || 0
    };

    try {
        await fetchJSON(`${API_BASE}/goals`, 'POST', data);
        alert('Đã thêm mục tiêu tiết kiệm mới! 🎯');
        location.reload();
    } catch (err) { alert('Lỗi: ' + err.message); }
}

// Global Activity Item Renderer (Used in Dashboard & Finance)
function createActivityItemHTML(item, isCompact = false) {
    const isIncome = item.type === 'income';
    const isSaving = item.type === 'saving';
    const isExpense = item.type === 'expense';
    const isTask = item.type.startsWith('task');
    const amount = item.amount || 0;
    const timeDisplay = formatRelativeTime(new Date(item.created_at));
    
    let colorClass = 'text-blue-500';
    let bgClass = 'bg-blue-50 dark:bg-blue-900/20';
    let iconClass = 'fa-shopping-cart';
    let sign = '-';
    let label = 'Hoạt động';

    if (isIncome) {
        colorClass = 'text-green-500'; bgClass = 'bg-green-50 dark:bg-green-900/20';
        iconClass = 'fa-plus-circle'; sign = '+'; label = 'Thu nhập';
    } else if (isSaving) {
        colorClass = 'text-teal-500'; bgClass = 'bg-teal-50 dark:bg-teal-900/20';
        iconClass = 'fa-piggy-bank'; sign = ''; label = 'Tiết kiệm';
    } else if (isTask) {
        const isStarted = item.type === 'task_started';
        colorClass = isStarted ? 'text-blue-500' : 'text-purple-500';
        bgClass = isStarted ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-purple-50 dark:bg-purple-900/20';
        iconClass = isStarted ? 'fa-hourglass-start' : (item.type === 'task_done' ? 'fa-check-double' : 'fa-check-circle');
        sign = ''; label = isStarted ? 'Bắt đầu việc' : 'Hoàn thành việc';
    }

    const amountHTML = amount > 0 || isExpense || isIncome ? `
        <div class="text-right flex-shrink-0">
            <p class="font-black ${isCompact ? 'text-[10px]' : 'text-sm'} ${colorClass}">${sign}${formatVNĐ(amount)}</p>
        </div>
    ` : '';

    return `
        <div class="glass-card bg-white dark:bg-gray-800 rounded-2xl ${isCompact ? 'p-3' : 'p-4'} shadow-sm flex items-center gap-4 group">
            <div class="${isCompact ? 'w-10 h-10' : 'w-12 h-12'} ${bgClass} ${colorClass} rounded-2xl flex items-center justify-center flex-shrink-0">
                <i class="fas ${iconClass} ${isCompact ? 'text-lg' : 'text-xl'}"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <div class="min-w-0 overflow-hidden pr-2">
                        <h4 class="font-bold ${isCompact ? 'text-[11px]' : 'text-sm'} truncate text-gray-900 dark:text-white">${item.title}</h4>
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">${label} • ${timeDisplay}</p>
                    </div>
                    ${amountHTML}
                </div>
                ${!isCompact && item.photo_path ? `
                <div class="mt-3 relative rounded-xl overflow-hidden cursor-zoom-in" onclick="openImage('${item.photo_path}')">
                    <img src="${item.photo_path}" class="w-full h-28 object-cover transition-transform duration-700 group-hover:scale-110">
                </div>` : ''}
            </div>
        </div>
    `;
}
