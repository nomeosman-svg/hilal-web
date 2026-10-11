const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const PROJECT_DIR = __dirname;
const LOG_DIR = path.join(PROJECT_DIR, 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 1. Single-Instance Lock Mechanism (Port 3099)
const LOCK_PORT = 3099;
const lockServer = net.createServer();

lockServer.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`[${new Date().toISOString()}] Runner is already active in background. Exiting duplicate instance.`);
        process.exit(0);
    } else {
        console.error('Lock error:', err);
        process.exit(1);
    }
});

lockServer.listen(LOCK_PORT, '127.0.0.1', () => {
    console.log(`[${new Date().toISOString()}] Single-instance lock acquired on port ${LOCK_PORT}.`);
    startAllServices();
});

// 2. Logging helpers with size limits
function getLogStream(filename) {
    const filePath = path.join(LOG_DIR, filename);
    try {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            // If log file exceeds 5MB, rotate it
            if (stats.size > 5 * 1024 * 1024) {
                const backupPath = path.join(LOG_DIR, filename + '.old');
                if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
                fs.renameSync(filePath, backupPath);
            }
        }
    } catch (e) {}
    return fs.createWriteStream(filePath, { flags: 'a' });
}

let serverLog = getLogStream('server.log');
let tunnelLog = getLogStream('tunnel.log');
let runnerLog = getLogStream('runner.log');

function logRunner(msg) {
    const text = `[${new Date().toISOString()}] ${msg}\n`;
    try {
        runnerLog.write(text);
        process.stdout.write(text);
    } catch (e) {}
}

const CLOUDFLARED_BIN = path.join(PROJECT_DIR, 'bin', 'cloudflared.exe');
const TUNNEL_ID = '3889ced8-bd11-4ff0-bb56-2f4900e0c9d6';

let serverProc = null;
let tunnelProc = null;
let isShuttingDown = false;

// 3. Node.js Server Watchdog
function startServer() {
    if (isShuttingDown) return;
    logRunner('Starting Node.js server (server.js)...');

    serverProc = spawn(process.execPath, [path.join(PROJECT_DIR, 'server.js')], {
        cwd: PROJECT_DIR,
        env: { ...process.env, PORT: '3000' },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProc.stdout.pipe(serverLog);
    serverProc.stderr.pipe(serverLog);

    serverProc.on('exit', (code, signal) => {
        logRunner(`Server process exited (code=${code}, signal=${signal}). Respawning in 3 seconds...`);
        serverProc = null;
        if (!isShuttingDown) {
            setTimeout(startServer, 3000);
        }
    });

    serverProc.on('error', (err) => {
        logRunner(`Failed to start server: ${err.message}`);
    });
}

// 4. Cloudflare Tunnel Watchdog
function startTunnel() {
    if (isShuttingDown) return;
    if (!fs.existsSync(CLOUDFLARED_BIN)) {
        logRunner(`ERROR: cloudflared.exe not found at ${CLOUDFLARED_BIN}`);
        return;
    }

    logRunner(`Starting Cloudflare Tunnel (${TUNNEL_ID})...`);

    tunnelProc = spawn(CLOUDFLARED_BIN, ['tunnel', 'run', TUNNEL_ID], {
        cwd: PROJECT_DIR,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    tunnelProc.stdout.pipe(tunnelLog);
    tunnelProc.stderr.pipe(tunnelLog);

    tunnelProc.on('exit', (code, signal) => {
        logRunner(`Tunnel process exited (code=${code}, signal=${signal}). Respawning in 5 seconds...`);
        tunnelProc = null;
        if (!isShuttingDown) {
            setTimeout(startTunnel, 5000);
        }
    });

    tunnelProc.on('error', (err) => {
        logRunner(`Failed to start tunnel: ${err.message}`);
    });
}

function startAllServices() {
    startServer();
    // Allow server 2 seconds to bind port 3000 before tunnel connects
    setTimeout(startTunnel, 2000);
}

// 5. Graceful Cleanup
function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logRunner('Shutting down runner and terminating child processes...');

    if (serverProc) {
        try { serverProc.kill('SIGTERM'); } catch (e) {}
    }
    if (tunnelProc) {
        try { tunnelProc.kill('SIGTERM'); } catch (e) {}
    }

    setTimeout(() => {
        logRunner('Shutdown complete.');
        process.exit(0);
    }, 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
