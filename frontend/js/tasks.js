/**
 * Tasks Module - Scheduling and Daily Agenda
 */

async function initAgenda() {
    try {
        const tasks = await fetchJSON(`${API_BASE}/tasks`);
        renderAgendaTasks(tasks);
    } catch (err) { console.error('Lỗi khởi tạo Agenda:', err); }
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
                        <button onclick="openSkipModal(${t.id})" class="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-orange-500 transition-all">Báo bận</button> 
                        <button onclick="openEditModal(${t.id}, '${t.task_name}', '${t.start_time}', '${t.end_time}')" class="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-blue-500 transition-all">Sửa</button>
                    ` : `
                        <div class="col-span-2 text-center py-3 bg-green-50 dark:bg-green-900/10 text-green-500 rounded-2xl text-xs font-black italic">Hôm nay làm tốt lắm! 🎉</div>
                    `}
                </div>
            </div>
        `;
    });
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
