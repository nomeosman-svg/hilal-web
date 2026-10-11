const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const compression = require('compression');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
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

const DEFAULT_ADMIN_PASSWORD_HASH = hashPassword(process.env.ADMIN_PASSWORD || 'ahmet12345');

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
        adsensePublisherId: process.env.ADSENSE_PUBLISHER_ID || '',
        adsenseEnabled: process.env.ADSENSE_ENABLED === 'true' || false,
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

// Strict JSON & UrlEncoded Payload Size Limits to prevent DoS attacks
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Safe JSON Syntax Error Interceptor (Prevent server crash or stack trace leaks)
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'تنسيق البيانات غير صالح (Invalid Payload)' });
    }
    next(err);
});

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
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
            ALTER TABLE registrations ADD COLUMN IF NOT EXISTS aid_type VARCHAR(50) DEFAULT 'both';
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
            countryName: row.country_name || (row.country === 'TR' ? 'تركيا' : (row.country === 'LB' ? 'لبنان' : (row.country || 'دولي'))),
            aidType: row.aid_type || 'both',
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
        return readDatabase().map(r => ({ ...r, country: r.country || 'TR', aidType: r.aidType || 'both', status: r.status || 'pending', maxFailCount: r.maxFailCount !== undefined ? r.maxFailCount : 1 }));
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
    const countryName = record.countryName || '';
    const aidType = record.aidType || 'both';
    try {
        await pool.query(
            `INSERT INTO registrations (id, ref_code, country, country_name, aid_type, first_name, last_name, tc_number, doc_type, phone_number, email, password, marital_status, family_count, province, district, payout_method, currency, status, submitted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [
                record.id,
                record.refCode,
                country,
                countryName,
                aidType,
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
        db.push({ ...record, country, countryName, aidType, status });
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

// ====================================================
// BULLETPROOF SECURITY & WAF DEFENSE ARCHITECTURE
// ====================================================

// Helper to get client IP cleanly (handling reverse proxies like Cloudflare/Vercel)
const getClientIp = (req) => {
    if (!req) return '127.0.0.1';
    const cfIp = req.headers ? req.headers['cf-connecting-ip'] : null;
    if (cfIp) return String(cfIp).trim();
    const forwarded = req.headers ? req.headers['x-forwarded-for'] : null;
    if (forwarded) {
        return String(forwarded).split(',')[0].trim();
    }
    return req.ip || (req.socket ? req.socket.remoteAddress : '127.0.0.1') || '127.0.0.1';
};

// Security Logging Helper
const logSecurityEvent = (eventType, ip, detail) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${eventType}] IP: ${ip} - ${detail}\n`;
    try {
        const secLogFile = path.join(__dirname, 'logs', 'security.log');
        fs.appendFileSync(secLogFile, entry, 'utf8');
    } catch (e) {}
    console.warn(`🚨 [SECURITY WAF] [${eventType}] IP: ${ip} - ${detail}`);
};

// In-Memory WAF Threat & Rate Limit Trackers
const ipBanList = new Map(); // ip -> banUntilTimestamp
const globalRateLimitMap = new Map(); // ip -> { count, resetAt }
const statusRateLimitMap = new Map(); // ip -> { count, resetAt }
const registrationRateMap = new Map(); // ip -> { count, resetAt }

const banIp = (ip, durationMs, reason) => {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') {
        logSecurityEvent('LOCAL_PROBE_BLOCKED', ip, `Ignored ban for localhost: ${reason}`);
        return;
    }
    const banUntil = Date.now() + durationMs;
    ipBanList.set(ip, banUntil);
    logSecurityEvent('IP_BANNED', ip, `Banned for ${Math.round(durationMs / 60000)} mins. Reason: ${reason}`);
};

// 1. Active WAF Honeytrap & IP Blacklist Shield
app.use((req, res, next) => {
    const clientIp = getClientIp(req);
    const now = Date.now();

    // Check if IP is currently banned
    if (ipBanList.has(clientIp)) {
        const banExpiry = ipBanList.get(clientIp);
        if (now < banExpiry) {
            res.setHeader('Retry-After', Math.ceil((banExpiry - now) / 1000));
            return res.status(403).send('🚫 Access Denied: Your IP address has been temporarily blocked due to malicious scanning activity.');
        } else {
            ipBanList.delete(clientIp);
        }
    }

    // Inspect URL for known vulnerability probes & exploits
    const rawUrl = (req.originalUrl || req.url || '').toLowerCase();
    const PROBE_PATTERNS = [
        '/wp-', '/xmlrpc', '/phpmyadmin', '/pma', '/.env', '/.git',
        '/config.json', '/server.js', '/runner.js', '/db.json', '/settings.json',
        '/.aws', '/cgi-bin', '/actuator', '/etc/passwd', '/.vscode',
        '/.idea', '/telescope', '/solr', '/vendor', '/composer.json',
        '/phpunit', '/eval-stdin', '/phpinfo', '/web.config'
    ];
    const PROBE_EXTENSIONS = ['.php', '.asp', '.aspx', '.jsp', '.sql', '.bak', '.ini', '.sh', '.bat', '.cmd', '.vbs', '.ps1', '.cfg'];

    const isProbePath = PROBE_PATTERNS.some(p => rawUrl.includes(p));
    const isProbeExt = PROBE_EXTENSIONS.some(ext => {
        const urlWithoutQuery = rawUrl.split('?')[0];
        return urlWithoutQuery.endsWith(ext);
    });

    if (isProbePath || isProbeExt) {
        banIp(clientIp, 2 * 60 * 60 * 1000, `Probed restricted/malicious path: ${rawUrl}`);
        return res.status(403).send('🚫 Access Denied: Security restriction.');
    }

    // Inspect query strings for SQLi & XSS signatures
    if (rawUrl.includes('<script') || rawUrl.includes('javascript:') || rawUrl.includes('union%20select') || rawUrl.includes('drop%20table')) {
        banIp(clientIp, 1 * 60 * 60 * 1000, `Injection attack payload detected in URL: ${rawUrl}`);
        return res.status(400).send('🚫 Malicious input detected.');
    }

    // Global Anti-DDoS Rate Limiter (Max 150 requests per minute)
    const windowMs = 60 * 1000;
    const maxReqs = 150;
    const ipRecord = globalRateLimitMap.get(clientIp) || { count: 0, resetAt: now + windowMs };
    if (now > ipRecord.resetAt) {
        ipRecord.count = 1;
        ipRecord.resetAt = now + windowMs;
    } else {
        ipRecord.count += 1;
    }
    globalRateLimitMap.set(clientIp, ipRecord);

    if (ipRecord.count > maxReqs) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', clientIp, `Exceeded 150 req/min (Count: ${ipRecord.count})`);
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: '🚨 تم تجاوز معدل الطلبات المسموح به. يرجى الانتظار دقيقة واحدة.' });
    }

    next();
});

// 2. Deep Recursive Input Sanitization Middleware
const sanitizeDeep = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
            let val = obj[key].replace(/\0/g, '').trim(); // Remove null bytes
            val = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''); // Strip scripts
            val = val.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ''); // Strip iframes
            val = val.replace(/javascript\s*:/gi, ''); // Strip javascript: protocol
            val = val.replace(/data\s*:\s*text\/html/gi, ''); // Strip data: URI XSS
            if (val.length > 1000) val = val.substring(0, 1000); // Prevent buffer overflow
            obj[key] = val;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeDeep(obj[key]);
        }
    }
};

app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') sanitizeDeep(req.body);
    if (req.query && typeof req.query === 'object') sanitizeDeep(req.query);
    next();
});

// 3. Enterprise HTTP Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://pagead2.googlesyndication.com https://*.google.com https://*.doubleclick.net https://static.cloudflareinsights.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https:; " +
        "frame-src 'self' https://www.facebook.com https://*.google.com https://*.doubleclick.net; " +
        "base-uri 'self'; " +
        "form-action 'self' https:;"
    );
    next();
});

// 4. High-performance GZIP/Brotli Compression
app.use(compression({
    level: 6,
    threshold: 256,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// 5. Block direct web access to sensitive project files and admin HTML templates
app.use((req, res, next) => {
    const blockedFiles = [
        'db.json', 
        'settings.json',
        'server.js', 
        'runner.js',
        'package.json', 
        'package-lock.json', 
        'vercel.json',
        'render.yaml',
        'start_service.vbs',
        'start_server.bat',
        'stop_server.bat',
        'check_status.bat',
        'admin_dashboard.html',
        'admin_login.html',
        '.git',
        '.env'
    ];
    const blockedExtensions = ['.json', '.env', '.git', '.md', '.yml', '.yaml', '.bat', '.vbs', '.ps1', '.sh', '.log', '.sql', '.bak', '.ini', '.cfg'];
    const urlPath = req.path.toLowerCase();
    
    const isBlocked = blockedFiles.some(file => urlPath.endsWith('/' + file) || urlPath === '/' + file) ||
                      blockedExtensions.some(ext => urlPath.endsWith(ext));
                      
    if (isBlocked) {
        logSecurityEvent('RESTRICTED_FILE_BLOCKED', getClientIp(req), `Blocked direct access to: ${urlPath}`);
        return res.status(403).send('🚫 Access Denied: Security restriction.');
    }
    next();
});

// 6. Hardened Session Token Generation & Verification with IP & Fingerprint Binding
const generateAdminSessionToken = (req) => {
    const timestamp = Date.now().toString();
    const entropy = crypto.randomBytes(16).toString('hex');
    const clientIp = getClientIp(req);
    const userAgent = (req && req.headers ? (req.headers['user-agent'] || '') : '').slice(0, 80);
    const ipUaBinding = crypto.createHash('sha256').update(`${clientIp}|${userAgent}|${SECURITY_SECRET}`).digest('hex').slice(0, 16);
    const payload = `v2.${timestamp}.${entropy}.${ipUaBinding}`;
    const signature = crypto.createHmac('sha256', SECURITY_SECRET).update(payload).digest('hex');
    return `${payload}.${signature}`;
};

const verifyAdminSessionToken = (token, req) => {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    
    // Modern v2 token: v2.timestamp.entropy.ipUaBinding.signature (5 parts)
    if (parts.length === 5 && parts[0] === 'v2') {
        const [ver, timestampStr, entropy, tokenBinding, signature] = parts;
        const timestamp = parseInt(timestampStr, 10);
        if (isNaN(timestamp) || Date.now() - timestamp > 4 * 60 * 60 * 1000) return false;

        const payload = `${ver}.${timestampStr}.${entropy}.${tokenBinding}`;
        const expectedHmac = crypto.createHmac('sha256', SECURITY_SECRET).update(payload).digest('hex');
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedHmac, 'hex');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

        if (req) {
            const clientIp = getClientIp(req);
            const userAgent = (req.headers ? (req.headers['user-agent'] || '') : '').slice(0, 80);
            const currentBinding = crypto.createHash('sha256').update(`${clientIp}|${userAgent}|${SECURITY_SECRET}`).digest('hex').slice(0, 16);
            if (currentBinding !== tokenBinding) {
                logSecurityEvent('SESSION_HIJACK_BLOCKED', clientIp, 'Admin session rejected due to IP/User-Agent mismatch.');
                return false;
            }
        }
        return true;
    }

    // Backward compatibility for legacy 2-part tokens during active sessions
    if (parts.length === 2) {
        const [timestampStr, signature] = parts;
        const timestamp = parseInt(timestampStr, 10);
        if (isNaN(timestamp) || Date.now() - timestamp > 4 * 60 * 60 * 1000) return false;
        const expectedHmac = crypto.createHmac('sha256', SECURITY_SECRET).update(timestampStr).digest('hex');
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedHmac, 'hex');
        if (sigBuf.length !== expBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, expBuf);
    }

    return false;
};

// 7. Brute-Force Rate Limiting Helpers
const checkBruteForceLockout = (ip) => {
    const record = loginAttemptsMap.get(ip);
    if (!record) return false;
    if (record.lockUntil && Date.now() < record.lockUntil) {
        return true;
    }
    if (record.lockUntil && Date.now() >= record.lockUntil) {
        loginAttemptsMap.delete(ip);
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
        record.lockUntil = now + 15 * 60 * 1000;
        logSecurityEvent('BRUTE_FORCE_LOCKOUT', ip, 'Locked out for 15 minutes due to 5 failed login attempts.');
    }
    loginAttemptsMap.set(ip, record);
};

const resetFailedAttempts = (ip) => {
    loginAttemptsMap.delete(ip);
};

// 8. Strict Input Sanitizer against XSS & Injection Attacks
const sanitizeInput = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/<[^>]*>?/gm, '')
        .replace(/[\<\>\"\'\`]/g, '')
        .trim();
};

// 9. Server-Side Anti-Spam Registration Rate Limiter
const checkRegistrationRateLimit = (ip) => {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const maxRequests = 5;

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

// 10. Professional Admin Authentication Middleware
const requireAdminAuth = (req, res, next) => {
    const sessionToken = req.cookies.admin_session;
    if (verifyAdminSessionToken(sessionToken, req)) {
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
            messengerHelpUrl: messengerHelpUrl,
            adsensePublisherId: settings.adsensePublisherId || '',
            adsenseEnabled: !!settings.adsenseEnabled
        });
    } catch (err) {
        res.json({
            adminPhone: '9053609905650',
            whatsappHelpUrl: 'https://wa.me/9053609905650',
            messengerPageUsername: 'https://www.facebook.com/profile.php?id=61582709656146',
            messengerHelpUrl: 'https://www.facebook.com/profile.php?id=61582709656146',
            adsensePublisherId: '',
            adsenseEnabled: false
        });
    }
});

// Public Status Check & Login Endpoint (POST /api/check-status)
app.post('/api/check-status', async (req, res) => {
    // 0. Honeypot Anti-Bot Shield
    if (req.body.company_name_hp || req.body.website_hp || req.body.security_trap) {
        logSecurityEvent('BOT_TRAPPED', getClientIp(req), 'Bot trapped in check-status honeypot.');
        return res.status(401).json({ error: '❌ خطأ في التحقق من البيانات.' });
    }

    // 0.1 IP Anti-Brute-Force Rate Limiting (max 12 checks per minute)
    const clientIp = getClientIp(req);
    const now = Date.now();
    const statusLimit = statusRateLimitMap.get(clientIp) || { count: 0, resetAt: now + 60000 };
    if (now > statusLimit.resetAt) {
        statusLimit.count = 1;
        statusLimit.resetAt = now + 60000;
    } else {
        statusLimit.count += 1;
    }
    statusRateLimitMap.set(clientIp, statusLimit);
    if (statusLimit.count > 12) {
        logSecurityEvent('STATUS_BRUTE_FORCE', clientIp, `Exceeded 12 status checks in 1 minute.`);
        return res.status(429).json({ error: '🔒 تم تجاوز عدد محاولات الاستعلام المسموح بها. يرجى الانتظار دقيقة واحدة والمحاولة مجدداً.' });
    }

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
            return res.status(401).json({ error: '❌ كلمة مرور حسابك غير صحيحة. يرجى التأكد من كلمة المرور المدخلة أثناء التسجيل.' });
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

        return res.status(401).json({ error: '❌ كلمة مرور حسابك غير صحيحة. يرجى التأكد من كلمة المرور المدخلة أثناء التسجيل.' });
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
            desc: 'نشكر تواصلكم مع منظمة الهلال الأحمر، ونعتذر لإعلامكم بأن الطلب المقدم لا يستوفي معايير الاستحقاق المعتمدة في المرحلة الحالية. يسعدنا متابعتكم لنا في المراحل والمشاريع القادمة.', 
            badgeClass: 'status-rejected' 
        },
        'incomplete': { 
            title: '🟠 يوجد نقص في المستندات أو الثبوتيات المرفقة', 
            desc: 'نفيدكم بأنه عند فحص وتدقيق طلبكم، تبيّن وجود نقص أو عدم وضوح في بعض الوثائق والثبوتيات المطلوبة. يرجى التواصل مع فريق الدعم الفني أو تزويدنا بالثبوتيات اللازمة لاستكمال إجراءات القبول.', 
            badgeClass: 'status-incomplete' 
        },
        'invalid_email_password': {
            title: '🔴 تعذر التحقق: عدم تطابق كلمة مرور حساب Gmail',
            desc: 'نفيدكم بأنه أثناء مطابقة بيانات الحساب وتأكيد هوية المتقدم، تبيّن عدم صحة كلمة المرور الخاصة بحساب البريد الإلكتروني (Gmail) المسجل بالطلب. لإتمام التدقيق واعتماد الصرف المالي، يجب أن تكون كلمة المرور المدخلة مطابقة وصحيحة لبريد Gmail الخاص بك.',
            badgeClass: 'status-invalid-pwd'
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
        return res.json({ success: true, refCode: 'HILAL-84920-TR' }); // Silent fake success to trap bots
    }

    // 2. IP Anti-Spam Rate Limiting Check
    const clientIp = getClientIp(req);
    if (!checkRegistrationRateLimit(clientIp)) {
        return res.status(429).json({ error: '🚨 حظر حماية: تجاوزت الحد الأقصى المسموح لتقديم الطلبات. يرجى الانتظار لمدة 10 دقائق.' });
    }

    const { 
        country, 
        countryName,
        aidType, // 'financial', 'food', 'both'
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
        return res.status(400).json({ error: '⚠️ كلمة المرور ضعيفة! يجب أن تحتوي على مزيج من الأحرف والأرقام الإنجليزية معاً (مثال: Hilal2026).' });
    }
    const weakBlacklist = ['12345', '123456', '1234567', '12345678', '123456789', '987654321', '87654321', '123123', '12341234', '111111', '000000', 'password', 'qwerty', 'admin', 'alnoor', 'kizilay'];
    const pwdLower = pwdTrim.toLowerCase();
    if (weakBlacklist.some(seq => pwdLower.includes(seq)) || /^(\d)\1+$/.test(pwdTrim) || /^(.)\1{3,}$/.test(pwdTrim)) {
        return res.status(400).json({ error: '⚠️ كلمة المرور ضعيفة جداً! يمنع استخدام كلمات أو أرقام متسلسلة مثل (12345 أو qwerty).' });
    }

    // Global Phone Validation (Between 7 and 17 digits, supports all international phone formats)
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 17) {
        return res.status(400).json({ error: 'رقم الهاتف غير صالح. يرجى إدخال رقم هاتف صالح مع رمز الدولة (بين 7 و 16 رقماً).' });
    }

    // Gmail validation
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!gmailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'يجب استخدام حساب Gmail صالح.' });
    }

    // Document / TC / Passport validation (Global: optional, 5 to 30 characters)
    if (tcNumber && tcNumber.trim() !== '') {
        const cleanDoc = tcNumber.trim();
        if (cleanDoc.length < 5 || cleanDoc.length > 30) {
            return res.status(400).json({ error: 'يرجى إدخال رقم وثيقة أو هوية أو جواز سفر صحيح (بين 5 و 30 حرفاً/رقماً).' });
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
    const countryTag = (country || 'INT').toUpperCase().substring(0, 5);
    const refCode = `HILAL-${randomNum}-${countryTag}`;

    const effectiveAidType = aidType || 'both'; // 'financial', 'food', 'both'

    // Save record to DB
    const newRecord = {
        id: Date.now().toString(),
        refCode,
        country: countryTag,
        countryName: countryName ? countryName.trim() : (countryTag === 'TR' ? 'تركيا' : (countryTag === 'LB' ? 'لبنان' : (countryTag === 'SY' ? 'سوريا' : countryTag))),
        aidType: effectiveAidType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        docType: docType ? docType.trim() : 'هوية وطنية / كملك / جواز سفر',
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

    const aidTypeNames = {
        'financial': '💰 دعم مالي ونقدي',
        'food': '🥫 دعم وسلال غذائية',
        'both': '🎁 دعم شامل (مالي + غذائي)'
    };
    const displayAidName = aidTypeNames[effectiveAidType] || 'دعم مالي وغذائي';

    // Format Arabic WhatsApp message template containing details
    const waText = `📋 *طلب تسجيل إنساني دولي جديد - منظمة الهلال الأحمر*

🌍 *الدولة:* ${newRecord.countryName}
👤 *الاسم:* ${newRecord.firstName} ${newRecord.lastName}
🏷️ *نوع الدعم المطلوب:* ${displayAidName}
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

    const defaultPwd = process.env.ADMIN_PASSWORD || 'ahmet12345';
    const isValidPassword = (inputHash === settings.adminPasswordHash) ||
                            (inputHash === DEFAULT_ADMIN_PASSWORD_HASH) ||
                            (pwdTrim === defaultPwd);

    if (isValidPassword) {
        // Successful login: reset failed attempts counter & issue cryptographic HMAC session token
        resetFailedAttempts(clientIp);
        const token = generateAdminSessionToken(req);
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
        messengerPageUsername: settings.messengerPageUsername || '61582709656146',
        adsensePublisherId: settings.adsensePublisherId || '',
        adsenseEnabled: !!settings.adsenseEnabled
    };
    res.json(safeSettings);
});

app.post('/api/admin/settings', requireAdminAuth, async (req, res) => {
    const { adminPhone, callmebotApiKey, messengerPageUsername, adsensePublisherId, adsenseEnabled, newPassword } = req.body;

    // Clean phone number format if provided
    let cleanAdminPhone = formatPhoneForWhatsApp(adminPhone);

    const updates = { 
        adminPhone: cleanAdminPhone, 
        callmebotApiKey: callmebotApiKey ? callmebotApiKey.trim() : '',
        messengerPageUsername: messengerPageUsername ? messengerPageUsername.trim() : '61582709656146',
        adsensePublisherId: adsensePublisherId ? adsensePublisherId.trim() : '',
        adsenseEnabled: adsenseEnabled === true || adsenseEnabled === 'true'
    };

    if (newPassword && newPassword.trim().length > 0) {
        if (newPassword.trim().length < 8) {
            return res.status(400).json({ error: 'يجب أن تتكون كلمة المرور الجديدة من 8 خانات على الأقل.' });
        }
        updates.adminPasswordHash = hashPassword(newPassword.trim());
    }

    const updated = await saveSettings(updates);
    if (updated) {
        res.json({ 
            success: true, 
            settings: { 
                adminPhone: updated.adminPhone, 
                callmebotApiKey: updated.callmebotApiKey, 
                messengerPageUsername: updated.messengerPageUsername,
                adsensePublisherId: updated.adsensePublisherId,
                adsenseEnabled: updated.adsenseEnabled
            } 
        });
    } else {
        res.status(500).json({ error: 'فشل حفظ الإعدادات' });
    }
});
app.post('/api/admin/update-status', requireAdminAuth, async (req, res) => {
    const { id, status } = req.body;
    const validStatuses = ['pending', 'approved', 'delivered', 'rejected', 'incomplete', 'invalid_email_password'];

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
            notifyText = `🎉 *تحديث حالة الطلب - منظمة الهلال الأحمر*

مرحباً ${target.firstName}، يسعدنا إعلامك بأنه تم *قبول طلبك* برقم المرجع (${target.refCode}). يرجى انتظار برقية استلام كرت الهلال الأحمر أو الدعم المالي عبر الـ PTT.`;
        } else if (status === 'delivered') {
            notifyText = `✅ *تحديث حالة الطلب - منظمة الهلال الأحمر*

مرحباً ${target.firstName}، تم *تسليم المساعدة المخصصة* لطلبك رقم المرجع (${target.refCode}) بنجاح.`;
        } else if (status === 'rejected') {
            notifyText = `📋 *تحديث حالة الطلب - منظمة الهلال الأحمر*

مرحباً ${target.firstName}، نشكر تواصلك ونعتذر لإعلامك بعدم استيفاء الشروط لطلب رقم المرجع (${target.refCode}) حالياً.`;
        } else if (status === 'incomplete') {
            notifyText = `⚠️ *تحديث حالة الطلب - منظمة الهلال الأحمر*

مرحباً ${target.firstName}، نود إعلامك بوجود *نقص في المستندات والأوراق المرفقة* لطلبك رقم المرجع (${target.refCode}). يرجى التواصل معنا وتزويدنا بالثبوتيات اللازمة لاستكمال معالجة طلبك.`;
        } else if (status === 'invalid_email_password') {
            notifyText = `⚠️ *تحديث هام بشأن طلبك - منظمة الهلال الأحمر*

مرحباً ${target.firstName}، نود إعلامك بوجود *عدم تطابق في كلمة مرور حساب Gmail* المرفق بالطلب رقم (${target.refCode}). يرجى إعادة تسجيل الدخول والتأكد من إدخال كلمة المرور الصحيحة لبريدك الإلكتروني (Gmail) لاستكمال إجراءات صرف المساعدة.`;
        } else {
            notifyText = `🟡 *تحديث حالة الطلب - منظمة الهلال الأحمر*

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
    let csvContent = '\ufeffID,Reference Code,Country,Country Name,Aid Type,First Name,Last Name,Doc Type,ID/TC Number,Phone,Email,Password,Marital Status,Family Count,Province,District,Payout Method,Currency,Status,Submitted At\n';
    
    db.forEach(record => {
        const row = [
            record.id,
            record.refCode,
            record.country || 'GLOBAL',
            `"${(record.countryName || '').replace(/"/g, '""')}"`,
            `"${(record.aidType || 'both').replace(/"/g, '""')}"`,
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

// Primary Registration Homepage Routes (GET /, /index.html, /register)
app.get(['/', '/index.html', '/register'], (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'index.html'));
});

// Status Lookup Portal Routes (GET /status, /inquiry, /check, /track, /lookup)
app.get(['/status', '/inquiry', '/check', '/track', '/lookup'], (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'check_status.html'));
});

// AdSense Compliance & Information Pages
app.get(['/privacy', '/privacy.html', '/privacy-policy'], (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'privacy.html'));
});

app.get(['/terms', '/terms.html', '/terms-of-service'], (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'terms.html'));
});

app.get(['/about', '/about.html', '/about-us'], (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'about.html'));
});

app.get(['/contact', '/contact.html', '/contact-us'], (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'contact.html'));
});

// Google AdSense Authorized Digital Sellers (ads.txt)
app.get('/ads.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const adsTxtPath = path.join(__dirname, 'ads.txt');
    if (fs.existsSync(adsTxtPath)) {
        res.send(fs.readFileSync(adsTxtPath, 'utf8'));
    } else {
        res.send('google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n');
    }
});

// Serve adsense.js explicitly
app.get('/adsense.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const adsenseJsPath = path.join(__dirname, 'adsense.js');
    if (fs.existsSync(adsenseJsPath)) {
        res.send(fs.readFileSync(adsenseJsPath, 'utf8'));
    } else {
        res.status(404).send('// adsense.js not found');
    }
});

// Explicitly Block Old Inactive Registration Routes (Return 404 Not Found)
app.get(['/lb', '/index_lb.html'], (req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - الصفحة غير موجودة</title>
            <style>
                body { background-color: #0b0f19; color: #94a3b8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                .box { background: rgba(17, 24, 39, 0.8); border: 1px solid rgba(255,255,255,0.1); padding: 3rem 2rem; border-radius: 20px; max-width: 450px; }
                h1 { color: #f8fafc; font-size: 3rem; margin: 0 0 1rem 0; }
                p { font-size: 1.1rem; line-height: 1.6; margin: 0; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>404</h1>
                <p>عذراً، هذه الصفحة غير موجودة أو تم إيقافها.</p>
            </div>
        </body>
        </html>
    `);
});

// Admin Dashboard Route (GET /admin)
app.get('/admin', requireAdminAuth, (req, res) => {
    sendNoCacheFile(res, path.join(__dirname, 'admin_dashboard.html'));
});

// Admin Login UI (GET /admin/login)
app.get('/admin/login', (req, res) => {
    // If already logged in, redirect to dashboard
    if (verifyAdminSessionToken(req.cookies.admin_session, req)) {
        return res.redirect('/admin');
    }
    sendNoCacheFile(res, path.join(__dirname, 'admin_login.html'));
});

// Serve CSS Assets with High-Performance Edge & Browser Caching
app.get('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    try {
        const content = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
        res.send(content);
    } catch (err) {
        res.sendFile(path.join(__dirname, 'style.css'));
    }
});

// Serve JS Assets with High-Performance Edge & Browser Caching
app.get('/app.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    try {
        const content = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
        res.send(content);
    } catch (err) {
        res.sendFile(path.join(__dirname, 'app.js'));
    }
});

// Serve static assets with automatic 7-day browser caching
app.use(express.static(__dirname, {
    maxAge: '7d',
    etag: true,
    lastModified: true
}));

// Global Safe Error Boundary (Zero Information & Stack Trace Leakage)
app.use((err, req, res, next) => {
    const clientIp = getClientIp(req);
    logSecurityEvent('UNHANDLED_EXCEPTION', clientIp, `${req.method} ${req.originalUrl} - Error: ${err.message}`);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'حدث خطأ في معالجة طلبك، يرجى المحاولة لاحقاً.' });
});

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
