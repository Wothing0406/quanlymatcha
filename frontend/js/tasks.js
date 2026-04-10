/**
 * Tasks Module - Scheduling and Daily Agenda
 */

async function initAgenda() {
    const gridEl = document.getElementById('agenda-task-grid');
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
    
    // Day helper
    const currentViDay = (() => {
        const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        return days[new Date().getDay()];
    })();

    const todayTasks = tasks.filter(t => t.weekday === currentViDay);

    if (todayTasks.length === 0) {
        gridEl.innerHTML = '<div class="col-span-full text-center py-20 opacity-50 italic">Hôm nay chưa có lịch trình nào được thiết lập.</div>';
        return;
    }

    gridEl.innerHTML = todayTasks.map((t, idx) => {
        const active = isTaskActive(t.start_time, t.end_time) && t.status !== 'done';
        const done = t.status === 'done';
        const postponed = t.status === 'postponed';

        let statusBadge = '<span class="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-400 px-3 py-1 rounded-full uppercase tracking-widest font-black">Chưa đến</span>';
        if (done) statusBadge = '<span class="text-[10px] bg-green-100 text-green-600 px-3 py-1 rounded-full uppercase tracking-widest font-black">Hoàn thành</span>';
        if (postponed) statusBadge = '<span class="text-[10px] bg-orange-100 text-orange-500 px-3 py-1 rounded-full uppercase tracking-widest font-black">Đã dời lịch</span>';
        if (active) statusBadge = '<span class="text-[10px] bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest font-black animate-pulse">Đang diễn ra</span>';

        return `
            <div data-aos="fade-up" data-aos-delay="${idx * 100}" 
                 class="glass-card bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-sm border ${active ? 'border-blue-500/50 shadow-xl' : 'border-gray-100 dark:border-gray-700'} relative overflow-hidden group transition-all hover:scale-[1.02]">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-14 h-14 rounded-2xl ${active ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-blue-500'} flex items-center justify-center text-xl shadow-lg">
                        <i class="fas ${done ? 'fa-check-circle' : 'fa-calendar-check'}"></i>
                    </div>
                    ${statusBadge}
                </div>
                
                <h4 class="text-xl font-black mb-1 truncate">${t.task_name}</h4>
                <div class="flex items-center gap-2 text-gray-400 text-xs font-bold mb-8 italic">
                    <i class="far fa-clock"></i> ${t.start_time} - ${t.end_time}
                </div>

                <div class="grid grid-cols-2 gap-3 mt-auto">
                    ${!done ? `
                        <button onclick="openVerifyModal(${t.id}, '${t.task_name}', '${t.status}')" class="col-span-2 px-6 py-4 bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                            <i class="fas fa-camera"></i> ${t.status === 'ongoing' ? 'Chụp ảnh HOÀN THÀNH' : 'Chụp ảnh BẮT ĐẦU'}
                        </button>
                        <button onclick="openSkipModal(${t.id})" class="col-span-2 px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-orange-500 transition-all">Báo bận / Dời lịch</button> 
                    ` : `
                        <div class="col-span-2 text-center py-3 bg-green-50 dark:bg-green-900/10 text-green-500 rounded-2xl text-xs font-black italic">Hôm nay làm tốt lắm! 🎉</div>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// Verification Flow (2-Step Reporting)
function openVerifyModal(id, name, status) {
    const modal = document.getElementById('report-modal');
    if (!modal) return;
    
    document.getElementById('report-task-id').value = id;
    document.getElementById('report-task-status-hidden').value = status;
    document.getElementById('report-task-name').innerText = name;
    
    const titleEl = modal.querySelector('h2');
    const descEl = modal.querySelector('p');
    
    if (status === 'ongoing') {
        titleEl.innerText = '📸 Hoàn thành công việc';
        descEl.innerText = 'Hãy chụp ảnh minh chứng kết quả cuối cùng.';
    } else {
        titleEl.innerText = '📸 Bắt đầu công việc';
        descEl.innerText = 'Chụp một bức ảnh để đánh dấu thời điểm bắt đầu.';
    }
    
    modal.classList.remove('hidden', 'opacity-0');
}

// Helper for time comparison
function isTaskActive(start, end) {
    const now = new Date();
    const currMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return currMins >= (sh * 60 + sm) && currMins <= (eh * 60 + em);
}

// Function to preview image before uploading
window.previewImage = function(input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(previewId).innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover">
            `;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// Submitting the report
window.submitReport = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('report-task-id').value;
    const currentStatus = document.getElementById('report-task-status-hidden').value;
    const photoInput = document.getElementById('report-photo');
    
    if (!photoInput.files[0]) {
        alert("Vui lòng chụp hoặc tải ảnh lên!");
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải lên...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('id', id);
        formData.append('photo', photoInput.files[0]);
        
        // Determine intended next status and call correct legacy API
        if (currentStatus === 'ongoing') {
            await fetchJSON(`${API_BASE}/tasks/complete`, 'POST', formData);
        } else {
            await fetchJSON(`${API_BASE}/tasks/start`, 'POST', formData);
        }
        
        // Hide Modal & Refresh
        document.getElementById('report-modal').classList.add('hidden', 'opacity-0');
        initAgenda(); // Reload list
        if (typeof initDashboard === 'function') initDashboard(); // Reload charts if on dashboard
    } catch (err) {
        alert("Có lỗi xảy ra: " + err.message);
    } finally {
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Báo Cáo';
        btn.disabled = false;
    }
}

// ====== SCHEDULE CONFIGURATION ======

window.loadScheduleTasks = async function() {
    const listEl = document.getElementById('tasks-list');
    if (!listEl) return;
    try {
        const tasks = await fetchJSON(`${API_BASE}/tasks`);
        if (tasks.length === 0) {
            listEl.innerHTML = '<div class="text-center py-10 opacity-50 italic">Bạn chưa thiết lập công việc nào.</div>';
            return;
        }

        listEl.innerHTML = tasks.map(t => `
            <div data-aos="fade-up" class="glass-card bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm flex items-center justify-between group border border-gray-100 dark:border-gray-700 hover:border-blue-500/50 transition-all">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-xl flex items-center justify-center">
                        <i class="fas fa-calendar-check text-xl"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-[15px] text-gray-900 dark:text-white">${t.task_name}</h4>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-2">
                            ${t.weekday} • ${t.start_time} - ${t.end_time}
                        </p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editTask(${t.id}, '${t.task_name}', '${t.start_time}', '${t.end_time}')" class="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-500 transition-all">
                        <i class="fas fa-edit text-sm"></i>
                    </button>
                    <button onclick="deleteTask(${t.id})" class="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Lỗi tải danh sách cấu hình:', err);
    }
}

window.handleTaskSubmit = async function(e) {
    e.preventDefault();
    const task_name = document.getElementById('task-name').value;
    const start_time = document.getElementById('task-start').value;
    const end_time = document.getElementById('task-end').value;
    
    // Get checked weekdays
    const weekdays = Array.from(document.querySelectorAll('input[name="weekdays"]:checked')).map(cb => cb.value);
    
    if (weekdays.length === 0) {
        alert("Vui lòng chọn ít nhất 1 ngày trong tuần!");
        return;
    }
    
    try {
        await fetchJSON(`${API_BASE}/tasks`, 'POST', { task_name, weekday: weekdays, start_time, end_time });
        document.getElementById('form-schedule').reset();
        await loadScheduleTasks();
    } catch (err) { alert('Lỗi: ' + err.message); }
}


window.deleteTask = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa công việc này khỏi lịch trình?')) return;
    try {
        await fetchJSON(`${API_BASE}/tasks/${id}`, 'DELETE');
        await loadScheduleTasks();
    } catch (err) { alert('Lỗi: ' + err.message); }
}

window.editTask = function(id, name, start, end) {
    const modal = document.getElementById('modal-edit-task');
    if (!modal) return;
    document.getElementById('edit-task-id').value = id;
    document.getElementById('edit-task-name').value = name;
    document.getElementById('edit-task-start').value = start;
    document.getElementById('edit-task-end').value = end;
    modal.classList.remove('hidden');
}

window.submitEditTask = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-task-id').value;
    const task_name = document.getElementById('edit-task-name').value;
    const start_time = document.getElementById('edit-task-start').value;
    const end_time = document.getElementById('edit-task-end').value;
    try {
        await fetchJSON(`${API_BASE}/tasks/${id}`, 'PUT', { task_name, start_time, end_time });
        document.getElementById('modal-edit-task').classList.add('hidden');
        await loadScheduleTasks();
    } catch (err) { alert('Lỗi: ' + err.message); }
}

// Báo Bận / Dời Lịch Logic
window.openSkipModal = function(id) {
    const modal = document.getElementById('modal-skip');
    if (!modal) return;
    document.getElementById('skip-task-id').value = id;
    document.getElementById('skip-reason').value = '';
    modal.classList.remove('hidden', 'opacity-0');
}

window.closeSkipModal = function() {
    document.getElementById('modal-skip').classList.add('hidden', 'opacity-0');
}

window.confirmSkipAction = async function(status) {
    const id = document.getElementById('skip-task-id').value;
    const reason = document.getElementById('skip-reason').value;
    const label = status === 'postponed' ? 'Dời lịch' : 'Bỏ qua luôn';

    if (!confirm(`Bạn xác nhận [${label}] công việc này?`)) return;

    try {
        await fetchJSON(`${API_BASE}/tasks/skip`, 'POST', { id, reason, status });
        closeSkipModal();
        initAgenda();
        if (typeof initDashboard === 'function') initDashboard();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}
