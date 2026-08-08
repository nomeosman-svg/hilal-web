# Project Rules & Pending Plans

## Lebanon Site Messenger Integration Plan (مخطط ربط ماسنجر موقع لبنان)
When the user returns with their Facebook Page username/link for the Lebanon site (`index_lb.html`), proceed with:
1. Adding the Facebook Messenger Page Username setting to `settings.json` and `server.js` (e.g., `messengerPageUsername` or `messengerHelpUrl`).
2. Adding a "تأكيد الطلب عبر فيسبوك ماسنجر" button in `index_lb.html` under `#registrationResult`.
3. Updating `app_lb.js` to dynamically construct `https://m.me/USERNAME?ref=REF_CODE` upon successful registration.
