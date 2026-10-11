const http = require('http');
const https = require('https');
const net = require('net');
const { execSync } = require('child_process');

function checkPort(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1500);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            resolve(false);
        });
        socket.connect(port, host);
    });
}

function checkHttp(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 3000 }, (res) => {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, code: res.statusCode });
        });
        req.on('error', () => resolve({ ok: false, code: null }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, code: 'TIMEOUT' });
        });
    });
}

function isProcessRunning(name) {
    try {
        const out = execSync(`tasklist /fi "imagename eq ${name}"`, { encoding: 'utf8' });
        return out.toLowerCase().includes(name.toLowerCase());
    } catch (e) {
        return false;
    }
}

async function main() {
    console.log('\n========================================================');
    console.log('       🔍 فحص حالة نظام الهلال الأحمر (AlNoor)');
    console.log('========================================================\n');

    const isRunnerActive = await checkPort(3099);
    const isPort3000Open = await checkPort(3000);
    const isCloudflaredRunning = isProcessRunning('cloudflared.exe');

    if (isRunnerActive) {
        console.log(' [OK] 🛡️  خدمة الحماية وإعادة التشغيل (Runner Watchdog): تعمل بنشاط');
    } else {
        console.log(' [!] ⚠️  خدمة الحماية وإعادة التشغيل: غير نشطة (يمكنك تشغيلها من start_server.bat)');
    }

    if (isPort3000Open) {
        const localHttp = await checkHttp('http://127.0.0.1:3000');
        if (localHttp.ok) {
            console.log(` [OK] 🚀 سيرفر الموقع (Node.js Express): يعمل بنجاح (الكود: ${localHttp.code})`);
        } else {
            console.log(' [!] ⚠️  سيرفر الموقع يستمع للمنفذ لكن لم يستجب للطلب');
        }
    } else {
        console.log(' [X] ❌ سيرفر Node.js متوقف (المنفذ 3000 غير مفتوح)');
    }

    if (isCloudflaredRunning) {
        console.log(' [OK] ☁️  نفق Cloudflare Tunnel: يعمل ومتصل بالإنترنت');
    } else {
        console.log(' [X] ❌ نفق Cloudflare Tunnel: متوقف حالياً');
    }

    // Check Online Domain
    console.log('\nجاري فحص الاتصال بالدومين العالمي...');
    const onlineHttp = await checkHttp('https://arabredcrescent.org');
    if (onlineHttp.ok) {
        console.log(` [OK] 🌐 الدومين العالمي أونلاين: يعمل بكفاءة 100% (الكود: ${onlineHttp.code})`);
    } else {
        console.log(' [X] ⚠️  تعذر الوصول للدومين العالمي حالياً (تأكد من اتصال الإنترنت)');
    }

    console.log('\n========================================================');
    console.log('📌 الروابط السريعة:');
    console.log(' • الموقع (أونلاين):  https://arabredcrescent.org');
    console.log(' • لوحة التحكم:       https://arabredcrescent.org/admin');
    console.log(' • محلياً على الجهاز: http://localhost:3000');
    console.log('========================================================\n');
}

main();
