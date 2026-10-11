/**
 * Google AdSense & Monetization Management Engine 2026
 * Al-Hilal Red Crescent Humanitarian Assistance Portal
 * Complete stealth & clean hiding when AdSense is inactive.
 * Automatically loads official Google AdSense units once activated.
 */

(function () {
    'use strict';

    // Global AdSense Settings (Controlled via Admin Dashboard and settings.json)
    window.ADSENSE_CONFIG = window.ADSENSE_CONFIG || {
        publisherId: '', // Example: 'ca-pub-1234567890123456'
        enabled: false,
        autoAds: false
    };

    // Helper: Initialize real Google AdSense SDK script
    function loadGoogleAdSenseScript(publisherId) {
        if (!publisherId || document.getElementById('google-adsense-script')) return;
        const script = document.createElement('script');
        script.id = 'google-adsense-script';
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
        console.log('✅ [AdSense] Google AdSense SDK loaded for client:', publisherId);
    }

    // Helper: Render Live Ad Unit into container
    function renderLiveAdSlot(container) {
        const slotType = container.getAttribute('data-ad-type') || 'leaderboard';
        const adSlotId = container.getAttribute('data-ad-slot') || '';
        const publisherId = window.ADSENSE_CONFIG.publisherId;

        if (!publisherId) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = '';
        container.innerHTML = `
            <div class="adsense-label-bar">
                <span><i class="fa-solid fa-rectangle-ad"></i> إعلان تجاري</span>
                <a href="https://support.google.com/adsense/answer/163837" target="_blank" rel="noopener">خيارات الإعلان</a>
            </div>
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="${publisherId}"
                 data-ad-slot="${adSlotId}"
                 data-ad-format="${slotType === 'rectangle' ? 'rectangle' : 'auto'}"
                 data-full-width-responsive="true"></ins>
        `;

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.warn('[AdSense] Push unit error:', e);
        }
    }

    // Helper: Initialize Sticky Anchor Banner (only when active)
    function initStickyAnchorAd() {
        if (!window.ADSENSE_CONFIG.enabled || !window.ADSENSE_CONFIG.publisherId) return;
        if (document.getElementById('adsenseStickyAnchor')) return;

        const anchor = document.createElement('div');
        anchor.id = 'adsenseStickyAnchor';
        anchor.className = 'adsense-sticky-anchor';
        anchor.innerHTML = `
            <div class="sticky-anchor-header">
                <span class="sticky-tag"><i class="fa-solid fa-shield-halved"></i> مساحة إعلانية معتمدة • Google AdSense</span>
                <button type="button" class="sticky-close-btn" id="closeStickyAdBtn" title="تصغير الإعلان">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="sticky-anchor-body" id="stickyAnchorBody">
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="${window.ADSENSE_CONFIG.publisherId}"
                     data-ad-slot="9999"
                     data-ad-format="horizontal"
                     data-full-width-responsive="true"></ins>
            </div>
        `;

        document.body.appendChild(anchor);

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            // ignore
        }

        const closeBtn = document.getElementById('closeStickyAdBtn');
        const body = document.getElementById('stickyAnchorBody');
        let isMinimized = false;

        if (closeBtn && body) {
            closeBtn.addEventListener('click', function () {
                isMinimized = !isMinimized;
                if (isMinimized) {
                    body.style.display = 'none';
                    closeBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
                    anchor.classList.add('minimized');
                } else {
                    body.style.display = 'block';
                    closeBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
                    anchor.classList.remove('minimized');
                }
            });
        }
    }

    // Completely Hide All Ad Units & Wrappers (No empty gaps, no borders)
    function hideAllAdSlots() {
        document.body.classList.remove('ads-active');
        
        const slots = document.querySelectorAll('.adsense-slot-container');
        slots.forEach(slot => {
            slot.style.display = 'none';
            slot.innerHTML = '';
        });

        const wrappers = document.querySelectorAll('.ads-container-wrapper, #adsenseMultiplexWrapper');
        wrappers.forEach(w => {
            w.style.display = 'none';
        });

        const anchor = document.getElementById('adsenseStickyAnchor');
        if (anchor) {
            anchor.remove();
        }
    }

    // Activate All Live Ad Units
    function activateAllAdSlots() {
        document.body.classList.add('ads-active');

        const wrappers = document.querySelectorAll('.ads-container-wrapper, #adsenseMultiplexWrapper');
        wrappers.forEach(w => {
            w.style.display = '';
        });

        const slots = document.querySelectorAll('.adsense-slot-container');
        slots.forEach(slot => {
            renderLiveAdSlot(slot);
        });

        initStickyAnchorAd();
    }

    // Evaluate state and toggle
    function updateAdState() {
        const isLive = !!(window.ADSENSE_CONFIG.enabled && window.ADSENSE_CONFIG.publisherId && window.ADSENSE_CONFIG.publisherId.trim());
        if (isLive) {
            loadGoogleAdSenseScript(window.ADSENSE_CONFIG.publisherId.trim());
            activateAllAdSlots();
        } else {
            hideAllAdSlots();
        }
    }

    // Initialize Engine
    function initEngine() {
        // Hide immediately on first run
        hideAllAdSlots();

        // Check settings from server
        fetch('/api/public-settings')
            .then(res => res.json())
            .then(data => {
                if (data && data.adsenseEnabled && data.adsensePublisherId && data.adsensePublisherId.trim()) {
                    window.ADSENSE_CONFIG.publisherId = data.adsensePublisherId.trim();
                    window.ADSENSE_CONFIG.enabled = true;
                } else {
                    window.ADSENSE_CONFIG.publisherId = '';
                    window.ADSENSE_CONFIG.enabled = false;
                }
                updateAdState();
            })
            .catch(() => {
                hideAllAdSlots();
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEngine);
    } else {
        initEngine();
    }

    // Expose helpers globally
    window.AdSenseEngine = {
        refresh: updateAdState,
        hide: hideAllAdSlots,
        activate: activateAllAdSlots,
        setConfig: function (config) {
            window.ADSENSE_CONFIG = Object.assign(window.ADSENSE_CONFIG, config);
            updateAdState();
        }
    };
})();
