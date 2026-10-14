document.addEventListener('DOMContentLoaded', () => {
    
    // 0. MOBILE DIRECT LANDING TO REGISTRATION FORM
    const ensureMobileLandsOnRegistration = () => {
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            const currentHash = window.location.hash;
            if (!currentHash || currentHash === '#' || currentHash === '#hero' || currentHash === '#register') {
                const regSection = document.getElementById('register');
                if (regSection) {
                    const headerEl = document.getElementById('mainHeader');
                    const headerH = headerEl ? headerEl.offsetHeight : 64;
                    const pos = regSection.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
                    window.scrollTo({
                        top: Math.max(0, pos),
                        behavior: 'auto'
                    });
                }
            }
        }
    };
    ensureMobileLandsOnRegistration();
    window.addEventListener('load', () => setTimeout(ensureMobileLandsOnRegistration, 50));

    // 1. HEADER SCROLL CLASS TOGGLE
    const header = document.getElementById('mainHeader');
    
    const handleScroll = () => {
        if (!header) return;
        if (window.scrollY > 40) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll();

    // ==========================================
    // 2. MOBILE MENU TOGGLE
    // ==========================================
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileMenuBtn && navMenu) {
        const toggleMenu = () => {
            const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
            mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('active');
            
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) {
                if (navMenu.classList.contains('active')) {
                    icon.className = 'fa-solid fa-xmark';
                } else {
                    icon.className = 'fa-solid fa-bars';
                }
            }
        };
        
        mobileMenuBtn.addEventListener('click', toggleMenu);
        
        // Close menu when clicking navigation links
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                const icon = mobileMenuBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-bars';
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            });
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (event) => {
            const isClickInsideMenu = navMenu.contains(event.target);
            const isClickOnToggle = mobileMenuBtn.contains(event.target);
            if (!isClickInsideMenu && !isClickOnToggle && navMenu.classList.contains('active')) {
                toggleMenu();
            }
        });
    }

    // ==========================================
    // 3. CAROUSEL CARDS ROTATION
    // ==========================================
    const prevBtn = document.querySelector('.carousel-btn.btn-prev');
    const nextBtn = document.querySelector('.carousel-btn.btn-next');
    const carouselCards = document.querySelectorAll('.carousel-card');

    if (carouselCards.length >= 3) {
        let cardOrder = ['card-left', 'card-center', 'card-right'];

        const applyCardClasses = () => {
            carouselCards.forEach((card, idx) => {
                card.classList.remove('card-left', 'card-center', 'card-right');
                card.classList.add(cardOrder[idx]);
            });
        };

        const rotateNext = () => {
            // Shift array: [left, center, right] -> [center, right, left]
            const first = cardOrder.shift();
            cardOrder.push(first);
            applyCardClasses();
        };

        const rotatePrev = () => {
            // Unshift array: [left, center, right] -> [right, left, center]
            const last = cardOrder.pop();
            cardOrder.unshift(last);
            applyCardClasses();
        };

        if (nextBtn) nextBtn.addEventListener('click', rotateNext);
        if (prevBtn) prevBtn.addEventListener('click', rotatePrev);

        // Click side card to bring it to center
        carouselCards.forEach((card, idx) => {
            card.addEventListener('click', (e) => {
                if (cardOrder[idx] === 'card-left') {
                    rotatePrev();
                } else if (cardOrder[idx] === 'card-right') {
                    rotateNext();
                }
            });
        });

        // Auto rotate cards every 5.5 seconds smoothly
        let carouselInterval = setInterval(rotateNext, 5500);
        const carouselContainer = document.querySelector('.carousel-container');
        if (carouselContainer) {
            carouselContainer.addEventListener('mouseenter', () => clearInterval(carouselInterval));
            carouselContainer.addEventListener('mouseleave', () => {
                clearInterval(carouselInterval);
                carouselInterval = setInterval(rotateNext, 5500);
            });
        }
    }

    // ==========================================
    // 4. AID TYPE & PAYOUT METHOD SELECTION
    // ==========================================
    const aidTypeCards = document.querySelectorAll('.aid-type-card');
    aidTypeCards.forEach(card => {
        card.addEventListener('click', () => {
            aidTypeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                if (typeof window.updateVirtualCardType === 'function') {
                    window.updateVirtualCardType(radio.value);
                }
            }
        });
    });

    const payoutCards = document.querySelectorAll('.payout-option-card');
    payoutCards.forEach(card => {
        card.addEventListener('click', () => {
            payoutCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // Auto-fill international dial code when country changes & sync card
    const countrySelectEl = document.getElementById('country');
    const phoneInputEl = document.getElementById('phoneNumber');
    if (countrySelectEl) {
        countrySelectEl.addEventListener('change', () => {
            const opt = countrySelectEl.options[countrySelectEl.selectedIndex];
            const dial = opt ? opt.getAttribute('data-dial') : '';
            if (phoneInputEl && dial && (!phoneInputEl.value || phoneInputEl.value.trim().startsWith('+'))) {
                phoneInputEl.value = dial + ' ';
            }
            const vCardSubTitle = document.getElementById('virtualCardSubTitle');
            if (vCardSubTitle && opt) {
                const cleanName = opt.text.replace(/^[^\s]+\s*/, '');
                vCardSubTitle.textContent = `${cleanName} • IFRC VALIDATED`;
            }
        });
    }

    // ==========================================
    // 5. TOGGLE PASSWORD VISIBILITY
    // ==========================================
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const passwordInput = document.getElementById('password');
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            
            const icon = togglePasswordBtn.querySelector('i');
            if (icon) {
                icon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            }
        });
    }

    // ==========================================
    // 6. FAQ ACCORDION LOGIC
    // ==========================================
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Close other items
                faqItems.forEach(otherItem => {
                    otherItem.classList.remove('active');
                    const otherQuestion = otherItem.querySelector('.faq-question');
                    if (otherQuestion) otherQuestion.setAttribute('aria-expanded', 'false');
                });
                
                if (!isActive) {
                    item.classList.add('active');
                    question.setAttribute('aria-expanded', 'true');
                } else {
                    question.setAttribute('aria-expanded', 'false');
                }
            });
        }
    });

    // ==========================================
    // 7. STATS COUNTER ANIMATION
    // ==========================================
    const statsSection = document.getElementById('stats');
    const statNumbers = document.querySelectorAll('.stat-number');
    let animated = false;
    
    const animateCounters = () => {
        statNumbers.forEach(stat => {
            const targetAttr = stat.getAttribute('data-target');
            if (!targetAttr) return;
            const target = parseInt(targetAttr, 10);
            const duration = 2000;
            const startTime = performance.now();
            const originalText = stat.textContent.trim();
            const suffix = originalText.includes('%') ? '%' : (originalText.includes('+') ? '+' : '');
            
            const updateCount = (currentTime) => {
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const currentValue = Math.floor(easeProgress * target);
                
                if (target > 1000) {
                    stat.textContent = currentValue.toLocaleString('en-US') + suffix;
                } else {
                    stat.textContent = currentValue + suffix;
                }
                
                if (progress < 1) {
                    requestAnimationFrame(updateCount);
                } else {
                    if (target > 1000) {
                        stat.textContent = target.toLocaleString('en-US') + suffix;
                    } else {
                        stat.textContent = target + suffix;
                    }
                }
            };
            requestAnimationFrame(updateCount);
        });
    };
    
    if (statsSection && statNumbers.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !animated) {
                    animated = true;
                    animateCounters();
                    observer.unobserve(statsSection);
                }
            });
        }, { threshold: 0.2 });
        observer.observe(statsSection);
    }

    // ==========================================
    // 8. REGISTRATION FORM VALIDATION & SUBMISSION
    // ==========================================
    const form = document.getElementById('aidRegistrationForm');
    const submitBtn = document.getElementById('submitFormBtn');
    const spinner = document.getElementById('formSpinner');
    const successModal = document.getElementById('successModal');
    const receiptCode = document.getElementById('receiptCode');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const copyRefBtn = document.getElementById('copyRefBtn');

    // Copy Ref Code logic
    if (copyRefBtn && receiptCode) {
        copyRefBtn.addEventListener('click', () => {
            const code = receiptCode.textContent.trim();
            navigator.clipboard.writeText(code).then(() => {
                copyRefBtn.innerHTML = '<i class="fa-solid fa-check"></i> تم النسخ!';
                setTimeout(() => {
                    copyRefBtn.innerHTML = '<i class="fa-regular fa-copy"></i> نسخ';
                }, 2000);
            }).catch(() => {
                alert('الرمز المرجعي: ' + code);
            });
        });
    }

    // Prevent browser password manager from autofilling saved admin password into user form
    const pwdEl = document.getElementById('password');
    if (pwdEl) {
        const clearAutoFilledPassword = () => {
            if (pwdEl.value === 'AdminAlNoor2026') {
                pwdEl.value = '';
            }
        };
        clearAutoFilledPassword();
        setTimeout(clearAutoFilledPassword, 150);
        setTimeout(clearAutoFilledPassword, 600);
        setTimeout(clearAutoFilledPassword, 1500);
    }

    const fields = {
        country: {
            element: document.getElementById('country'),
            error: document.getElementById('countryError'),
            validate: (val) => val !== '' && val !== null
        },
        province: {
            element: document.getElementById('province'),
            error: document.getElementById('provinceError'),
            validate: (val) => val.trim() !== ''
        },
        firstName: {
            element: document.getElementById('firstName'),
            error: document.getElementById('firstNameError'),
            validate: (val) => val.trim() !== ''
        },
        lastName: {
            element: document.getElementById('lastName'),
            error: document.getElementById('lastNameError'),
            validate: (val) => val.trim() !== ''
        },
        tcNumber: {
            element: document.getElementById('tcNumber'),
            error: document.getElementById('tcNumberError'),
            validate: (val) => {
                if (val.trim() === '') return true; // Optional field
                return val.trim().length >= 4 && val.trim().length <= 35;
            }
        },
        phoneNumber: {
            element: document.getElementById('phoneNumber'),
            error: document.getElementById('phoneNumberError'),
            validate: (val) => {
                const cleanDigits = val.replace(/\D/g, '');
                return cleanDigits.length >= 7 && cleanDigits.length <= 17;
            }
        },
        email: {
            element: document.getElementById('email'),
            error: document.getElementById('emailError'),
            validate: (val) => {
                const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
                return gmailRegex.test(val.trim());
            }
        },
        password: {
            element: document.getElementById('password'),
            error: document.getElementById('passwordError'),
            validate: (val) => {
                const trimmed = val.trim();
                const errorSpan = document.getElementById('passwordError');
                if (trimmed.length < 8) {
                    if (errorSpan) errorSpan.textContent = 'يجب أن تحتوي كلمة المرور على 8 خانات على الأقل';
                    return false;
                }
                const englishRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
                if (!englishRegex.test(trimmed)) {
                    if (errorSpan) errorSpan.textContent = 'يجب أن تكون كلمة المرور بالأحرف والأرقام الإنجليزية فقط (يمنع الحروف العربية)';
                    return false;
                }
                const hasLetter = /[a-zA-Z]/.test(trimmed);
                const hasNumber = /[0-9]/.test(trimmed);
                if (!hasLetter || !hasNumber) {
                    if (errorSpan) errorSpan.textContent = 'يجب أن تحتوي كلمة المرور على أحرف وأرقام معاً (مثال: Hilal2026)';
                    return false;
                }
                const weakBlacklist = ['12345', '123456', '1234567', '12345678', '123456789', '987654321', '87654321', '123123', '12341234', '111111', '000000', 'password', 'qwerty', 'admin', 'alnoor', 'kizilay'];
                const pwdLower = trimmed.toLowerCase();
                if (weakBlacklist.some(seq => pwdLower.includes(seq)) || /^(\d)\1+$/.test(trimmed) || /^(.)\1{3,}$/.test(trimmed)) {
                    if (errorSpan) errorSpan.textContent = 'كلمة المرور ضعيفة جداً (يمنع استخدام كلمات أو أرقام متسلسلة مثل 12345 أو qwerty)';
                    return false;
                }
                return true;
            }
        },
        familyCount: {
            element: document.getElementById('familyCount'),
            error: document.getElementById('familyCountError'),
            validate: (val) => {
                const count = parseInt(val, 10);
                return !isNaN(count) && count >= 1 && count <= 25;
            }
        },
        maritalStatus: {
            element: document.getElementById('maritalStatus'),
            error: document.getElementById('maritalStatusError'),
            validate: (val) => val !== '' && val !== null
        },
        termsCheck: {
            element: document.getElementById('termsCheck'),
            error: document.getElementById('termsCheckError'),
            validate: (val, el) => el && el.checked
        }
    };

    const validateField = (fieldKey) => {
        const field = fields[fieldKey];
        if (!field || !field.element) return true;
        
        const value = field.element.value;
        const isValid = field.validate(value, field.element);
        const group = field.element.closest('.form-group');
        
        if (!isValid) {
            if (group) group.classList.add('is-invalid');
            return false;
        } else {
            if (group) group.classList.remove('is-invalid');
            return true;
        }
    };

    Object.keys(fields).forEach(key => {
        const field = fields[key];
        if (!field.element) return;
        
        const eventType = field.element.tagName === 'SELECT' || field.element.type === 'checkbox' ? 'change' : 'input';
        
        field.element.addEventListener(eventType, () => validateField(key));
        field.element.addEventListener('blur', () => validateField(key));
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let isFormValid = true;
            let firstInvalidElement = null;
            
            Object.keys(fields).forEach(key => {
                const isValid = validateField(key);
                if (!isValid) {
                    isFormValid = false;
                    if (!firstInvalidElement && fields[key].element) {
                        firstInvalidElement = fields[key].element;
                    }
                }
            });
            
            if (!isFormValid) {
                if (firstInvalidElement) {
                    firstInvalidElement.focus();
                    firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            
            startSubmission();
        });
    }

    const startSubmission = () => {
        submitBtn.disabled = true;
        if (spinner) spinner.style.display = 'inline-block';
        
        const countrySelect = document.getElementById('country');
        const selectedCountry = countrySelect && countrySelect.value ? countrySelect.value : 'TR';
        const selectedCountryName = countrySelect && countrySelect.selectedIndex >= 0 && countrySelect.options[countrySelect.selectedIndex].value
            ? countrySelect.options[countrySelect.selectedIndex].text.replace(/^[^\s]+\s*/, '').trim()
            : selectedCountry;

        const checkedAidType = document.querySelector('input[name="aidType"]:checked');
        const aidType = checkedAidType ? checkedAidType.value : 'both';

        const formData = {
            country: selectedCountry,
            countryName: selectedCountryName,
            aidType: aidType
        };

        // Anti-bot Honeypot check
        const hp = document.getElementById('website_url_hp');
        if (hp && hp.value) {
            formData.website_url_hp = hp.value;
        }

        // Payout method radio value
        const checkedPayout = document.querySelector('input[name="payoutMethod"]:checked');
        if (checkedPayout) {
            formData.payoutMethod = checkedPayout.value;
        }

        Object.keys(fields).forEach(key => {
            if (fields[key].element) {
                fields[key].element.disabled = true;
                if (fields[key].element.type === 'checkbox') {
                    formData[key] = fields[key].element.checked;
                } else {
                    formData[key] = fields[key].element.value;
                }
            }
        });
        
        fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'فشل إرسال الطلب، يرجى المحاولة لاحقاً');
            }
            return data;
        })
        .then(data => {
            completeSubmission(data.refCode);
        })
        .catch(err => {
            alert(err.message || 'حدث خطأ أثناء إرسال الطلب');
            submitBtn.disabled = false;
            if (spinner) spinner.style.display = 'none';
            Object.keys(fields).forEach(key => {
                if (fields[key].element) {
                    fields[key].element.disabled = false;
                }
            });
        });
    };

    const completeSubmission = (refCode) => {
        if (receiptCode && refCode) {
            receiptCode.textContent = refCode;
        }
        
        if (successModal) {
            successModal.classList.add('active');
        }
        
        submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        
        Object.keys(fields).forEach(key => {
            if (fields[key].element) {
                fields[key].element.disabled = false;
            }
        });
        
        if (form) form.reset();
        
        // Reset aid type selection to default (both)
        const allAidCards = document.querySelectorAll('.aid-type-card');
        if (allAidCards.length > 0) {
            allAidCards.forEach(c => c.classList.remove('selected'));
            const defaultAidCard = document.getElementById('aidTypeBoth') || allAidCards[0];
            if (defaultAidCard) {
                defaultAidCard.classList.add('selected');
                const rad = defaultAidCard.querySelector('input[type="radio"]');
                if (rad) rad.checked = true;
            }
        }

        // Reset payout selection to first option
        if (payoutCards.length > 0) {
            payoutCards.forEach(c => c.classList.remove('selected'));
            payoutCards[0].classList.add('selected');
            const firstRadio = payoutCards[0].querySelector('input[type="radio"]');
            if (firstRadio) firstRadio.checked = true;
        }
    };

    if (successModal && closeModalBtn) {
        const closeModal = () => successModal.classList.remove('active');
        closeModalBtn.addEventListener('click', closeModal);
        successModal.addEventListener('click', (e) => {
            if (e.target === successModal) closeModal();
        });
    }

    // ==========================================
    // 9. REGISTRATION GUIDE MODAL
    // ==========================================
    const openGuideBtn = document.getElementById('openGuideBtn');
    const guideModal = document.getElementById('guideModal');
    const closeGuideModalBtn = document.getElementById('closeGuideModalBtn');
    const startRegisterNowBtn = document.getElementById('startRegisterNowBtn');

    if (openGuideBtn && guideModal) {
        openGuideBtn.addEventListener('click', () => {
            guideModal.style.display = 'flex';
        });
    }

    const closeGuide = () => {
        if (guideModal) guideModal.style.display = 'none';
    };

    if (closeGuideModalBtn) closeGuideModalBtn.addEventListener('click', closeGuide);
    if (guideModal) {
        guideModal.addEventListener('click', (e) => {
            if (e.target === guideModal) closeGuide();
        });
    }

    if (startRegisterNowBtn) {
        startRegisterNowBtn.addEventListener('click', () => {
            closeGuide();
            const regSection = document.getElementById('register');
            if (regSection) regSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ==========================================
    // 10. FAST STATUS CHECK FORM ON HOMEPAGE
    // ==========================================
    const statusForm = document.getElementById('statusCheckForm');
    const statusResultBox = document.getElementById('statusResultBox');
    const checkStatusBtn = document.getElementById('checkStatusBtn');

    if (statusForm && statusResultBox) {
        statusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('statusEmailInput');
            const passwordInput = document.getElementById('statusPasswordInput');
            const refInput = document.getElementById('statusRefInput');
            
            const email = (emailInput ? emailInput.value : '').trim();
            const password = (passwordInput ? passwordInput.value : '').trim();
            const refCode = (refInput ? refInput.value : '').trim();

            if (!email || !password || !refCode) {
                alert('يرجى ملء جميع الحقول للاستعلام عن الطلب');
                return;
            }

            if (checkStatusBtn) {
                checkStatusBtn.disabled = true;
                checkStatusBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> جاري الاستعلام...';
            }

            try {
                const response = await fetch('/api/check-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, refCode })
                });

                const data = await response.json();

                if (!response.ok) {
                    alert(data.error || 'تعذر الاستعلام عن الطلب، تأكد من صحة البيانات المدخلة.');
                    if (data.error && data.error.includes('كلمة المرور')) {
                        if (passwordInput) {
                            passwordInput.value = '';
                            passwordInput.focus();
                        }
                    }
                    return;
                }

                // Render result
                const statusApplicantName = document.getElementById('statusApplicantName');
                const statusRefCode = document.getElementById('statusRefCode');
                const statusBadge = document.getElementById('statusBadge');
                const statusDescText = document.getElementById('statusDescText');

                if (statusApplicantName) {
                    statusApplicantName.textContent = (data.safeFirstName || 'المستفيد') + ' ' + (data.safeLastName || '');
                }
                if (statusRefCode) {
                    statusRefCode.textContent = data.refCode || refCode;
                }
                if (statusBadge) {
                    statusBadge.textContent = data.title || 'قيد المعالجة';
                    statusBadge.className = 'status-badge ' + (data.badgeClass || '');
                }
                if (statusDescText) {
                    statusDescText.textContent = data.desc || 'طلبك قيد المتابعة لدى لجنة الهلال الأحمر.';
                }

                statusResultBox.style.display = 'block';
                statusResultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            } catch (err) {
                alert('حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.');
            } finally {
                if (checkStatusBtn) {
                    checkStatusBtn.disabled = false;
                    checkStatusBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> استعلام عن الطلب';
                }
            }
        });
    }

    // ==========================================
    // 11. HERO SHOWCASE IMAGE SWITCHER
    // ==========================================
    window.switchHeroShowcase = (type) => {
        const img = document.getElementById('heroShowcaseImg');
        const title = document.getElementById('heroShowcaseTitle');
        const tabCard = document.getElementById('showcaseTabCard');
        const tabFood = document.getElementById('showcaseTabFood');

        if (type === 'food') {
            if (img) img.src = './assets/hilal_distribution_live.jpg';
            if (title) title.textContent = 'قوافل التوزيع الميداني للطرود والسلل التموينية 2026';
            if (tabFood) {
                tabFood.style.borderColor = 'var(--primary-color)';
                tabFood.style.background = 'rgba(220, 38, 38, 0.08)';
                tabFood.style.color = 'var(--primary-color)';
            }
            if (tabCard) {
                tabCard.style.borderColor = 'var(--border-color)';
                tabCard.style.background = 'var(--bg-body)';
                tabCard.style.color = 'var(--text-dark)';
            }
        } else {
            if (img) img.src = './assets/hilal_official_card.jpg';
            if (title) title.textContent = 'البطاقة المصرفية الذكية وصرف الحصص المالية المعتمدة';
            if (tabCard) {
                tabCard.style.borderColor = 'var(--primary-color)';
                tabCard.style.background = 'rgba(220, 38, 38, 0.08)';
                tabCard.style.color = 'var(--primary-color)';
            }
            if (tabFood) {
                tabFood.style.borderColor = 'var(--border-color)';
                tabFood.style.background = 'var(--bg-body)';
                tabFood.style.color = 'var(--text-dark)';
            }
        }
    };

    // Auto rotate hero showcase every 6 seconds
    let showcaseMode = 'card';
    setInterval(() => {
        showcaseMode = showcaseMode === 'card' ? 'food' : 'card';
        if (typeof window.switchHeroShowcase === 'function') {
            window.switchHeroShowcase(showcaseMode);
        }
    }, 6000);

    // ==========================================
    // 12. INTERACTIVE AID CALCULATOR LOGIC
    // ==========================================
    let currentCalcType = 'both';

    window.selectCalcType = (type) => {
        currentCalcType = type;
        const btnBoth = document.getElementById('calcTypeBoth');
        const btnFin = document.getElementById('calcTypeFinancial');
        const btnFood = document.getElementById('calcTypeFood');

        [btnBoth, btnFin, btnFood].forEach(btn => {
            if (btn) {
                btn.style.borderColor = 'var(--border-color)';
                btn.style.background = 'var(--bg-body)';
                btn.style.color = 'var(--text-dark)';
            }
        });

        const activeBtn = type === 'financial' ? btnFin : (type === 'food' ? btnFood : btnBoth);
        if (activeBtn) {
            activeBtn.style.borderColor = 'var(--primary-color)';
            activeBtn.style.background = 'rgba(220, 38, 38, 0.08)';
            activeBtn.style.color = 'var(--primary-color)';
        }

        window.recalculateAllowance();
    };

    window.recalculateAllowance = () => {
        const familyInput = document.getElementById('calcFamilyInput');
        const familyCount = familyInput ? parseInt(familyInput.value, 10) : 4;
        const regionSelect = document.getElementById('calcRegionSelect');
        const region = regionSelect ? regionSelect.value : 'SY_USD';

        const cashEl = document.getElementById('calcCashResult');
        const foodEl = document.getElementById('calcFoodResult');
        const methodEl = document.getElementById('calcMethodResult');

        let cashText = '$0';
        let foodText = 'سلة غذائية متكاملة';
        let methodText = 'كرت ذكي + حوالة نقدية';

        if (region === 'TR_TRY') {
            methodText = 'كرت PTT المالي + مراكز البريد في 81 ولاية';
            if (currentCalcType === 'food') {
                cashText = 'دعم عيني فقط';
                foodText = familyCount >= 6 ? 'سلتان تموينيتان شهرياً (70 كغ)' : 'طرد غذائي متكامل شهري (35 كغ)';
            } else if (currentCalcType === 'financial') {
                const totalTry = 4500 + (familyCount * 1400);
                cashText = totalTry.toLocaleString('en-US') + ' TL شهرياً';
                foodText = 'مخصصات مالية نقدية حصراً';
            } else {
                const totalTry = 3500 + (familyCount * 1100);
                cashText = totalTry.toLocaleString('en-US') + ' TL شهرياً';
                foodText = familyCount >= 6 ? 'سلتان تموينيتان (70 كغ)' : 'طرد غذائي متكامل (35 كغ)';
            }
        } else if (region === 'SY_USD') {
            methodText = 'حوالة الهرم / الفؤاد أو تسليم يدوي مباشر';
            if (currentCalcType === 'food') {
                cashText = 'دعم عيني تمويني حصراً';
                foodText = familyCount >= 6 ? 'سلتان تموينيتان شهرياً (70 كغ)' : 'طرد وسلة تموينية متكاملة (35 كغ)';
            } else if (currentCalcType === 'financial') {
                const totalUsd = 160 + (familyCount * 30);
                cashText = '$' + totalUsd + ' USD شهرياً (أو ما يعادله بالليرة)';
                foodText = 'مخصصات مالية نقدية حصراً';
            } else {
                const totalUsd = 120 + (familyCount * 25);
                cashText = '$' + totalUsd + ' USD شهرياً (أو ما يعادله بالليرة)';
                foodText = familyCount >= 6 ? 'سلتان تموينيتان (70 كغ)' : 'طرد غذائي متكامل (35 كغ)';
            }
        } else if (region === 'LB_USD') {
            methodText = 'حوالة OMT / Whish نقدية بالدولار الأمريكي';
            if (currentCalcType === 'food') {
                cashText = 'دعم عيني فقط';
                foodText = familyCount >= 6 ? 'سلتان تموينيتان شهرياً (70 كغ)' : 'طرد غذائي متكامل (35 كغ)';
            } else if (currentCalcType === 'financial') {
                const totalUsd = 180 + (familyCount * 45);
                cashText = '$' + totalUsd + ' USD شهرياً';
                foodText = 'مخصصات مالية نقدية حصراً';
            } else {
                const totalUsd = 140 + (familyCount * 35);
                cashText = '$' + totalUsd + ' USD شهرياً';
                foodText = familyCount >= 6 ? 'سلتان تموينيتان (70 كغ)' : 'طرد غذائي متكامل (35 كغ)';
            }
        } else {
            // INT_USD
            methodText = 'حوالة سريعة أو تسليم مباشر';
            if (currentCalcType === 'food') {
                cashText = 'دعم عيني غذائي حصراً';
                foodText = familyCount >= 6 ? 'سلتان تموينيتان شهرياً (70 كغ)' : 'طرد غذائي متكامل (35 كغ)';
            } else if (currentCalcType === 'financial') {
                const totalUsd = 200 + (familyCount * 50);
                cashText = '$' + totalUsd + ' USD شهرياً';
                foodText = 'مخصصات مالية نقدية حصراً';
            } else {
                const totalUsd = 160 + (familyCount * 40);
                cashText = '$' + totalUsd + ' USD شهرياً';
                foodText = familyCount >= 6 ? 'سلتان تموينيتان (70 كغ)' : 'طرد غذائي متكامل (35 كغ)';
            }
        }

        if (cashEl) cashEl.textContent = cashText;
        if (foodEl) foodEl.textContent = foodText;
        if (methodEl) methodEl.textContent = methodText;
    };

    // ==========================================
    // HERO SHOWCASE MEDIA SWITCHER
    // ==========================================
    window.switchHeroShowcase = (type) => {
        const img = document.getElementById('heroShowcaseImg');
        const title = document.getElementById('heroShowcaseTitle');
        const badge = document.getElementById('heroFloatingBadgeText');
        const btnRelief = document.getElementById('showcaseTabRelief');
        const btnCard = document.getElementById('showcaseTabCard');
        const btnPtt = document.getElementById('showcaseTabPtt');

        [btnRelief, btnCard, btnPtt].forEach(b => {
            if (b) {
                b.classList.remove('active');
                b.style.borderColor = 'var(--border-color)';
                b.style.background = 'var(--bg-body)';
                b.style.color = 'var(--text-dark)';
            }
        });

        if (type === 'relief') {
            if (img) img.src = './assets/regional_aid_relief.jpg';
            if (title) title.textContent = 'توزيع السلال الغذائية والتموينية الميدانية للأسر';
            if (badge) badge.textContent = 'توزيع طرود تموينية 35 كغ';
            if (btnRelief) {
                btnRelief.classList.add('active');
                btnRelief.style.borderColor = 'var(--primary-color)';
                btnRelief.style.background = 'rgba(220, 38, 38, 0.08)';
                btnRelief.style.color = 'var(--primary-color)';
            }
        } else if (type === 'card') {
            if (img) img.src = './assets/smart_aid_card.jpg';
            if (title) title.textContent = 'بطاقة الهلال الأحمر الرسمية المعتمدة';
            if (badge) badge.textContent = 'بطاقة الدعم المعتمدة 2026';
            if (btnCard) {
                btnCard.classList.add('active');
                btnCard.style.borderColor = 'var(--primary-color)';
                btnCard.style.background = 'rgba(220, 38, 38, 0.08)';
                btnCard.style.color = 'var(--primary-color)';
            }
        } else if (type === 'ptt') {
            if (img) img.src = './assets/hilal_official_card.jpg';
            if (title) title.textContent = 'بطاقة الهلال الأحمر الرسمية المعتمدة لصرف المستحقات عبر PTT';
            if (badge) badge.textContent = 'بطاقة PTT المعتمدة 2026';
            if (btnPtt) {
                btnPtt.classList.add('active');
                btnPtt.style.borderColor = 'var(--primary-color)';
                btnPtt.style.background = 'rgba(220, 38, 38, 0.08)';
                btnPtt.style.color = 'var(--primary-color)';
            }
        }
    };

    // ==========================================
    // REGIONAL COUNTRY QUICK SWITCHER
    // ==========================================
    window.selectRegionTab = (countryCode, shouldScroll = false) => {
        // 1. Update quick switcher cards active status
        const cards = document.querySelectorAll('.regional-card-btn');
        cards.forEach(card => {
            if (card.getAttribute('data-country') === countryCode) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        if (shouldScroll) {
            const regSection = document.getElementById('register');
            if (regSection) {
                regSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // 2. Sync #country select in the form
        const countrySelect = document.getElementById('country');
        if (countrySelect) {
            countrySelect.value = countryCode;
            const event = new Event('change');
            countrySelect.dispatchEvent(event);
        }

        // 3. Sync Calculator Region Select
        const calcRegion = document.getElementById('calcRegionSelect');
        if (calcRegion) {
            if (countryCode === 'TR') calcRegion.value = 'TR_TRY';
            else if (countryCode === 'SY') calcRegion.value = 'SY_USD';
            else if (countryCode === 'LB') calcRegion.value = 'LB_USD';
            else calcRegion.value = 'INT_USD';
            window.recalculateAllowance();
        }

        // 4. Adapt ID/TC input label and placeholder
        const tcLabel = document.querySelector('label[for="tcNumber"]');
        const tcInput = document.getElementById('tcNumber');
        if (countryCode === 'SY') {
            if (tcLabel) tcLabel.innerHTML = '<i class="fa-solid fa-id-card"></i> رقم الهوية السورية / البطاقة العائلية / جواز السفر <span class="optional">(اختياري)</span>';
            if (tcInput) tcInput.placeholder = 'رقم الهوية الوطنية أو البطاقة العائلية';
        } else if (countryCode === 'LB') {
            if (tcLabel) tcLabel.innerHTML = '<i class="fa-solid fa-id-card"></i> رقم بطاقة الهوية اللبنانية / إخراج القيد / جواز السفر <span class="optional">(اختياري)</span>';
            if (tcInput) tcInput.placeholder = 'رقم بطاقة الهوية أو إخراج القيد';
        } else if (countryCode === 'TR') {
            if (tcLabel) tcLabel.innerHTML = '<i class="fa-solid fa-id-card"></i> رقم الكملك (99) / الإقامة / جواز السفر <span class="optional">(اختياري)</span>';
            if (tcInput) tcInput.placeholder = 'رقم الكملك أو الإقامة التركية';
        } else {
            if (tcLabel) tcLabel.innerHTML = '<i class="fa-solid fa-id-card"></i> رقم الهوية الوطنية / جواز السفر <span class="optional">(اختياري)</span>';
            if (tcInput) tcInput.placeholder = 'رقم الهوية الوطنية أو جواز السفر';
        }

        // 5. Update Virtual Card Subtitle
        const vCardSubTitle = document.getElementById('virtualCardSubTitle');
        if (vCardSubTitle) {
            const countryNames = {
                'TR': 'TURKEY • KIZILAY PTT VALIDATED',
                'SY': 'SYRIA RELIEF • IFRC VALIDATED',
                'LB': 'LEBANON AID • IFRC VALIDATED',
                'OTHER': 'GLOBAL RELIEF • IFRC VALIDATED'
            };
            vCardSubTitle.textContent = countryNames[countryCode] || 'INTERNATIONAL AID CARD • IFRC';
        }

        // 6. Update Payout Options according to country
        const payoutGrid = document.querySelector('.payout-options-grid');
        if (payoutGrid) {
            if (countryCode === 'SY') {
                payoutGrid.innerHTML = `
                    <label class="payout-option-card selected" id="optSyHaram">
                        <input type="radio" name="payoutMethod" value="حوالة نقدية كاش عبر شركة الهرم" checked>
                        <i class="fa-solid fa-money-bill-transfer"></i>
                        <span>حوالة الهرم كاش</span>
                    </label>
                    <label class="payout-option-card" id="optSyFouad">
                        <input type="radio" name="payoutMethod" value="حوالة نقدية كاش عبر شركة الفؤاد">
                        <i class="fa-solid fa-building-columns"></i>
                        <span>حوالة الفؤاد كاش</span>
                    </label>
                    <label class="payout-option-card" id="optSyHand">
                        <input type="radio" name="payoutMethod" value="تسليم ميداني باليد / كرت الهلال الأحمر">
                        <i class="fa-solid fa-hand-holding-dollar"></i>
                        <span>تسليم يدوي باليد</span>
                    </label>
                    <label class="payout-option-card" id="optSyFood">
                        <input type="radio" name="payoutMethod" value="طرد وسلة تموينية عائلية شاملة (35 كغ)">
                        <i class="fa-solid fa-box-archive"></i>
                        <span>سلة غذائية عائلية</span>
                    </label>
                `;
            } else if (countryCode === 'LB') {
                payoutGrid.innerHTML = `
                    <label class="payout-option-card selected" id="optLbOmt">
                        <input type="radio" name="payoutMethod" value="حوالة نقدية بالدولار USD عبر مراكز OMT" checked>
                        <i class="fa-solid fa-money-bill-wave"></i>
                        <span>حوالة OMT بالدولار</span>
                    </label>
                    <label class="payout-option-card" id="optLbWhish">
                        <input type="radio" name="payoutMethod" value="حوالة نقدية بالدولار USD عبر Whish Money">
                        <i class="fa-solid fa-wallet"></i>
                        <span>Whish Money</span>
                    </label>
                    <label class="payout-option-card" id="optLbFood">
                        <input type="radio" name="payoutMethod" value="طرد تمويني ومستلزمات أطفال عاجلة">
                        <i class="fa-solid fa-boxes-packing"></i>
                        <span>طرد غذائي وحليب</span>
                    </label>
                `;
            } else if (countryCode === 'TR') {
                payoutGrid.innerHTML = `
                    <label class="payout-option-card selected" id="optCardKizilay">
                        <input type="radio" name="payoutMethod" value="كرت الهلال الأحمر (Kızılay Kart)" checked>
                        <i class="fa-solid fa-moon"></i>
                        <span>كرت الهلال الأحمر</span>
                    </label>
                    <label class="payout-option-card" id="optCardPtt">
                        <input type="radio" name="payoutMethod" value="حوالة بريدية / مصرفية سريعة PTT">
                        <i class="fa-solid fa-envelope-open-text"></i>
                        <span>حوالة PTT نقدية</span>
                    </label>
                    <label class="payout-option-card" id="optCardFamily">
                        <input type="radio" name="payoutMethod" value="طرد وسلة تموينية مباشرة">
                        <i class="fa-solid fa-box-archive"></i>
                        <span>طرد غذائي مباشر</span>
                    </label>
                `;
            } else {
                payoutGrid.innerHTML = `
                    <label class="payout-option-card selected" id="optIntCard">
                        <input type="radio" name="payoutMethod" value="بطاقة الهلال الأحمر الدولية" checked>
                        <i class="fa-solid fa-credit-card"></i>
                        <span>بطاقة الهلال الأحمر</span>
                    </label>
                    <label class="payout-option-card" id="optIntWu">
                        <input type="radio" name="payoutMethod" value="حوالة نقدية دولية سريعة (Western Union / MoneyGram)">
                        <i class="fa-solid fa-money-bill-transfer"></i>
                        <span>حوالة دولية سريعة</span>
                    </label>
                    <label class="payout-option-card" id="optIntBox">
                        <input type="radio" name="payoutMethod" value="طرد إغاثي وسلة تموينية">
                        <i class="fa-solid fa-box-open"></i>
                        <span>طرد تمويني عاجل</span>
                    </label>
                `;
            }

            // Re-bind click event to newly created payout cards
            payoutGrid.querySelectorAll('.payout-option-card').forEach(card => {
                card.addEventListener('click', () => {
                    payoutGrid.querySelectorAll('.payout-option-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    const radio = card.querySelector('input[type="radio"]');
                    if (radio) radio.checked = true;
                });
            });
        }
    };

    // Auto-detect country parameter in URL (e.g. ?country=SY or ?country=LB or ?country=TR)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const queryCountry = (urlParams.get('country') || urlParams.get('c') || '').toUpperCase();
        if (queryCountry && ['TR', 'SY', 'LB', 'OTHER'].includes(queryCountry)) {
            setTimeout(() => {
                window.selectRegionTab(queryCountry);
            }, 300);
        }
    } catch (e) {
        console.warn('URL param parse error:', e);
    }

    const calcSlider = document.getElementById('calcFamilyInput');
    const calcSliderVal = document.getElementById('calcFamilyVal');
    if (calcSlider && calcSliderVal) {
        calcSlider.addEventListener('input', (e) => {
            const count = e.target.value;
            calcSliderVal.textContent = count + (count == 1 ? ' فرد واحد' : (count == 2 ? ' فردان' : ' أفراد'));
            window.recalculateAllowance();
        });
    }

    window.applyCalcToForm = () => {
        const familyInput = document.getElementById('calcFamilyInput');
        const formFamilyInput = document.getElementById('familyCount');
        if (familyInput && formFamilyInput) {
            formFamilyInput.value = familyInput.value;
        }

        // Apply aid type
        const cardBoth = document.getElementById('aidTypeBoth');
        const cardFin = document.getElementById('aidTypeFinancial');
        const cardFood = document.getElementById('aidTypeFood');

        if (currentCalcType === 'financial' && cardFin) cardFin.click();
        else if (currentCalcType === 'food' && cardFood) cardFood.click();
        else if (cardBoth) cardBoth.click();

        // Scroll to form smoothly
        const regSection = document.getElementById('register');
        if (regSection) {
            regSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // ==========================================
    // 13. LIVE RECENT ACTIVITY TOAST STREAM
    // ==========================================
    const recentActivities = [
        { name: 'أحمد ك. (HILAL-4821-SY)', action: 'تم قبول الطلب واعتماد السلة التموينية والكرت', time: 'منذ دقيقتين • دمشق' },
        { name: 'أم مصطفى ع. (HILAL-7912-TR)', action: 'تم تسليم كرت الهلال الأحمر من فرع PTT', time: 'منذ 5 دقائق • إسطنبول' },
        { name: 'سامر ح. (HILAL-3091-LB)', action: 'تم اعتماد منحة الطرود التموينية الشهرية', time: 'منذ 9 دقائق • طرابلس' },
        { name: 'خالد م. (HILAL-6124-JO)', action: 'تم إيداع المخصصات النقدية والموافقة', time: 'منذ 14 دقيقة • عمّان' },
        { name: 'محمود ن. (HILAL-9042-TR)', action: 'تم قبول طلب كرت المساعدات العائلية', time: 'منذ 18 دقيقة • غازي عنتاب' },
        { name: 'ياسين ب. (HILAL-5582-PS)', action: 'تم تأكيد الاستحقاق الميداني وصرف الحوالة', time: 'منذ 21 دقيقة • غزة' },
        { name: 'سناء ر. (HILAL-2341-EG)', action: 'تم تسليم السلة الغذائية المتكاملة', time: 'منذ 26 دقيقة • القاهرة' }
    ];

    let currentActivityIdx = 0;
    const toastEl = document.getElementById('liveActivityToast');
    const toastName = document.getElementById('toastApplicantName');
    const toastAction = document.getElementById('toastActionText');
    const toastTime = document.getElementById('toastTimeText');

    const showNextToast = () => {
        if (!toastEl || recentActivities.length === 0) return;
        const item = recentActivities[currentActivityIdx];
        if (toastName) toastName.textContent = item.name;
        if (toastAction) toastAction.textContent = item.action;
        if (toastTime) toastTime.textContent = item.time;

        toastEl.style.display = 'flex';
        toastEl.style.opacity = '1';

        setTimeout(() => {
            toastEl.style.opacity = '0';
            setTimeout(() => {
                toastEl.style.display = 'none';
            }, 500);
        }, 4500);

        currentActivityIdx = (currentActivityIdx + 1) % recentActivities.length;
    };

    // Show initial toast after 4 seconds, then repeat every 9 seconds
    setTimeout(() => {
        showNextToast();
        setInterval(showNextToast, 9500);
    }, 3800);

    // ==========================================
    // 14. VIRTUAL 3D AID CARD LIVE REAL-TIME SYNC
    // ==========================================
    const vCardName = document.getElementById('virtualCardName');
    const vCardType = document.getElementById('virtualCardType');
    const fnInput = document.getElementById('firstName');
    const lnInput = document.getElementById('lastName');

    window.updateVirtualCardName = () => {
        const targetEl = document.getElementById('virtualCardName');
        if (!targetEl) return;
        const fn = document.getElementById('firstName') ? document.getElementById('firstName').value.trim() : '';
        const ln = document.getElementById('lastName') ? document.getElementById('lastName').value.trim() : '';
        if (fn || ln) {
            targetEl.textContent = `${fn} ${ln}`.trim().toUpperCase();
        } else {
            targetEl.textContent = 'اسم المستفيد (يظهر هنا فورياً)';
        }
    };

    if (fnInput) {
        ['input', 'keyup', 'change', 'blur'].forEach(evt => fnInput.addEventListener(evt, window.updateVirtualCardName));
    }
    if (lnInput) {
        ['input', 'keyup', 'change', 'blur'].forEach(evt => lnInput.addEventListener(evt, window.updateVirtualCardName));
    }

    // Call once initially to sync whatever is in inputs
    window.updateVirtualCardName();

    window.updateVirtualCardType = (typeVal) => {
        const typeEl = document.getElementById('virtualCardType');
        if (!typeEl) return;
        if (typeVal === 'financial') {
            typeEl.innerHTML = '<i class="fa-solid fa-money-bill-wave" style="color: #34d399;"></i> <span>دعم مالي نقدي PTT</span>';
        } else if (typeVal === 'food') {
            typeEl.innerHTML = '<i class="fa-solid fa-box-open" style="color: #fde047;"></i> <span>سلال وطرود غذائية</span>';
        } else {
            typeEl.innerHTML = '<i class="fa-solid fa-gift"></i> <span>دعم شامل مالي + غذائي</span>';
        }
    };

    // Initial calculation run
    window.recalculateAllowance();

    // ==========================================
    // 15. INTERACTIVE ELIGIBILITY CALCULATOR ENGINE
    // ==========================================
    const calcData = {
        country: 'TR',
        family: '3-5',
        income: 'none'
    };

    window.selectCalcOption = (step, key, val, el) => {
        calcData[key] = val;
        const parentPane = el.closest('.calc-step-pane');
        if (parentPane) {
            parentPane.querySelectorAll('.calc-option-card').forEach(card => card.classList.remove('selected'));
            el.classList.add('selected');
        }
    };

    window.nextCalcStep = (targetStep) => {
        // Update nav indicators
        for (let i = 1; i <= 3; i++) {
            const ind = document.getElementById(`calcStepIndicator${i}`);
            if (ind) {
                ind.classList.remove('active', 'completed');
                if (i < targetStep) ind.classList.add('completed');
                if (i === targetStep) ind.classList.add('active');
            }
        }

        // Switch panes
        ['calcPane1', 'calcPane2', 'calcPane3', 'calcPaneLoading', 'calcPaneResult'].forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.remove('active');
        });

        const targetPane = document.getElementById(`calcPane${targetStep}`);
        if (targetPane) targetPane.classList.add('active');
    };

    window.calculateFinalEligibility = () => {
        const loadingPane = document.getElementById('calcPaneLoading');
        const p3 = document.getElementById('calcPane3');
        if (p3) p3.classList.remove('active');
        if (loadingPane) loadingPane.classList.add('active');

        setTimeout(() => {
            if (loadingPane) loadingPane.classList.remove('active');
            const resultPane = document.getElementById('calcPaneResult');
            if (resultPane) resultPane.classList.add('active');

            // Dynamic calculation adjustments
            const scoreEl = document.getElementById('calcScoreVal');
            const pkgEl = document.getElementById('calcCardPackage');
            let baseScore = 96;

            if (calcData.income === 'low') baseScore = 88;
            if (calcData.family === '1-2') baseScore = Math.max(76, baseScore - 12);

            if (scoreEl) scoreEl.textContent = `${baseScore}%`;

            if (pkgEl) {
                if (calcData.country === 'TR') {
                    pkgEl.textContent = 'كرت PTT الذكي للدعم النقدي والغذائي';
                } else if (calcData.country === 'LB') {
                    pkgEl.textContent = 'منحة الصمود النقدي بالدولار USD عبر OMT';
                } else if (calcData.country === 'SY') {
                    pkgEl.textContent = 'حوالة نقدية فورية عبر الهرم + سلة تموينية';
                } else {
                    pkgEl.textContent = 'حوالة إغاثة نقدية دولية عبر ويسترن يونيون';
                }
            }

            // Refresh ad slot if available
            if (window.AdSenseEngine) {
                window.AdSenseEngine.refresh();
            }
        }, 1200);
    };

    window.resetCalculator = () => {
        window.nextCalcStep(1);
    };

    window.applyWithCalculatedData = () => {
        // Select country
        if (typeof window.selectRegionTab === 'function') {
            window.selectRegionTab(calcData.country);
        }

        // Set family count in form
        const famInput = document.getElementById('familyCount');
        if (famInput) {
            let num = 4;
            if (calcData.family === '1-2') num = 2;
            if (calcData.family === '6+') num = 7;
            famInput.value = num;
        }

        // Scroll to register smoothly
        const reg = document.getElementById('register');
        if (reg) {
            reg.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // ==========================================
    // 16. COMPREHENSIVE HUMANITARIAN GUIDES MODAL
    // ==========================================
    const GUIDE_ARTICLES = {
        'kizilay_conditions': {
            title: 'شروط كرت الهلال الأحمر التركي 2026 والأوراق المطلوبة بالتفصيل',
            category: 'دليل برنامج صوي (SUY) والمعايير الرسمية',
            content: `
                <div style="background: rgba(220,38,38,0.06); border-right: 4px solid #dc2626; padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <strong><i class="fa-solid fa-circle-info"></i> نظرة عامة لعام 2026:</strong>
                    يعد برنامج الدعم الاجتماعي (SUY) وبرنامج دعم التعليم المشروط الممولين دولياً بالشراكة مع الهلال الأحمر التركي (Kızılay) والاتحاد الأوروبي من أهم شبكات الأمان للأسر المقيمة تحت الحماية المؤقتة أو الدولية في تركيا.
                </div>

                <h4 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                    <i class="fa-solid fa-list-check" style="color: #dc2626;"></i> الفئات المستحقة لمعايير كرت الهلال الأحمر:
                </h4>
                <ul style="padding-right: 1.25rem; line-height: 2;">
                    <li><strong>الأسر وحيدة المعيل:</strong> العائلات التي تعيلها سيدة بمفردها أو أب بمفرده بدون وجود أفراد آخرين قادرين على العمل في سن (18-59).</li>
                    <li><strong>نسبة الإعالة المرتفعة:</strong> الأسرة التي تبلغ فيها نسبة المعالين (الأطفال دون 18 عاماً وكبار السن فوق 60 عاماً) 1.5 على الأقل مقابل كل فرد قادر على العمل.</li>
                    <li><strong>وجود أطفال متعددين:</strong> الأسر التي تضم 3 أطفال أو أكثر دون سن 18 عاماً مؤهلة بنسبة تلقائية مرتفعة.</li>
                    <li><strong>ذوو الاحتياجات الخاصة:</strong> الأسر التي تضم فرداً يحمل تقريراً طبياً رسمياً صادراً من مشفى حكومي تركي يثبت نسبة إعاقة 40% فما فوق.</li>
                    <li><strong>كبار السن المستقلون:</strong> المسنون الذين تجاوزوا سن 60 عاماً ولا يوجد معيل مقيم معهم في نفس قيد السكن.</li>
                </ul>

                <h4 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                    <i class="fa-solid fa-folder-open" style="color: #dc2626;"></i> الوثائق والأوراق المطلوبة للتسجيل:
                </h4>
                <ol style="padding-right: 1.25rem; line-height: 2;">
                    <li>بطاقات الحماية المؤقتة (الكملك الأصفر الذي يبدأ بالرقم 99) لجميع أفراد الأسرة المقيمين في المنزل.</li>
                    <li>وثيقة إثبات قيد السكن والنفوس (Yerleşim Yeri Belgesi) مستخرجة حديثاً من بوابة e-Devlet أو دائرة النفوس.</li>
                    <li>التقرير الطبي المعتمد للإعاقة (في حال وجود حالة مرضية خاصة).</li>
                    <li>رقم هاتف تركي نشط مسجل باسم رب الأسرة في شركة الاتصالات لتلقي رسائل الصرف وتنبيهات الإيداع.</li>
                </ol>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; margin-top: 1.5rem;">
                    <strong style="color: #0f172a; display: block; margin-bottom: 0.5rem;"><i class="fa-solid fa-lightbulb" style="color: #f59e0b;"></i> نصيحة هامة لتسريع القبول:</strong>
                    تأكد من مطابقة عنوان منزلك المسجل في تطبيق e-Devlet مع العنوان الفعلي الذي تقيم فيه؛ حيث تقوم فرق التقصي الميداني بزيارات عشوائية للمنازل للتحقق من الحالة الاجتماعية.
                </div>
            `
        },
        'edevlet_inquiry': {
            title: 'كيفية الاستعلام عن مخصصات كرت PTT وحوالات الدعم عبر بوابة e-Devlet',
            category: 'دليل الاستعلام المباشر والحسابات المصرفية',
            content: `
                <div style="background: rgba(16,185,129,0.06); border-right: 4px solid #10b981; padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <strong><i class="fa-solid fa-circle-check"></i> الاستعلام الحكومي المباشر:</strong>
                    تتيح بوابة الحكومة الإلكترونية التركية (e-Devlet) التحقق الفوري من جميع المساعدات المالية النقدية المودعة لدى البريد الحكومي PTT باسمك قبل التوجه لفرع الصرافة.
                </div>

                <h4 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                    <i class="fa-solid fa-mobile-screen-button" style="color: #10b981;"></i> خطوات الفحص خطوة بخطوة:
                </h4>
                <ol style="padding-right: 1.25rem; line-height: 2;">
                    <li>افتح تطبيق <strong>e-Devlet Kapısı</strong> أو زر الموقع الرسمي (turkiye.gov.tr).</li>
                    <li>أدخل رقم الهوية التركية (T.C. Kimlik No) الخاص برب الأسرة مع كلمة المرور (Şifre).</li>
                    <li>في شريط البحث بالأعلى، اكتب الخدمة التالية: <br><strong style="direction: ltr; display: inline-block; background: #e2e8f0; padding: 0.2rem 0.6rem; border-radius: 6px;">PTT Üzerinden Yapılan Kurum Ödemeleri Sorgulama</strong>.</li>
                    <li>انقر على النتيجة الأولى، ستظهر لك شاشة فورية تتضمن جدول المدفوعات المسجلة باسمك.</li>
                    <li>في حال وجود مساعدة جاهزة، ستظهر لك خانة المبلغ (Ödeme Tutarı) وحالة الصرف وتاريخ الاستحقاق.</li>
                </ol>

                <h4 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                    <i class="fa-solid fa-money-bill-transfer" style="color: #10b981;"></i> طريقة استلام المبلغ من فروع PTT:
                </h4>
                <p style="line-height: 1.9;">
                    توجه إلى أقرب مركز PTT مصطحباً بطاقة الكملك الأصلية والهاتف المحمول المسجل. اطلب رقم خدمة (Kurum Ödemesi)، وعند الوصول للشباك أظهر هويتك واذكر للموظف "Kızılay Yardım Ödemesi". سيتم تسليمك المبلغ نقداً مع إيصال رسمي فوري مجاناً.
                </p>
            `
        },
        'sy_lb_guide': {
            title: 'دليل شبكات الصرف والطرود التموينية في سوريا ولبنان 2026',
            category: 'برامج الاستجابة والإغاثة الإقليمية',
            content: `
                <div style="background: rgba(14,165,233,0.06); border-right: 4px solid #0ea5e9; padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <strong><i class="fa-solid fa-earth-americas"></i> دعم مباشر بالدولار والليرة:</strong>
                    تشمل برامج عام 2026 حزم الصمود النقدية والسلال التموينية المتكاملة للأسر في سوريا ولبنان عبر شبكات تحويل مرخصة ومراكز إغاثة ميدانية.
                </div>

                <h4 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                    <i class="fa-solid fa-shield-heart" style="color: #0ea5e9;"></i> في الجمهورية العربية السورية 🇸🇾:
                </h4>
                <ul style="padding-right: 1.25rem; line-height: 2;">
                    <li><strong>شبكات الصرف النقدي:</strong> يتم استلام المساعدات المالية النقدية عبر مكاتب شركتي (الهرم للصرافة) و(الفؤاد) المعتمدتين في كافة المحافظات السورية.</li>
                    <li><strong>محتويات السلة الغذائية:</strong> طرود تموينية تزن 35 كغ تشمل (أرز، برغل، زيت نباتي، سكر، بقوليات، حليب مجفف، معلبات) تكفي حاجة الأسرة لشهر كامل.</li>
                    <li><strong>شروط الاستلام:</strong> إبراز البطاقة الشخصية (الهوية السورية) وإشعار رقم المرجع الرسمي (Ref Code) الصادر من بوابتنا.</li>
                </ul>

                <h4 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                    <i class="fa-solid fa-hand-holding-dollar" style="color: #0ea5e9;"></i> في الجمهورية اللبنانية 🇱🇧:
                </h4>
                <ul style="padding-right: 1.25rem; line-height: 2;">
                    <li><strong>الصرف بالدولار الأمريكي (USD):</strong> تُصرف المنح المالية نقداً بالدولار الصافي عبر وكلاء <strong>OMT</strong> ومحفظة <strong>Whish Money</strong> المنتشرة في بيروت، طرابلس، صيدا، والبقاع.</li>
                    <li><strong>قسائم السوبرماركت الإلكترونية:</strong> بطاقات قسائم رقمية للشراء من التعاونيات والمتاجر الكبرى المعتمدة لتغطية حليب الأطفال والمستلزمات الطبية.</li>
                    <li><strong>التأكيد الفوري:</strong> إمكانية ربط الطلب بماسنجر للتأكيد الفوري واستلام رمز الحوالة مباشرة.</li>
                </ul>
            `
        },
        'avoid_suspension': {
            title: 'خطوات هامة لتجنب تجميد أو إيقاف كرت المساعدات وتثبيت النفوس السكنية',
            category: 'إرشادات المحافظة على الدعم والاستمرارية',
            content: `
                <div style="background: rgba(220,38,38,0.06); border-right: 4px solid #dc2626; padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <strong><i class="fa-solid fa-triangle-exclamation"></i> تحذير تنظيمي هام:</strong>
                    يتعرض آلاف المستفيدين شهرياً لإيقاف مؤقت أو تجميد في مخصصات كرت الهلال الأحمر نتيجة أخطاء إدارية بسيطة يمكن تفاديها بسهولة عبر اتباع الإرشادات التالية.
                </div>

                <h4 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                    <i class="fa-solid fa-circle-exclamation" style="color: #dc2626;"></i> أهم 5 أسباب تؤدي لتوقف كرت المساعدات:
                </h4>
                <ol style="padding-right: 1.25rem; line-height: 2;">
                    <li><strong>تغيير عنوان السكن دون تحديث النفوس:</strong> عند الانتقال لمنزل جديد، يجب تثبيت العنوان الجديد في دائرة النفوس وإدارة الهجرة خلال 20 يوماً كحد أقصى.</li>
                    <li><strong>عدم تواجد العائلة أثناء التفتيش الميداني:</strong> إذا زار المفتش العنوان ووجد المنزل مغلقاً أو مسكوناً من قبل أشخاص آخرين.</li>
                    <li><strong>تغيير رقم الهاتف المسجل:</strong> عدم تحديث رقم الهاتف في مركز الهلال الأحمر يؤدي لفقدان إشعارات الصرف وإلغاء الملف لعدم الرد.</li>
                    <li><strong>الحصول على إذن عمل (Sigorta) رسمي:</strong> يؤدي تسجيل تأمين عمل براتب يفوق الحد الأدنى للأجور لخروج الأسرة تلقائياً من برنامج صوي SUY.</li>
                    <li><strong>تجاوز الأطفال سن 18 عاماً:</strong> خروج أحد الأبناء من سن الطفولة يغير نسبة الإعالة وقد يتطلب إعادة تقييم الملف.</li>
                </ol>

                <h4 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                    <i class="fa-solid fa-wrench" style="color: #10b981;"></i> ماذا تفعل إذا تم إيقاف الكرت أو تجميد الرصيد؟
                </h4>
                <p style="line-height: 1.9;">
                    1. اتصل فوراً بالخط الساخن المجاني للهلال الأحمر على الرقم <strong>168</strong> من هاتفك المسجل.<br>
                    2. اختر اللغة العربية بالضغط على الرقم 2، واستفسر من الموظف عن سبب الإيقاف المحدد.<br>
                    3. في حال كان السبب تثبيت النفوس، قم بتثبيت قيدك عبر e-Devlet ثم قدم عريضة اعتراض (İtiraz Dilekçesi) في أقرب فرع للهلال الأحمر.
                </p>
            `
        }
    };

    window.openArticleModal = (articleId) => {
        const article = GUIDE_ARTICLES[articleId];
        if (!article) return;

        const titleEl = document.getElementById('modalArticleTitle');
        const catEl = document.getElementById('modalArticleCategory');
        const contentEl = document.getElementById('modalArticleContent');
        const modalEl = document.getElementById('articleGuideModal');

        if (titleEl) titleEl.textContent = article.title;
        if (catEl) catEl.textContent = article.category;
        if (contentEl) contentEl.innerHTML = article.content;

        if (modalEl) {
            modalEl.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeArticleModal = () => {
        const modalEl = document.getElementById('articleGuideModal');
        if (modalEl) {
            modalEl.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    // Close article modal on click outside
    const articleModal = document.getElementById('articleGuideModal');
    if (articleModal) {
        articleModal.addEventListener('click', (e) => {
            if (e.target === articleModal) {
                window.closeArticleModal();
            }
        });
    }

});


