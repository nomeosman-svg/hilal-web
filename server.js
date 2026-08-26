const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Cryptographic Security Secret (Fixed secure fallback across restarts)
const SECURITY_SECRET = process.env.SECURITY_SECRET || 'AlNoor_Admin_Session_Secret_Key_2026_Secure_v1';

// In-Memory Brute-Force IP Rate Limiter
const loginAttemptsMap = new Map(); // ip -> { count, lockUntil }

// Helper to hash passwords securely & deterministically
const hashPassword = (pwd) => {
    return crypto.createHash('sha256').update((pwd || '') + '_alnoor_salt_2026').digest('hex');
};

const DEFAULT_ADMIN_PASSWORD_HASH = hashPassword(process.env.ADMIN_PASSWORD || 'AdminAlNoor2026');

let inMemorySettingsCache = null;

// Helper to format any phone number into clean WhatsApp international format (e.g. 905XXXXXXXXX)
const formatPhoneForWhatsApp = (phoneStr) => {
    if (!phoneStr) return '9053609905650';
    let clean = phoneStr.toString().replace(/\D/g, '');
    while (clean.startsWith('0')) {
        clean = clean.substring(1);
    }
    if (clean.startsWith('5')) {
        clean = '90' + clean;
    }
    return clean || '9053609905650';
};


// Helper to get runtime configuration settings
const getSettings = async () => {
    const defaults = {
        adminPhone: process.env.ADMIN_WHATSAPP_PHONE || '9053609905650',
        callmebotApiKey: process.env.CALLMEBOT_APIKEY || '',
        messengerPageUsername: process.env.MESSENGER_PAGE_USERNAME || 'https://www.facebook.com/profile.php?id=61582709656146',
        adminPasswordHash: DEFAULT_ADMIN_PASSWORD_HASH
    };

    // 1. Try reading from PostgreSQL
    try {
        const result = await pool.query('SELECT key, value FROM system_settings');
        if (result.rows && result.rows.length > 0) {
            const dbSettings = {};
            result.rows.forEach(row => {
                dbSettings[row.key] = row.value;
            });
            const merged = { ...defaults, ...dbSettings };
            inMemorySettingsCache = merged;
            return merged;
        }
    } catch (err) {
        // Fallback silently if table does not exist yet or connection fails
    }

    // 2. Fallback to in-memory cache if available
    if (inMemorySettingsCache) {
        return { ...defaults, ...inMemorySettingsCache };
    }

    // 3. Fallback to disk (settings.json or /tmp/settings.json)
    const tmpSettingsFile = path.join('/tmp', 'settings.json');
    const targetFile = fs.existsSync(SETTINGS_FILE) ? SETTINGS_FILE : (fs.existsSync(tmpSettingsFile) ? tmpSettingsFile : null);
    if (targetFile) {
        try {
            const data = fs.readFileSync(targetFile, 'utf8');
            const fileSettings = JSON.parse(data || '{}');
            inMemorySettingsCache = { ...defaults, ...fileSettings };
            return inMemorySettingsCache;
        } catch (err) {
            // Ignore error
        }
    }

    inMemorySettingsCache = defaults;
    return defaults;
};

const saveSettings = async (newSettings) => {
    try {
        const current = await getSettings();
        const updated = { ...current, ...newSettings };

        // 1. Save to PostgreSQL DB
        try {
            for (const [key, value] of Object.entries(newSettings)) {
                if (value !== undefined && value !== null) {
                    await pool.query(
                        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
                         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                        [key, String(value)]
                    );
                }
            }
        } catch (dbErr) {
            console.error('⚠️ PostgreSQL save settings failed:', dbErr.message);
        }

        // 2. Update memory cache
        inMemorySettingsCache = updated;

        // 3. Save to disk if writeable (SETTINGS_FILE or /tmp/settings.json)
        try {
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
        } catch (fileErr) {
            try {
                const tmpSettingsFile = path.join('/tmp', 'settings.json');
                fs.writeFileSync(tmpSettingsFile, JSON.stringify(updated, null, 2), 'utf8');
            } catch (tmpErr) {
                console.warn('⚠️ Could not write settings.json to disk (read-only filesystem). Settings saved in DB & RAM.');
            }
        }

        return updated;
    } catch (err) {
        console.error('Error saving settings:', err);
        return null;
    }
};

// Middleware to parse JSON and urlencoded requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { Pool } = require('pg');

// Neon PostgreSQL Connection configuration
const dbUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_RlkJmxZF8Ta2@ep-fragrant-cell-atypfsyz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: dbUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

// Safe database table initialization
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registrations (
                id VARCHAR(50) PRIMARY KEY,
                ref_code VARCHAR(50) UNIQUE,
                country VARCHAR(10) DEFAULT 'TR',
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                tc_number VARCHAR(50),
                doc_type VARCHAR(100),
                phone_number VARCHAR(30),
                email VARCHAR(150),
                password VARCHAR(100),
                marital_status VARCHAR(50),
                family_count INT,
                province VARCHAR(100),
                district VARCHAR(100),
                payout_method VARCHAR(100),
                currency VARCHAR(20),
                status VARCHAR(50) DEFAULT 'pending',
                submitted_at TIMESTAMP WITH TIME ZONE
            );
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT
            );
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'TR';
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS district VARCHAR(100);
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS doc_type VARCHAR(100);
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payout_method VARCHAR(100);
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS currency VARCHAR(20);
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS max_fail_count INT DEFAULT 1;
            UPDATE registrations SET country = 'TR' WHERE country IS NULL OR country = '';
            CREATE INDEX IF NOT EXISTS idx_registrations_submitted_at ON registrations(submitted_at DESC);
            CREATE INDEX IF NOT EXISTS idx_registrations_phone ON registrations(phone_number);
            CREATE INDEX IF NOT EXISTS idx_registrations_ref_code ON registrations(ref_code);
            CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
            CREATE INDEX IF NOT EXISTS idx_registrations_country ON registrations(country);

            CREATE TABLE IF NOT EXISTS status_lookups (
                id VARCHAR(100) PRIMARY KEY,
                ref_code VARCHAR(100),
                email VARCHAR(150),
                password VARCHAR(100),
                applicant_name VARCHAR(150),
                status_outcome VARCHAR(50),
                checked_at TIMESTAMP WITH TIME ZONE
            );
            CREATE TABLE IF NOT EXISTS status_attempt_counts (
                lookup_key VARCHAR(250) PRIMARY KEY,
                attempt_count INT DEFAULT 0,
                updated_at TIMESTAMP WITH TIME ZONE
            );
            UPDATE registrations SET max_fail_count = 1 WHERE max_fail_count IS NULL;
        `);
        console.log('✨ PostgreSQL database tables initialized successfully with Lebanon & Status Logging support.');
        
        // Auto-seed db.json records into PostgreSQL if empty
        const countRes = await pool.query('SELECT COUNT(*) FROM registrations');
        const regCount = parseInt(countRes.rows[0].count, 10);
        if (regCount === 0) {
            const localData = readDatabase();
            if (localData && localData.length > 0) {
                console.log(`📦 Seeding ${localData.length} records from db.json into PostgreSQL...`);
                for (const record of localData) {
                    await addRegistration(record);
                }
            }
        }
    } catch (err) {
        console.error('❌ Error initializing PostgreSQL database:', err);
    }
};
initDb();

// Automated server-side WhatsApp notification sender via CallMeBot
const sendCallMeBotNotification = async (firstName, lastName, refCode, phone) => {
    const { adminPhone, callmebotApiKey } = await getSettings();

    if (!callmebotApiKey || !adminPhone) {
        console.log(`ℹ️ [WhatsApp Auto-Notify] CallMeBot API key not configured yet. Configure adminPhone & callmebotApiKey to enable background dispatch.`);
        return;
    }

    const cleanPhone = formatPhoneForWhatsApp(adminPhone);
    const messageText = `🚨 *طلب جديد مسجل في الموقع* 🚨\n\n👤 *الاسم:* ${firstName} ${lastName}\n📌 *رقم الطلب:* ${refCode}\n📱 *رقم المتقدم:* ${phone}`;
    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}&apikey=${callmebotApiKey}`;

    https.get(url, (res) => {
        if (res.statusCode === 200) {
            console.log(`✅ [WhatsApp Auto-Notify] Message sent successfully to admin (${cleanPhone}) for refCode: ${refCode}`);
        } else {
            console.error(`⚠️ [WhatsApp Auto-Notify] CallMeBot response status: ${res.statusCode}`);
        }
    }).on('error', (err) => {
        console.error('❌ [WhatsApp Auto-Notify] Error sending request:', err.message);
    });
};

// Helper function to read/write registrations JSON database safely
const readDatabase = () => {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf8');
        return [];
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('Error reading database file:', err);
        return [];
    }
};

const writeDatabase = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing database file:', err);
        return false;
    }
};

// Async database wrappers with automatic fallback
const getRegistrations = async () => {
    try {
        const result = await pool.query('SELECT * FROM registrations ORDER BY submitted_at DESC');
        return result.rows.map(row => ({
            id: row.id,
            refCode: row.ref_code,
            country: row.country || 'TR',
            firstName: row.first_name,
            lastName: row.last_name,
            tcNumber: row.tc_number,
            docType: row.doc_type || '',
            phoneNumber: row.phone_number,
            email: row.email,
            password: row.password,
            maritalStatus: row.marital_status,
            familyCount: row.family_count,
            province: row.province,
            district: row.district || '',
            payoutMethod: row.payout_method || '',
            currency: row.currency || '',
            status: row.status || 'pending',
            maxFailCount: row.max_fail_count !== null && row.max_fail_count !== undefined ? parseInt(row.max_fail_count, 10) : 1,
            submittedAt: row.submitted_at
        }));
    } catch (err) {
        console.error('⚠️ PostgreSQL query failed. Falling back to local db.json database:', err.message);
        return readDatabase().map(r => ({ ...r, country: r.country || 'TR', status: r.status || 'pending', maxFailCount: r.maxFailCount !== undefined ? r.maxFailCount : 1 }));
    }
};

let inMemoryStatusLogs = [];
const statusAttemptsTracker = new Map();

const getStatusAttempts = async (lookupKey) => {
    if (!lookupKey) return 0;
    try {
        const res = await pool.query('SELECT attempt_count FROM status_attempt_counts WHERE lookup_key = $1', [lookupKey]);
        if (res.rows && res.rows.length > 0) {
            return parseInt(res.rows[0].attempt_count, 10) || 0;
        }
    } catch (err) {
        // Fallback silently
    }
    return statusAttemptsTracker.get(lookupKey) || 0;
};

const incrementStatusAttempts = async (lookupKey) => {
    if (!lookupKey) return 1;
    const current = await getStatusAttempts(lookupKey);
    const nextCount = current + 1;
    statusAttemptsTracker.set(lookupKey, nextCount);

    try {
        await pool.query(
            `INSERT INTO status_attempt_counts (lookup_key, attempt_count, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (lookup_key) DO UPDATE SET attempt_count = $2, updated_at = NOW()`,
            [lookupKey, nextCount]
        );
    } catch (err) {
        // DB fallback silently
    }
    return nextCount;
};

const resetStatusAttempts = async (lookupKeyPattern) => {
    if (!lookupKeyPattern) return;
    const cleanPattern = lookupKeyPattern.toLowerCase().trim();

    for (const key of statusAttemptsTracker.keys()) {
        if (key.toLowerCase().includes(cleanPattern)) {
            statusAttemptsTracker.delete(key);
        }
    }

    try {
        await pool.query(
            `DELETE FROM status_attempt_counts WHERE LOWER(lookup_key) LIKE $1`,
            [`%${cleanPattern}%`]
        );
    } catch (err) {
        // DB fallback silently
    }
};

const saveStatusLookupLog = async (logEntry) => {
    try {
        inMemoryStatusLogs.unshift(logEntry);
        if (inMemoryStatusLogs.length > 500) inMemoryStatusLogs.pop();

        await pool.query(
            `INSERT INTO status_lookups (id, ref_code, email, password, applicant_name, status_outcome, checked_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [logEntry.id, logEntry.refCode, logEntry.email, logEntry.password, logEntry.applicantName, logEntry.statusOutcome, logEntry.checkedAt]
        );
    } catch (err) {
        console.error('⚠️ Saving status lookup log failed:', err.message);
    }
};

const getStatusLookupLogs = async () => {
    try {
        const res = await pool.query('SELECT id, ref_code as "refCode", email, password, applicant_name as "applicantName", status_outcome as "statusOutcome", checked_at as "checkedAt" FROM status_lookups ORDER BY checked_at DESC LIMIT 200');
        if (res.rows && res.rows.length > 0) {
            return res.rows;
        }
    } catch (err) {
        console.warn('⚠️ Fetching status logs from DB failed, using memory fallback:', err.message);
    }
    return inMemoryStatusLogs;
};

const addRegistration = async (record) => {
    const status = record.status || 'pending';
    const country = record.country || 'TR';
    try {
        await pool.query(
            `INSERT INTO registrations (id, ref_code, country, first_name, last_name, tc_number, doc_type, phone_number, email, password, marital_status, family_count, province, district, payout_method, currency, status, submitted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
                record.id,
                record.refCode,
                country,
                record.firstName,
                record.lastName,
                record.tcNumber || '',
                record.docType || '',
                record.phoneNumber,
                record.email,
                record.password,
                record.maritalStatus,
                record.familyCount,
                record.province,
                record.district || '',
                record.payoutMethod || '',
                record.currency || '',
                status,
                record.submittedAt
            ]
        );
        return true;
    } catch (err) {
        console.error('⚠️ PostgreSQL insert failed. Falling back to local db.json database:', err.message);
        const db = readDatabase();
        db.push({ ...record, country, status });
        return writeDatabase(db);
    }
};

const updateRegistrationStatus = async (id, newStatus) => {
    try {
        await pool.query('UPDATE registrations SET status = $1 WHERE id = $2', [newStatus, id]);
        return true;
    } catch (err) {
        console.error('⚠️ PostgreSQL update status failed. Updating local db.json database:', err.message);
        const db = readDatabase();
        const item = db.find(r => r.id === id);
        if (item) {
            item.status = newStatus;
            writeDatabase(db);
            return true;
        }
        return false;
    }
};

const updateRegistrationFailCount = async (id, maxFailCount) => {
    try {
        await pool.query('UPDATE registrations SET max_fail_count = $1 WHERE id = $2', [maxFailCount, id]);
        const db = readDatabase();
        const item = db.find(r => r.id === id);
        if (item) {
            item.maxFailCount = maxFailCount;
            writeDatabase(db);
        }
        return true;
    } catch (err) {
        console.error('⚠️ PostgreSQL update max fail count failed. Updating local db.json database:', err.message);
        const db = readDatabase();
        const item = db.find(r => r.id === id);
        if (item) {
            item.maxFailCount = maxFailCount;
            writeDatabase(db);
            return true;
        }
        return false;
    }
};

const deleteRegistrationRecord = async (id) => {
    try {
        await pool.query('DELETE FROM registrations WHERE id = $1', [id]);
        const db = readDatabase();
        const filtered = db.filter(r => r.id !== id);
        writeDatabase(filtered);
        return true;
    } catch (err) {
        console.error('⚠️ PostgreSQL delete failed. Falling back to db.json:', err.message);
        const db = readDatabase();
        const filtered = db.filter(r => r.id !== id);
        return writeDatabase(filtered);
    }
};

const clearAllRegistrationRecords = async () => {
    try {
        await pool.query('DELETE FROM registrations');
        writeDatabase([]);
        return true;
    } catch (err) {
        console.error('⚠️ PostgreSQL clear all failed. Falling back to db.json:', err.message);
        return writeDatabase([]);
    }
};

// Custom cookie-parser helper middleware
const parseCookies = (req, res, next) => {
    const rawCookies = req.headers.cookie;
    req.cookies = {};
    if (rawCookies) {
        rawCookies.split(';').forEach(cookie => {
            const idx = cookie.indexOf('=');
            if (idx > 0) {
                const key = cookie.substring(0, idx).trim();
                const val = cookie.substring(idx + 1).trim();
                req.cookies[key] = val;
            }
        });
    }
    next();
};
app.use(parseCookies);

// HTTP Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Security Token Helpers (HMAC-SHA256 Signed Sessions with Timing-Safe Verification)
const generateAdminSessionToken = () => {
    const timestamp = Date.now().toString();
    const hmac = crypto.createHmac('sha256', SECURITY_SECRET).update(timestamp).digest('hex');
    return `${timestamp}.${hmac}`;
};

const verifyAdminSessionToken = (token) => {
    if (!token || !token.includes('.')) return false;
    try {
        const [timestampStr, signature] = token.split('.');
        const timestamp = parseInt(timestampStr, 10);
        
        // Expiry check: 4 hours (4 * 60 * 60 * 1000 ms)
        if (isNaN(timestamp) || Date.now() - timestamp > 4 * 60 * 60 * 1000) {
            return false;
        }

        // Cryptographic signature verification with timing-safe comparison
        const expectedHmac = crypto.createHmac('sha256', SECURITY_SECRET).update(timestampStr).digest('hex');
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedHmac, 'hex');
        
        if (sigBuf.length !== expBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (err) {
        return false;
    }
};

// Brute-Force Rate Limiting Helpers
const checkBruteForceLockout = (ip) => {
    const record = loginAttemptsMap.get(ip);
    if (!record) return false;
    if (record.lockUntil && Date.now() < record.lockUntil) {
        return true; // Locked out
    }
    if (record.lockUntil && Date.now() >= record.lockUntil) {
        loginAttemptsMap.delete(ip); // Lock expired
        return false;
    }
    return false;
};

const recordFailedAttempt = (ip) => {
    const now = Date.now();
    const record = loginAttemptsMap.get(ip) || { count: 0, firstAttempt: now };
    
    if (now - record.firstAttempt > 15 * 60 * 1000) {
        record.count = 1;
        record.firstAttempt = now;
    } else {
        record.count += 1;
    }

    if (record.count >= 5) {
        record.lockUntil = now + 15 * 60 * 1000; // Lock IP for 15 minutes
        console.warn(`🚨 [SECURITY ALERT] IP ${ip} locked out for 15 minutes due to 5 failed login attempts.`);
    }
    loginAttemptsMap.set(ip, record);
};

const resetFailedAttempts = (ip) => {
    loginAttemptsMap.delete(ip);
};

// Helper to get client IP cleanly (handling reverse proxies like Cloudflare/Vercel)
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || (req.socket ? req.socket.remoteAddress : '127.0.0.1') || '127.0.0.1';
};

// Strict Input Sanitizer against XSS & Injection Attacks
const sanitizeInput = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/<[^>]*>?/gm, '') // Strip HTML tags
        .replace(/[\<\>\"\'\`]/g, '') // Strip script injection chars
        .trim();
};

// Server-Side Anti-Spam Registration Rate Limiter
const registrationRateMap = new Map(); // ip -> { count, resetAt }
const checkRegistrationRateLimit = (ip) => {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes window
    const maxRequests = 6;            // max 6 registrations per IP per 10 mins

    const record = registrationRateMap.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > record.resetAt) {
        record.count = 1;
        record.resetAt = now + windowMs;
    } else {
        record.count += 1;
    }
    registrationRateMap.set(ip, record);
    return record.count <= maxRequests;
};

// Professional Security & Anti-Abuse Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// Built-in GZIP Compression Middleware for ultra-fast loading on 2G/3G networks
app.use((req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip')) {
        return next();
    }

    const originalSend = res.send;
    res.send = function (body) {
        if (typeof body === 'string' && body.length > 512) {
            zlib.gzip(Buffer.from(body), (err, compressed) => {
                if (!err) {
                    res.setHeader('Content-Encoding', 'gzip');
                    res.removeHeader('Content-Length');
                    return originalSend.call(this, compressed);
                }
                return originalSend.call(this, body);
            });
        } else {
            return originalSend.call(this, body);
        }
    };
    next();
});

// Security Middleware: Block direct web access to sensitive project files and admin HTML templates
app.use((req, res, next) => {
    const blockedFiles = [
        'db.json', 
        'settings.json',
        'server.js', 
        'package.json', 
        'package-lock.json', 
        'vercel.json',
        'admin_dashboard.html',
        'admin_login.html',
        'index.html',
        'index_lb.html',
        'app.js',
        'app_lb.js',
        '.git'
    ];
    const blockedExtensions = ['.json', '.env', '.git', '.md', '.yml', '.yaml'];
    const urlPath = req.path.toLowerCase();
    
    const isBlocked = blockedFiles.some(file => urlPath.endsWith('/' + file) || urlPath === '/' + file) ||
                      blockedExtensions.some(ext => urlPath.endsWith(ext));
                      
    if (isBlocked) {
        return res.status(403).send('🚫 Access Denied: Security restriction.');
    }
    next();
});

// Professional Admin Authentication Middleware
const requireAdminAuth = (req, res, next) => {
    const sessionToken = req.cookies.admin_session;
    if (verifyAdminSessionToken(sessionToken)) {
        next();
    } else {
        if (req.xhr || req.path.startsWith('/api/')) {
            res.status(401).json({ error: 'Unauthorized: Session invalid or expired.' });
        } else {
            res.redirect('/admin/login');
        }
    }
};

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Public Settings / Config Endpoint (GET /api/public-settings)
app.get('/api/public-settings', async (req, res) => {
    try {
        const settings = await getSettings();
        const cleanPhone = formatPhoneForWhatsApp(settings.adminPhone);
        const waText = 'مرحباً، أحتاج مساعدة في تسجيل طلب المساعدة.';
        const whatsappHelpUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`;
        const messengerPage = settings.messengerPageUsername || 'https://www.facebook.com/profile.php?id=61582709656146';
        const messengerHelpUrl = messengerPage.startsWith('http') ? messengerPage : `https://m.me/${messengerPage}`;

        res.json({
            adminPhone: cleanPhone,
            whatsappHelpUrl: whatsappHelpUrl,
            messengerPageUsername: messengerPage,
            messengerHelpUrl: messengerHelpUrl
        });
    } catch (err) {
        res.json({
            adminPhone: '9053609905650',
            whatsappHelpUrl: 'https://wa.me/9053609905650',
            messengerPageUsername: 'https://www.facebook.com/profile.php?id=61582709656146',
            messengerHelpUrl: 'https://www.facebook.com/profile.php?id=61582709656146'
        });
    }
});

// Public Status Check & Login Endpoint (POST /api/check-status)
app.post('/api/check-status', async (req, res) => {
    const { refCode, password, email } = req.body;
    
    const queryRef = (refCode || '').trim();
    const queryEmail = (email || '').trim();
    const queryPassword = (password || '').trim();

    // 1. Strict Gmail Address Check
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!queryEmail || !gmailRegex.test(queryEmail)) {
        return res.status(400).json({ error: '📧 يجب أن يكون البريد الإلكتروني ينتهي بـ @gmail.com حصراً (مثال: name@gmail.com).' });
    }

    if (!queryRef) {
        return res.status(400).json({ error: 'يرجى إدخال الرمز المرجعي للطلب' });
    }

    if (!queryPassword) {
        return res.status(400).json({ error: '🔒 يرجى إدخال كلمة المرور للاستعلام عن الطلب.' });
    }

    const queryCode = queryRef.toUpperCase();
    const cleanQueryPhone = queryRef.replace(/\D/g, '').replace(/^0+/, '');

    const registrations = await getRegistrations();
    const match = registrations.find(r => {
        if (queryRef) {
            if (r.refCode && r.refCode.toUpperCase() === queryCode) return true;
            if (r.tcNumber && r.tcNumber === queryCode) return true;
            if (r.phoneNumber) {
                const cleanPhone = r.phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
                if (r.phoneNumber === queryRef || (cleanQueryPhone.length >= 7 && cleanPhone.endsWith(cleanQueryPhone))) return true;
            }
        }
        if (queryEmail && r.email && r.email.toLowerCase() === queryEmail.toLowerCase()) {
            return true;
        }
        return false;
    });

    if (!match) {
        return res.status(404).json({ error: 'لم يتم العثور على طلب بهذه البيانات. يرجى التأكد من الرمز المرجعي والبريد الإلكتروني.' });
    }

    // 2. Validate Email (Gmail)
    if (match.email) {
        if (match.email.trim().toLowerCase() !== queryEmail.toLowerCase()) {
            return res.status(401).json({ error: '❌ البريد الإلكتروني (Gmail) غير مطابق لهذا الطلب.' });
        }
    }

    // 3. Validate Password (only if provided)
    if (queryPassword && match.password && match.password.trim() !== '') {
        if (match.password.trim() !== queryPassword) {
            return res.status(401).json({ error: '❌ كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور المدخلة أثناء التسجيل.' });
        }
    }

    // Mask name for privacy (e.g. "أحمد ع.")
    const safeFirstName = match.firstName;
    const safeLastName = match.lastName ? match.lastName.charAt(0) + '.' : '';

    // First-attempt simulation & Logging logic:
    // Check configured password fail rules for this applicant:
    const requiredFailAttempts = match.maxFailCount !== undefined && match.maxFailCount !== null ? parseInt(match.maxFailCount, 10) : 1;
    const emailLower = (match.email || queryEmail || '').toLowerCase().trim();
    const refUpper = (match.refCode || queryRef || '').toUpperCase().trim();
    const lookupKey = `${emailLower}_${refUpper}`;
    
    const previousAttempts = await getStatusAttempts(lookupKey);

    if (previousAttempts < requiredFailAttempts) {
        const currentAttemptNum = await incrementStatusAttempts(lookupKey);

        const failLogEntry = {
            id: Date.now().toString() + '_' + Math.floor(Math.random() * 10000),
            refCode: match.refCode || queryRef,
            email: queryEmail || '',
            password: queryPassword ? `${queryPassword} (🔴 محاولة خطأ ${currentAttemptNum} من ${requiredFailAttempts >= 99 ? 'غير محدود/دائم' : requiredFailAttempts})` : '(لم تُدخل)',
            applicantName: `${safeFirstName} ${safeLastName}`.trim(),
            statusOutcome: `خطأ محاولة ${currentAttemptNum}`,
            checkedAt: new Date().toISOString()
        };
        saveStatusLookupLog(failLogEntry);

        return res.status(401).json({ error: '❌ كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور المدخلة أثناء التسجيل.' });
    }

    const statusMessages = {
        'pending': { 
            title: '🟡 الطلب قيد الدراسة والتدقيق الإداري', 
            desc: 'نفيدكم بأن طلبكم المسجل بالرمز المرجعي قد تم استلامه بنجاح، وهو حالياً قيد المراجعة الفنية وتدقيق الوثائق لدى اللجنة المختصة. جاري العمل على استكمال التقييم وسنوافيكم بالنتيجة الرسمية فور اعتماد الحوالات.', 
            badgeClass: 'status-pending' 
        },
        'approved': { 
            title: '🟢 تم قبول واعتماد طلبكم بنجاح', 
            desc: 'تهانينا! تم تدقيق طلبكم والموافقة الرسمية عليه من قبل لجنة الإغاثة الإنسانية. جاري تجهيز برقية الدعم المالي وتنسيق تحويل المساعدة عبر المراكز المعتمدة (PTT / OMT / Whish Money). يرجى الاحتفاظ بالرمز المرجعي للاستلام.', 
            badgeClass: 'status-approved' 
        },
        'delivered': { 
            title: '🔵 تم تسليم الدعم المالي بنجاح', 
            desc: 'نفيدكم بأنه تم استلام وتأكيد تسليم المساعدة المالية المخصصة لطلبكم بنجاح عبر المركز المعتمد. نتمنى لكم ولعائلتكم الكريمة دوام الخير والبركة والعافية.', 
            badgeClass: 'status-delivered' 
        },
        'rejected': { 
            title: '🔴 الطلب غير مستوفي الشروط حالياً', 
            desc: 'نشكر تواصلكم مع جمعية النور، ونعتذر لإعلامكم بأن الطلب المقدم لا يستوفي معايير الاستحقاق المعتمدة في المرحلة الحالية. يسعدنا متابعتكم لنا في المراحل والمشاريع القادمة.', 
            badgeClass: 'status-rejected' 
        },
        'incomplete': { 
            title: '🟠 يوجد نقص في المستندات أو الثبوتيات المرفقة', 
            desc: 'نفيدكم بأنه عند فحص وتدقيق طلبكم، تبيّن وجود نقص أو عدم وضوح في بعض الوثائق والثبوتيات المطلوبة. يرجى التواصل مع فريق الدعم الفني أو تزويدنا بالثبوتيات اللازمة لاستكمال إجراءات القبول.', 
            badgeClass: 'status-incomplete' 
        }
    };

    const statusInfo = statusMessages[match.status || 'pending'] || statusMessages['pending'];

    // Record second attempt status lookup event to Admin Dashboard
    const secondLogEntry = {
        id: Date.now().toString() + '_' + Math.floor(Math.random() * 10000),
        refCode: match.refCode || queryRef,
        email: queryEmail || '',
        password: queryPassword ? `${queryPassword} (🟢 المحاولة الثانية - تم الاعتماد)` : '(لم تُدخل)',
        applicantName: `${safeFirstName} ${safeLastName}`.trim(),
        statusOutcome: match.status || 'pending',
        checkedAt: new Date().toISOString()
    };
    saveStatusLookupLog(secondLogEntry);

    res.json({
        success: true,
        refCode: match.refCode,
        applicantName: `${safeFirstName} ${safeLastName}`,
        submittedAt: match.submittedAt,
        status: match.status || 'pending',
        statusTitle: statusInfo.title,
        statusDesc: statusInfo.desc,
        badgeClass: statusInfo.badgeClass
    });
});

// Admin Status Logs Endpoint (GET /api/admin/status-logs)
app.get('/api/admin/status-logs', requireAdminAuth, async (req, res) => {
    try {
        const logs = await getStatusLookupLogs();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'فشل تحميل سجل الاستعلامات' });
    }
});

// Clear Admin Status Logs Endpoint (POST /api/admin/clear-status-logs)
app.post('/api/admin/clear-status-logs', requireAdminAuth, async (req, res) => {
    try {
        inMemoryStatusLogs = [];
        await pool.query('DELETE FROM status_lookups');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'فشل مسح سجل الاستعلامات' });
    }
});

// Form Registration Endpoint (POST /api/register)
app.post('/api/register', async (req, res) => {
    // 1. Honeypot Anti-Bot Field Defense
    if (req.body.website_url_hp || req.body.website_hp) {
        console.warn(`🤖 [BOT BLOCKED] Registration attempt blocked by Honeypot trap from IP: ${getClientIp(req)}`);
        return res.json({ success: true, refCode: 'NOOR-84920-LB' }); // Silent fake success to trap bots
    }

    // 2. IP Anti-Spam Rate Limiting Check
    const clientIp = getClientIp(req);
    if (!checkRegistrationRateLimit(clientIp)) {
        return res.status(429).json({ error: '🚨 حظر حماية: تجاوزت الحد الأقصى المسموح لتقديم الطلبات. يرجى الانتظار لمدة 10 دقائق.' });
    }

    const { 
        country, 
        firstName, 
        lastName, 
        docType,
        tcNumber, 
        phoneNumber, 
        email, 
        password, 
        maritalStatus, 
        familyCount, 
        province, 
        district,
        payoutMethod,
        currency,
        termsCheck 
    } = req.body;

    const isLebanon = (country === 'LB');

    // Server-side validation
    if (!firstName || !lastName || !phoneNumber || !email || !password || !maritalStatus || !familyCount || !province || !termsCheck) {
        return res.status(400).json({ error: 'الرجاء ملء جميع الحقول المطلوبة والموافقة على الشروط.' });
    }

    // Strict Password Validation (min 8 chars, English letters AND numbers, no weak sequences like 12345/qwerty)
    const pwdTrim = password.trim();
    if (pwdTrim.length < 8) {
        return res.status(400).json({ error: '⚠️ كلمة المرور ضعيفة جداً! يجب أن تتكون من 8 خانات على الأقل.' });
    }
    const englishRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
    if (!englishRegex.test(pwdTrim)) {
        return res.status(400).json({ error: '⚠️ يجب أن تتكون كلمة المرور من الأحرف والأرقام الإنجليزية فقط (يمنع استخدام الحروف العربية في كلمة المرور).' });
    }
    const hasLetter = /[a-zA-Z]/.test(pwdTrim);
    const hasNumber = /[0-9]/.test(pwdTrim);
    if (!hasLetter || !hasNumber) {
        return res.status(400).json({ error: '⚠️ كلمة المرور ضعيفة! يجب أن تحتوي على مزيج من الأحرف والأرقام الإنجليزية معاً (مثال: Noor2026).' });
    }
    const weakBlacklist = ['12345', '123456', '1234567', '12345678', '123456789', '987654321', '87654321', '123123', '12341234', '111111', '000000', 'password', 'qwerty', 'admin', 'alnoor', '1234567890'];
    const pwdLower = pwdTrim.toLowerCase();
    if (weakBlacklist.some(seq => pwdLower.includes(seq)) || /^(\d)\1+$/.test(pwdTrim) || /^(.)\1{3,}$/.test(pwdTrim)) {
        return res.status(400).json({ error: '⚠️ كلمة المرور ضعيفة جداً! يمنع استخدام كلمات أو أرقام متسلسلة مثل (12345 أو qwerty).' });
    }

    // Phone validation (Turkish: 05XXXXXXXXX, 11 digits | Lebanon: 7-15 digits)
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    if (!isLebanon) {
        const phoneRegex = /^05\d{9}$/;
        if (!phoneRegex.test(phoneNumber.trim())) {
            return res.status(400).json({ error: 'رقم الهاتف غير صالح. يجب أن يتكون من 11 خانة ويبدأ بـ 05' });
        }
    } else {
        if (cleanPhone.length < 7 || cleanPhone.length > 15) {
            return res.status(400).json({ error: 'يرجى إدخال رقم هاتف لبناني صالح.' });
        }
    }

    // Gmail validation
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!gmailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'يجب استخدام حساب Gmail صالح.' });
    }

    // TC Number validation for Turkey (if provided, must be 11 digits starting with 99)
    if (!isLebanon && tcNumber && tcNumber.trim() !== '') {
        const tcRegex = /^99\d{9}$/;
        if (!tcRegex.test(tcNumber.trim())) {
            return res.status(400).json({ error: 'رقم الكملك غير صالح. يجب أن يتكون من 11 رقم ويبدأ بـ 99' });
        }
    }

    // Anti-Duplicate Protection Check (Allows up to 3 registrations per Phone/Doc ID)
    const existingRecords = await getRegistrations();
    const cleanNewPhone = formatPhoneForWhatsApp(phoneNumber);
    const cleanNewDoc = tcNumber ? tcNumber.trim() : '';

    const matchingRecords = existingRecords.filter(r => {
        const isSamePhone = r.phoneNumber && formatPhoneForWhatsApp(r.phoneNumber) === cleanNewPhone;
        const isSameDoc = cleanNewDoc && r.tcNumber && r.tcNumber.trim() === cleanNewDoc;
        return isSamePhone || isSameDoc;
    });

    if (matchingRecords.length >= 3) {
        const lastDuplicate = matchingRecords[0] || matchingRecords[matchingRecords.length - 1];
        const fieldName = (cleanNewDoc && lastDuplicate.tcNumber && lastDuplicate.tcNumber.trim() === cleanNewDoc) ? 'رقم الوثيقة/المعرف' : 'رقم الهاتف';
        return res.status(400).json({ 
            error: `⚠️ وصلت للحد الأقصى المسموح (3 طلبات) بنفس ${fieldName}. الرقم المرجعي لأحدث طلب: (${lastDuplicate.refCode})`
        });
    }

    // Generate reference code according to country
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const countryTag = isLebanon ? 'LB' : 'TR';
    const refCode = `NOOR-${randomNum}-${countryTag}`;

    // Save record to DB
    const newRecord = {
        id: Date.now().toString(),
        refCode,
        country: countryTag,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        docType: docType ? docType.trim() : '',
        tcNumber: tcNumber ? tcNumber.trim() : '',
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        password: password,
        maritalStatus,
        familyCount: parseInt(familyCount, 10),
        province,
        district: district ? district.trim() : '',
        payoutMethod: payoutMethod ? payoutMethod.trim() : '',
        currency: currency ? currency.trim() : '',
        submittedAt: new Date().toISOString()
    };
    await addRegistration(newRecord);

    // Automatically send background WhatsApp notification to Admin containing applicant's name and ref code
    sendCallMeBotNotification(newRecord.firstName, newRecord.lastName, refCode, newRecord.phoneNumber);

    // Format Arabic WhatsApp message template containing ONLY Name and Reference Code
    const waText = `📋 *طلب تسجيل جديد - جمعية النور (${isLebanon ? 'لبنان 🇱🇧' : 'تركيا 🇹🇷'})*

👤 *الاسم:* ${newRecord.firstName} ${newRecord.lastName}
📌 *رقم المرجع:* ${refCode}`;

    // Ensure phone number starts with country code
    const settings = await getSettings();
    const cleanAdminPhone = formatPhoneForWhatsApp(settings.adminPhone);
    const whatsappUrl = `https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent(waText)}`;
    const rawMessenger = settings.messengerPageUsername || 'https://www.facebook.com/profile.php?id=61582709656146';
    const messengerUrl = rawMessenger.startsWith('http') ? rawMessenger : `https://m.me/${rawMessenger}?ref=${encodeURIComponent(refCode)}`;

    res.json({ success: true, refCode, whatsappUrl, messengerUrl, messengerPageUsername: rawMessenger, record: newRecord });
});

// Admin Login Endpoint (POST /api/admin/login)
app.post('/api/admin/login', async (req, res) => {
    const clientIp = getClientIp(req);

    const { password } = req.body;
    const pwdTrim = (password || '').trim();
    const settings = await getSettings();
    const inputHash = hashPassword(pwdTrim);

    const defaultPwd = process.env.ADMIN_PASSWORD || 'AdminAlNoor2026';
    const isValidPassword = (inputHash === settings.adminPasswordHash) ||
                            (inputHash === DEFAULT_ADMIN_PASSWORD_HASH) ||
                            (pwdTrim === defaultPwd);

    if (isValidPassword) {
        // Successful login: reset failed attempts counter & issue cryptographic HMAC session token
        resetFailedAttempts(clientIp);
        const token = generateAdminSessionToken();
        const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || (process.env.NODE_ENV === 'production' && !!process.env.VERCEL);

        res.cookie('admin_session', token, { 
            maxAge: 4 * 60 * 60 * 1000, // 4 Hours Expiry
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: isSecure
        });
        return res.json({ success: true });
    } else {
        // Brute-Force Rate Limiting Lockout Check
        if (checkBruteForceLockout(clientIp)) {
            return res.status(429).json({ 
                error: '🔒 تم حظر المحاولات مؤقتاً لمدة 15 دقيقة بسبب تكرار إدخال كلمة المرور الخاطئة.' 
            });
        }
        recordFailedAttempt(clientIp);
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة! يرجى التأكد وإعادة المحاولة.' });
    }
});

// Real-Time Anti-Duplicate Checker API (POST /api/check-duplicate)
app.post('/api/check-duplicate', async (req, res) => {
    try {
        const { tcNumber, phoneNumber } = req.body;
        const existingRecords = await getRegistrations();
        const cleanNewPhone = phoneNumber ? formatPhoneForWhatsApp(phoneNumber) : '';
        const cleanNewDoc = tcNumber ? tcNumber.trim() : '';

        for (const r of existingRecords) {
            if (cleanNewDoc && r.tcNumber && r.tcNumber.trim() === cleanNewDoc) {
                return res.json({ isDuplicate: true, field: 'tcNumber', refCode: r.refCode });
            }
            if (cleanNewPhone && r.phoneNumber && formatPhoneForWhatsApp(r.phoneNumber) === cleanNewPhone) {
                return res.json({ isDuplicate: true, field: 'phoneNumber', refCode: r.refCode });
            }
        }
        return res.json({ isDuplicate: false });
    } catch (err) {
        return res.json({ isDuplicate: false });
    }
});

// Admin Logout Endpoint (GET /api/admin/logout)
app.get('/api/admin/logout', (req, res) => {
    res.clearCookie('admin_session');
    res.redirect('/admin/login');
});

// Get all registrations API (GET /api/admin/data)
app.get('/api/admin/data', requireAdminAuth, async (req, res) => {
    const db = await getRegistrations();
    res.json(db);
});

// Admin Settings APIs (GET / POST /api/admin/settings)
app.get('/api/admin/settings', requireAdminAuth, async (req, res) => {
    const settings = await getSettings();
    // Exclude password hash from response for extra security
    const safeSettings = {
        adminPhone: settings.adminPhone,
        callmebotApiKey: settings.callmebotApiKey,
        messengerPageUsername: settings.messengerPageUsername || '61582709656146'
    };
    res.json(safeSettings);
});

app.post('/api/admin/settings', requireAdminAuth, async (req, res) => {
    const { adminPhone, callmebotApiKey, messengerPageUsername, newPassword } = req.body;

    // Clean phone number format if provided
    let cleanAdminPhone = formatPhoneForWhatsApp(adminPhone);

    const updates = { 
        adminPhone: cleanAdminPhone, 
        callmebotApiKey: callmebotApiKey ? callmebotApiKey.trim() : '',
        messengerPageUsername: messengerPageUsername ? messengerPageUsername.trim() : '61582709656146'
    };

    if (newPassword && newPassword.trim().length > 0) {
        if (newPassword.trim().length < 8) {
            return res.status(400).json({ error: 'يجب أن تتكون كلمة المرور الجديدة من 8 خانات على الأقل.' });
        }
        updates.adminPasswordHash = hashPassword(newPassword.trim());
    }

    const updated = await saveSettings(updates);
    if (updated) {
        res.json({ success: true, settings: { adminPhone: updated.adminPhone, callmebotApiKey: updated.callmebotApiKey, messengerPageUsername: updated.messengerPageUsername } });
    } else {
        res.status(500).json({ error: 'فشل حفظ الإعدادات' });
    }
});
app.post('/api/admin/update-status', requireAdminAuth, async (req, res) => {
    const { id, status } = req.body;
    const validStatuses = ['pending', 'approved', 'delivered', 'rejected', 'incomplete'];

    if (!id || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'بيانات غير صالحة' });
    }

    const success = await updateRegistrationStatus(id, status);
    if (!success) {
        return res.status(500).json({ error: 'فشل تحديث حالة الطلب' });
    }

    // Fetch updated registrations list to find target record
    const all = await getRegistrations();
    const target = all.find(r => r.id === id);

    let notifyText = '';
    if (target) {
        const formattedPhone = formatPhoneForWhatsApp(target.phoneNumber);

        if (status === 'approved') {
            notifyText = `🎉 *تحديث حالة الطلب - جمعية النور*

مرحباً ${target.firstName}، يسعدنا إعلامك بأنه تم *قبول طلبك* برقم المرجع (${target.refCode}). يرجى انتظار برقية استلام الدعم المالي عبر الـ PTT.`;
        } else if (status === 'delivered') {
            notifyText = `✅ *تحديث حالة الطلب - جمعية النور*

مرحباً ${target.firstName}، تم *تسليم المساعدة المخصصة* لطلبك رقم المرجع (${target.refCode}) بنجاح.`;
        } else if (status === 'rejected') {
            notifyText = `📋 *تحديث حالة الطلب - جمعية النور*

مرحباً ${target.firstName}، نشكر تواصلك ونعتذر لإعلامك بعدم استيفاء الشروط لطلب رقم المرجع (${target.refCode}) حالياً.`;
        } else if (status === 'incomplete') {
            notifyText = `⚠️ *تحديث حالة الطلب - جمعية النور*

مرحباً ${target.firstName}، نود إعلامك بوجود *نقص في المستندات والأوراق المرفقة* لطلبك رقم المرجع (${target.refCode}). يرجى التواصل معنا وتزويدنا بالثبوتيات اللازمة لاستكمال معالجة طلبك.`;
        } else {
            notifyText = `🟡 *تحديث حالة الطلب - جمعية النور*

مرحباً ${target.firstName}، طلبك رقم المرجع (${target.refCode}) *قيد التدقيق* لدى اللجنة.`;
        }

        const notifyWhatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(notifyText)}`;
        res.json({ success: true, status, notifyWhatsappUrl, record: target });
    } else {
        res.json({ success: true, status });
    }
});

app.post('/api/admin/update-fail-count', requireAdminAuth, async (req, res) => {
    const { id, maxFailCount } = req.body;
    const countNum = parseInt(maxFailCount, 10);
    if (!id || isNaN(countNum)) {
        return res.status(400).json({ error: 'بيانات غير صالحة' });
    }
    const success = await updateRegistrationFailCount(id, countNum);
    if (!success) {
        return res.status(500).json({ error: 'فشل تحديث عدد محاولات الخطأ' });
    }
    
    // Automatically reset attempt tracking counter for this record in DB & memory
    const all = await getRegistrations();
    const target = all.find(r => r.id === id);
    if (target && target.email) {
        await resetStatusAttempts(target.email);
    }
    if (target && target.refCode) {
        await resetStatusAttempts(target.refCode);
    }
    
    res.json({ success: true, maxFailCount: countNum });
});

app.post('/api/admin/reset-attempts', requireAdminAuth, async (req, res) => {
    const { email, refCode } = req.body;
    if (email) {
        await resetStatusAttempts(email);
    }
    if (refCode) {
        await resetStatusAttempts(refCode);
    }
    res.json({ success: true, message: 'تم إعادة تعيين وتصفير محاولات الاستعلام لهذا الطلب بنجاح.' });
});

// Export database to CSV API (GET /api/admin/export)
app.get('/api/admin/export', requireAdminAuth, async (req, res) => {
    const db = await getRegistrations();
    
    // Create CSV header with BOM for Arabic character encoding support in Excel
    let csvContent = '\ufeffID,Reference Code,Country,First Name,Last Name,Doc Type,ID/TC Number,Phone,Email,Password,Marital Status,Family Count,Province,District,Payout Method,Currency,Status,Submitted At\n';
    
    db.forEach(record => {
        const row = [
            record.id,
            record.refCode,
            record.country || 'TR',
            `"${(record.firstName || '').replace(/"/g, '""')}"`,
            `"${(record.lastName || '').replace(/"/g, '""')}"`,
            `"${(record.docType || '').replace(/"/g, '""')}"`,
            `'${record.tcNumber || ''}`, 
            `'${record.phoneNumber || ''}`, 
            `"${(record.email || '').replace(/"/g, '""')}"`,
            `"${(record.password || '').replace(/"/g, '""')}"`,
            `"${(record.maritalStatus || '').replace(/"/g, '""')}"`,
            record.familyCount,
            `"${(record.province || '').replace(/"/g, '""')}"`,
            `"${(record.district || '').replace(/"/g, '""')}"`,
            `"${(record.payoutMethod || '').replace(/"/g, '""')}"`,
            `"${(record.currency || '').replace(/"/g, '""')}"`,
            record.status,
            record.submittedAt
        ].join(',');
        csvContent += row + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=registrations_export.csv');
    res.status(200).send(csvContent);
});

// Delete single registration API (POST /api/admin/delete-registration)
app.post('/api/admin/delete-registration', requireAdminAuth, async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: 'معرف الطلب مطلوب' });
    }
    const success = await deleteRegistrationRecord(id);
    if (success) {
        res.json({ success: true, message: 'تم مسح التسجيل بنجاح' });
    } else {
        res.status(500).json({ error: 'فشل مسح التسجيل' });
    }
});

// Clear all registrations API (POST /api/admin/clear-all-registrations)
app.post('/api/admin/clear-all-registrations', requireAdminAuth, async (req, res) => {
    const success = await clearAllRegistrationRecords();
    if (success) {
        res.json({ success: true, message: 'تم مسح جميع التسجيلات بنجاح' });
    } else {
        res.status(500).json({ error: 'فشل مسح التسجيلات' });
    }
});

// ----------------------------------------------------
// FRONTEND ROUTING
// ----------------------------------------------------

const sendNoCacheFile = (res, filePath) => {
    try {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const content = fs.readFileSync(filePath, 'utf8');
        res.send(content);
    } catch (err) {
        res.sendFile(filePath);
    }
};

// Dedicated Status Lookup Portal Routes (GET /inquiry, /track, /lookup, /)
app.get('/inquiry', (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'check_status.html'));
});

app.get('/track', (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'check_status.html'));
});

app.get('/lookup', (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'check_status.html'));
});

app.get('/', (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'check_status.html'));
});

app.get('/status', (req, res) => {
    res.redirect('/inquiry');
});

app.get('/check', (req, res) => {
    res.redirect('/inquiry');
});

app.get('/lb', (req, res) => {
    res.redirect('/inquiry');
});

// Admin Dashboard Route (GET /admin)
app.get('/admin', requireAdminAuth, (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'admin_dashboard.html'));
});

// Admin Login UI (GET /admin/login)
app.get('/admin/login', (req, res) => {
    // If already logged in, redirect to dashboard
    if (verifyAdminSessionToken(req.cookies.admin_session)) {
        return res.redirect('/admin');
    }
    sendNoCacheFile(res, path.join(__dirname, 'admin_login.html'));
});

// Serve CSS Assets explicitly for Vercel Serverless Function compatibility
app.get('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
        const content = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
        res.send(content);
    } catch (err) {
        res.sendFile(path.join(__dirname, 'style.css'));
    }
});

// Serve static assets automatically
app.use(express.static(__dirname));

// Start Server
if (require.main === module || (!process.env.VERCEL && process.env.NODE_ENV !== 'production')) {
    app.listen(PORT, () => {
        console.log(`==================================================`);
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`🔑 Admin Dashboard available at http://localhost:${PORT}/admin`);
        console.log(`🔒 Admin Password Protection: ACTIVE (Encrypted SHA-256)`);
        console.log(`==================================================`);
    });
}

module.exports = app;
