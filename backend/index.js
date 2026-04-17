const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// PIN Auth Configuration
const WEB_PIN = process.env.WEB_PIN || '1234';

// Serve Frontend
const frontendPath = fs.existsSync(path.join(__dirname, 'frontend')) 
    ? path.join(__dirname, 'frontend') 
    : path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Serve Uploads - Common directory for Bot and Web
// Note: docker-compose mounts ./shared_uploads to /app/uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/model3d', express.static(path.join(__dirname, 'model3d')));

// ================= AUTH API (Public) =================
app.post('/api/auth/verify', (req, res) => {
    const { pin } = req.body;
    // Strip accidental quotes or spaces from the env var just in case
    const validPin = WEB_PIN.toString().replace(/^["']|["']$/g, '').trim();
    if (pin.trim() === validPin) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Mã PIN không chính xác!' });
    }
});

// ================= PROTECTED API MIDDLEWARE =================
app.use('/api', (req, res, next) => {
    if (req.path === '/auth/verify') return next();
    
    const pin = (req.headers['x-pin'] || '').trim();
    const validPin = WEB_PIN.toString().replace(/^["']|["']$/g, '').trim();
    if (pin !== validPin) {
        return res.status(401).json({ error: 'Unauthorized. Vui lòng đăng nhập.' });
    }
    next();
});

// ================= ROUTES =================
app.use('/api/finance', require('./routes/finance'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/user', require('./routes/user'));
app.use('/api', require('./routes/general')); // Activities, Purchases, etc.

// START
async function startServer() {
    try {
        await db.initDb();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Matcha API Server v6.0 running on http://0.0.0.0:${PORT}`);
            console.log(`Security: PIN Code required for /api access.`);
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
}

startServer();
