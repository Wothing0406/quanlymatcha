/**
 * Finance Module - Budgeting and Expenditure
 */

async function handleFinanceSubmit(e) {
    e.preventDefault();
    const monthEl = document.getElementById('month-select') || document.getElementById('fin-month');
    const month = monthEl ? monthEl.value : new Date().toISOString().slice(0, 7);
    
    // Support both ID styles
    const incomeEl = document.getElementById('income-input') || document.getElementById('fin-income');
    const expensesEl = document.getElementById('expenses-input') || document.getElementById('fin-expenses');
    const savingEl = document.getElementById('saving-input') || document.getElementById('fin-saving');

    const income = parseSmartAmount(incomeEl ? incomeEl.value : 0);
    const expenses = parseSmartAmount(expensesEl ? expensesEl.value : 0);
    const saving = parseSmartAmount(savingEl ? savingEl.value : 0);

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
        target_amount: parseSmartAmount(document.getElementById('goal-target').value),
        deadline_months: parseInt(document.getElementById('goal-deadline').value) || 12,
        current_saved: 0
    };

    try {
        await fetchJSON(`${API_BASE}/goals`, 'POST', data);
        alert('🎯 Matcha đã ghi nhận mục tiêu mới! Cố gắng tiết kiệm nhé.');
        e.target.reset(); // Clear form
        if (typeof loadGoalsList === 'function') loadGoalsList(); // Refresh list
    } catch (err) { 
        alert('Lỗi: ' + err.message); 
    }
}

async function loadGoalsList() {
    const listEl = document.getElementById('goals-list');
    if (!listEl) return;
    try {
        const goals = await fetchJSON(`${API_BASE}/goals`);
        if (goals.length === 0) {
            listEl.innerHTML = '<div class="col-span-full text-center py-10 opacity-50 italic">Bạn chưa có mục tiêu nào. Hãy thiết lập ngay!</div>';
            return;
        }

        listEl.innerHTML = goals.map(g => {
            const percent = g.target_amount > 0 ? Math.min(100, Math.round((g.current_saved / g.target_amount) * 100)) : 0;
            const remaining = g.target_amount - g.current_saved;
            const bgClass = percent >= 100 ? 'bg-green-500/10 border-green-500/50' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700';

            return `
                <div data-aos="fade-up" class="glass-card ${bgClass} rounded-2xl p-6 shadow-sm border transition-all hover:shadow-lg group">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-xl flex items-center justify-center shadow-inner">
                            <i class="fas fa-bullseye text-xl"></i>
                        </div>
                        <span class="text-2xl font-black text-gray-300 dark:text-gray-600">${percent}%</span>
                    </div>
                    <h4 class="font-bold text-lg mb-1 truncate">${g.goal_name}</h4>
                    <p class="text-xs text-gray-500 font-medium mb-6">Mục tiêu: <span class="font-bold text-gray-900 dark:text-white">${formatVNĐ(g.target_amount)}</span></p>
                    
                    <div class="w-full bg-gray-100 dark:bg-gray-700 h-3 rounded-full overflow-hidden mb-3">
                        <div class="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all duration-1000 relative" style="width: ${percent}%">
                            <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span class="text-blue-500">Đã gom: ${formatVNĐ(g.current_saved)}</span>
                        <span class="text-gray-400">Còn: ${formatVNĐ(remaining > 0 ? remaining : 0)}</span>
                    </div>
                    <button onclick="deleteGoal(${g.id})" class="mt-6 w-full py-2 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Xóa / Hủy Bỏ</button>
                </div>
            `;
        }).join('');
    } catch (err) { console.error('Lỗi tải mục tiêu:', err); }
}

async function deleteGoal(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa mục tiêu này?')) return;
    try {
        await fetchJSON(`${API_BASE}/goals/${id}`, 'DELETE');
        loadGoalsList();
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
async function handlePurchaseWithPhoto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-purchase');
    const name = document.getElementById('pur-name').value;
    const amountStr = document.getElementById('pur-amount').value;
    const photoInput = document.getElementById('pur-photo-input');
    
    const amount = parseSmartAmount(amountStr);
    if (!amount || amount <= 0) return alert('Số tiền không hợp lệ!');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('item_name', name);
        formData.append('amount', amount);
        if (photoInput.files[0]) {
            formData.append('photo', photoInput.files[0]);
        }
        
        await fetchJSON(`${API_BASE}/purchases`, 'POST', formData);
        alert('Đã lưu chi tiêu! 🍵');
        location.reload();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        btn.innerHTML = 'Lưu chi tiêu ngay';
        btn.disabled = false;
    }
}

// Bind events on load for finance.html
document.addEventListener('DOMContentLoaded', () => {
    const purchaseForm = document.getElementById('form-purchase-with-photo');
    if (purchaseForm) purchaseForm.onsubmit = handlePurchaseWithPhoto;
    
    const purPhotoInput = document.getElementById('pur-photo-input');
    if (purPhotoInput) {
        purPhotoInput.onchange = function() {
            const preview = document.getElementById('pur-preview-img');
            const container = document.getElementById('pur-preview-container');
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.src = e.target.result;
                    preview.classList.remove('hidden');
                    container.classList.add('hidden');
                };
                reader.readAsDataURL(this.files[0]);
            }
        };
    }

    const financeForm = document.getElementById('form-finance');
    if (financeForm) financeForm.onsubmit = handleFinanceSubmit;

    const goalForm = document.getElementById('form-goals');
    if (goalForm) goalForm.onsubmit = handleGoalSubmit;
});
