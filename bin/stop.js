const { execSync } = require('child_process');

console.log('\n========================================================');
console.log('       🛑 جاري إيقاف جميع خدمات الهلال الأحمر...');
console.log('========================================================\n');

try {
    execSync('taskkill /f /im cloudflared.exe', { stdio: 'ignore' });
    console.log(' [OK] تم إيقاف نفق Cloudflare');
} catch (e) {}

// Kill processes matching runner.js or server.js
try {
    const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*runner.js*' -or $_.CommandLine -like '*server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host (' [OK] تم إيقاف Node عملية ID: ' + $_.ProcessId) }"`;
    const res = execSync(psCmd, { encoding: 'utf8' });
    if (res.trim()) console.log(res.trim());
} catch (e) {}

console.log('\n========================================================');
console.log('   ✅ تم إيقاف الخادم والنفق بنجاح.');
console.log('========================================================\n');
