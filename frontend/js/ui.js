/**
 * UI Module - Handles layout, theme, and common interactive elements
 */

function setTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    }
    
    updateToggleState(isDark);
    
    // Notify 3D Pet if it exists
    if (typeof updatePetTheme === 'function') {
        updatePetTheme(isDark);
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

// Mobile Sidebar System
(function initMobileSidebar() {
    document.addEventListener('DOMContentLoaded', () => {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (!sidebar || !toggleBtn) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-40 opacity-0 pointer-events-none transition-opacity duration-300 md:hidden';
        document.body.appendChild(backdrop);

        const openSidebar = () => {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('opacity-0', 'pointer-events-none');
            backdrop.classList.add('opacity-100', 'pointer-events-auto');
            document.body.style.overflow = 'hidden';
        };

        const closeSidebar = () => {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('opacity-0', 'pointer-events-none');
            backdrop.classList.remove('opacity-100', 'pointer-events-auto');
            document.body.style.overflow = '';
        };

        toggleBtn.onclick = openSidebar;
        backdrop.onclick = closeSidebar;

        sidebar.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 768) closeSidebar();
            });
        });

        // Smart Money Input logic (moved from app.js)
        initSmartMoneyInput();
        injectPremiumStyles();
        initDarkMode();
        initExport();
    });
})();

function initExport() {
    const btn = document.getElementById('btn-export');
    if (btn) btn.onclick = exportData;
}

async function exportData() {
    try {
        const response = await fetch(`${API_BASE}/export`, {
            headers: { 'x-pin': localStorage.getItem('matcha_pin') }
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `matcha_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        alert('🌿 Sao lưu dữ liệu thành công!');
    } catch (err) { alert('❌ Lỗi sao lưu!'); }
}

// Global Currency Input Mask (v5.0 Upgrade)
function initCurrencyMasks() {
    const inputs = document.querySelectorAll('.currency-input');
    inputs.forEach(input => {
        input.addEventListener('input', function(e) {
            // Remove everything except numbers
            let value = this.value.replace(/\D/g, "");
            if (value === "") return;
            
            // Format with dots
            this.value = new Intl.NumberFormat('vi-VN').format(value);
        });
    });
}

function initSmartMoneyInput() {
    initCurrencyMasks(); // Initialize masks first
    const inputs = document.querySelectorAll('input[placeholder*="30k"]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            // If user used k, tr, m...
            if (this.value.toLowerCase().includes('k') || this.value.toLowerCase().includes('tr')) {
                const amount = parseSmartAmount(this.value);
                if (amount > 0) this.value = new Intl.NumberFormat('vi-VN').format(amount);
            }
        });
    });
}

function parseSmartAmount(val) {
    if (!val) return 0;
    // Remove dots for parsing
    let s = String(val).toLowerCase().replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '');
    let num = parseFloat(s);
    if (isNaN(num)) return 0;
    if (s.includes('k')) return num * 1000;
    if (s.includes('tr') || s.includes('m')) return num * 1000000;
    return num;
}

function injectPremiumStyles() {
    if (document.getElementById('matcha-premium-styles')) return;
    const style = document.createElement('style');
    style.id = 'matcha-premium-styles';
    style.innerHTML = `
        .glass-card { background: rgba(255,255,255,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.3); }
        .dark .glass-card { background: rgba(31,41,55,0.6); border: 1px solid rgba(75,85,99,0.3); }
        .hover-lift { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .hover-lift:hover { transform: translateY(-5px); }
    `;
    document.head.appendChild(style);
}

// Global openImage for modals
function openImage(src) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-img');
    if (modal && img) {
        img.src = src;
        modal.classList.remove('hidden');
    }
}
