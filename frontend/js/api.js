/**
 * API Module - Handles all communication with the backend
 * Injects PIN code and handles unauthorized access
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:3000/api' 
    : '/api';

// Redirect to login if PIN is missing (and not on login page)
if (!localStorage.getItem('matcha_pin') && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
    window.location.href = 'index.html';
}

/**
 * Universal fetch wrapper for JSON and FormData
 */
async function fetchJSON(url, method = 'GET', body = null) {
    const pin = localStorage.getItem('matcha_pin');
    const headers = {
        'x-pin': pin
    };

    const options = {
        method,
        headers
    };

    if (body) {
        if (body instanceof FormData) {
            // Fetch handles boundary for FormData automatically
            options.body = body;
        } else {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    const response = await fetch(url, options);

    if (response.status === 401) {
        localStorage.removeItem('matcha_pin');
        window.location.href = 'index.html';
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'API Error');
    }

    return await response.json();
}

/**
 * Helper: Format VNĐ
 */
function formatVNĐ(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

/**
 * Relative time formatter
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    return date.toLocaleDateString('vi-VN');
}
