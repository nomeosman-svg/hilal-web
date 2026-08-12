document.addEventListener('DOMContentLoaded', () => {
    
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

    // ==========================================
    // 1. HEADER SCROLL CLASS TOGGLE
    // ==========================================
    const header = document.getElementById('mainHeader');
    
    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    
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
            
            // Toggle icon classes
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
        
        // Close mobile menu when clicking outside of navbar/menu
        document.addEventListener('click', (event) => {
            const isClickInsideMenu = navMenu.contains(event.target);
            const isClickOnToggle = mobileMenuBtn.contains(event.target);
            
            if (!isClickInsideMenu && !isClickOnToggle && navMenu.classList.contains('active')) {
                toggleMenu();
            }
        });
    }
    
    // Active Link Scroll Highlight (Spy scroll)
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    const highlightNav = () => {
        const scrollY = window.scrollY;
        
        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 120; // offset header
            const sectionId = current.getAttribute('id');
            
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    };
    
    window.addEventListener('scroll', highlightNav);
    
    // ==========================================
    // 3. TOGGLE PASSWORD VISIBILITY
    // ==========================================
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const passwordInput = document.getElementById('password');
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            
            // Toggle icon
            const icon = togglePasswordBtn.querySelector('i');
            if (icon) {
                icon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            }
        });
    }
    
    // ==========================================
    // 4. FAQ ACCORDION LOGIC
    // ==========================================
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        if (question) {
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Close all other items first
                faqItems.forEach(otherItem => {
                    otherItem.classList.remove('active');
                    const otherQuestion = otherItem.querySelector('.faq-question');
                    if (otherQuestion) {
                        otherQuestion.setAttribute('aria-expanded', 'false');
                    }
                });
                
                // Toggle current item
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
    // 5. STATS COUNTER ANIMATION
    // ==========================================
    const statsSection = document.getElementById('stats');
    const statNumbers = document.querySelectorAll('.stat-number');
    let animated = false;
    
    const animateCounters = () => {
        statNumbers.forEach(stat => {
            const target = parseInt(stat.getAttribute('data-target'), 10);
            const duration = 2000; // Animation duration in milliseconds
            const startTime = performance.now();
            
            const originalText = stat.textContent.trim();
            const suffix = originalText.includes('%') ? '%' : (originalText.includes('+') ? '+' : '');
            
            const updateCount = (currentTime) => {
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);
                
                // Ease out cubic
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const currentValue = Math.floor(easeProgress * target);
                
                // Format formatting for large numbers
                if (target > 1000) {
                    // For Arabic digits or locale formatting
                    stat.textContent = currentValue.toLocaleString('en-US') + suffix;
                } else {
                    stat.textContent = currentValue + suffix;
                }
                
                if (progress < 1) {
                    requestAnimationFrame(updateCount);
                } else {
                    // Make sure target is exactly shown at end
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
    
    // Trigger on viewport entrance
    if (statsSection && statNumbers.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !animated) {
                    animated = true;
                    animateCounters();
                    observer.unobserve(statsSection);
                }
            });
        }, {
            threshold: 0.2
        });
        
        observer.observe(statsSection);
    }
    
    // ==========================================
    // 6. FORM VALIDATION & SIMULATED SUBMISSION
    // ==========================================
    const form = document.getElementById('aidRegistrationForm');
    const submitBtn = document.getElementById('submitFormBtn');
    const spinner = document.getElementById('formSpinner');
    const successModal = document.getElementById('successModal');
    const receiptCode = document.getElementById('receiptCode');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    // Input validation triggers
    const fields = {
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
                const tcRegex = /^99\d{9}$/;
                return tcRegex.test(val.trim());
            }
        },
        phoneNumber: {
            element: document.getElementById('phoneNumber'),
            error: document.getElementById('phoneNumberError'),
            validate: (val) => {
                const phoneRegex = /^05\d{9}$/;
                return phoneRegex.test(val.trim());
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
                    if (errorSpan) errorSpan.textContent = 'يجب أن تحتوي كلمة المرور على أحرف وأرقام معاً (مثال: Noor2026)';
                    return false;
                }
                const weakBlacklist = ['12345', '123456', '1234567', '12345678', '123456789', '987654321', '87654321', '123123', '12341234', '111111', '000000', 'password', 'qwerty', 'admin', 'alnoor'];
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
        province: {
            element: document.getElementById('province'),
            error: document.getElementById('provinceError'),
            validate: (val) => val !== '' && val !== null
        },
        maritalStatus: {
            element: document.getElementById('maritalStatus'),
            error: document.getElementById('maritalStatusError'),
            validate: (val) => val !== '' && val !== null
        },
        termsCheck: {
            element: document.getElementById('termsCheck'),
            error: document.getElementById('termsCheckError'),
            validate: (val, el) => el.checked
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
    
    // Attach real-time validation events
    Object.keys(fields).forEach(key => {
        const field = fields[key];
        if (!field.element) return;
        
        const eventType = field.element.tagName === 'SELECT' || field.element.type === 'checkbox' ? 'change' : 'input';
        
        field.element.addEventListener(eventType, () => {
            validateField(key);
        });
        
        field.element.addEventListener('blur', () => {
            validateField(key);
        });
    });
    
    // Form Submission
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let isFormValid = true;
            let firstInvalidElement = null;
            
            // Validate all fields
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
                }
                return;
            }
            
            // If valid, start submission flow
            startSubmission();
        });
    }
    
    const startSubmission = () => {
        // Disable submit button and show spinner
        submitBtn.disabled = true;
        if (spinner) spinner.style.display = 'inline-block';
        
        // Collect safe form data
        const formData = {};
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
        
        // Send data to backend database
        fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('فشل إرسال الطلب، يرجى المحاولة لاحقاً');
            }
            return response.json();
        })
        .then(data => {
            completeSubmission(data.refCode, data.whatsappUrl);
        })
        .catch(err => {
            alert(err.message || 'حدث خطأ غير متوقع');
            // Re-enable form
            submitBtn.disabled = false;
            if (spinner) spinner.style.display = 'none';
            Object.keys(fields).forEach(key => {
                if (fields[key].element) {
                    fields[key].element.disabled = false;
                }
            });
        });
    };
    
    const completeSubmission = (refCode, whatsappUrl) => {
        if (receiptCode && refCode) {
            receiptCode.textContent = refCode;
        }

        const whatsappBtn = document.getElementById('whatsappBtn');
        if (whatsappBtn && whatsappUrl) {
            whatsappBtn.href = whatsappUrl;
        }
        
        // Show success modal
        if (successModal) {
            successModal.classList.add('active');
        }

        // Auto open WhatsApp window for instant user convenience
        if (whatsappUrl) {
            setTimeout(() => {
                window.open(whatsappUrl, '_blank');
            }, 600);
        }
        
        // Enable form elements and button
        submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        
        Object.keys(fields).forEach(key => {
            if (fields[key].element) {
                fields[key].element.disabled = false;
            }
        });
        
        // Reset form
        if (form) form.reset();
    };
    
    // Modal Closing Logic
    if (successModal && closeModalBtn) {
        const closeModal = () => {
            successModal.classList.remove('active');
        };
        
        closeModalBtn.addEventListener('click', closeModal);
        
        // Click outside modal content to close
        successModal.addEventListener('click', (e) => {
            if (e.target === successModal) {
                closeModal();
            }
        });
    }

    // ==========================================
    // REGISTRATION GUIDE ASSISTANT MODAL LOGIC
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

    // ==========================================
    // DIRECT SCROLL & FOCUS TO FORM FOR ALL REGISTRATION BUTTONS (MOBILE OPTIMIZED)
    // ==========================================
    const scrollToRegistrationForm = () => {
        const target = document.getElementById('registerCard') || document.getElementById('aidRegistrationForm') || document.querySelector('.register-card');
        if (!target) return;
        
        // Subtract sticky header height offset to ensure title is perfectly visible on mobile
        const header = document.getElementById('mainHeader');
        const headerHeight = header ? header.offsetHeight + 15 : 75;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });

        // Focus first input field
        setTimeout(() => {
            const firstInput = document.getElementById('firstName') || target.querySelector('input');
            if (firstInput) {
                firstInput.focus({ preventScroll: true });
            }
        }, 350);
    };

    const registerClickBtns = document.querySelectorAll('a[href="#register"], a[href="#aidRegistrationForm"], .nav-btn, #heroRegisterBtn');
    registerClickBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Close mobile navigation menu if open
            const navMenu = document.getElementById('navMenu');
            if (navMenu && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                const mobileMenuBtn = document.getElementById('mobileMenuBtn');
                if (mobileMenuBtn) {
                    mobileMenuBtn.setAttribute('aria-expanded', 'false');
                    const icon = mobileMenuBtn.querySelector('i');
                    if (icon) icon.className = 'fa-solid fa-bars';
                }
            }
            scrollToRegistrationForm();
        });
    });

    if (closeGuideModalBtn) closeGuideModalBtn.addEventListener('click', closeGuide);
    if (startRegisterNowBtn) {
        startRegisterNowBtn.addEventListener('click', () => {
            closeGuide();
            scrollToRegistrationForm();
        });
    }

    // ==========================================
    // PUBLIC APPLICATION STATUS CHECK LOGIC
    // ==========================================
    const statusCheckForm = document.getElementById('statusCheckForm');
    const statusRefInput = document.getElementById('statusRefInput');
    const statusResultBox = document.getElementById('statusResultBox');
    const statusApplicantName = document.getElementById('statusApplicantName');
    const statusRefCode = document.getElementById('statusRefCode');
    const statusBadge = document.getElementById('statusBadge');
    const statusDescText = document.getElementById('statusDescText');
    const checkStatusBtn = document.getElementById('checkStatusBtn');

    if (statusCheckForm) {
        statusCheckForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const refCode = statusRefInput ? statusRefInput.value.trim() : '';
            const passwordInput = document.getElementById('statusPasswordInput');
            const emailInput = document.getElementById('statusEmailInput');
            const password = passwordInput ? passwordInput.value : '';
            const email = emailInput ? emailInput.value.trim() : '';

            if (!refCode && !email) return;

            checkStatusBtn.disabled = true;
            checkStatusBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الاستعلام...';

            fetch('/api/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refCode, password, email })
            })
            .then(res => res.json())
            .then(data => {
                checkStatusBtn.disabled = false;
                checkStatusBtn.innerHTML = '<i class="fa-solid fa-search"></i> استعلام الآن';

                if (data.success) {
                    statusApplicantName.textContent = data.applicantName;
                    statusRefCode.textContent = data.refCode;
                    statusBadge.textContent = data.statusTitle;
                    statusDescText.textContent = data.statusDesc;

                    // Apply badge styles
                    const badgeStyles = {
                        'pending': 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);',
                        'approved': 'background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3);',
                        'delivered': 'background: rgba(59, 130, 246, 0.15); color: #3b82f6; border-color: rgba(59, 130, 246, 0.3);',
                        'rejected': 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);',
                        'incomplete': 'background: rgba(249, 115, 22, 0.15); color: #f97316; border-color: rgba(249, 115, 22, 0.3);'
                    };

                    statusBadge.style.cssText = `padding: 0.5rem 1.25rem; border-radius: 9999px; font-weight: 800; font-size: 0.95rem; border: 1px solid; ${badgeStyles[data.status] || badgeStyles['pending']}`;
                    statusResultBox.style.display = 'block';
                    statusResultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    alert(data.error || 'لم يتم العثور على طلب بهذا الرمز المرجعي');
                    statusResultBox.style.display = 'none';
                }
            })
            .catch(err => {
                checkStatusBtn.disabled = false;
                checkStatusBtn.innerHTML = '<i class="fa-solid fa-search"></i> استعلام الآن';
                alert('حدث خطأ في الاتصال بالسيرفر. يرجى المحاولة لاحقاً.');
            });
        });
    }

    // ==========================================
    // 7. 3D CAROUSEL LOGIC
    // ==========================================
    const carouselCards = document.querySelectorAll('.carousel-card');
    const prevBtn = document.querySelector('.btn-prev');
    const nextBtn = document.querySelector('.btn-next');
    
    if (carouselCards.length > 0 && prevBtn && nextBtn) {
        let activeIndex = 1; // Start with the center card (index 1 is cardPtt)
        
        const updateCarousel = () => {
            carouselCards.forEach((card, index) => {
                card.classList.remove('card-left', 'card-center', 'card-right');
                
                // Calculate position relative to activeIndex
                let pos = (index - activeIndex + 3) % 3;
                
                if (pos === 0) {
                    card.classList.add('card-center');
                } else if (pos === 1) {
                    card.classList.add('card-right');
                } else {
                    card.classList.add('card-left');
                }
            });
        };
        
        // Navigation Button Listeners
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            activeIndex = (activeIndex - 1 + 3) % 3;
            updateCarousel();
        });
        
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            activeIndex = (activeIndex + 1) % 3;
            updateCarousel();
        });
        
        // Auto-rotation every 4 seconds
        let autoRotation = setInterval(() => {
            activeIndex = (activeIndex + 1) % 3;
            updateCarousel();
        }, 4000);
        
        // Pause auto-rotation on mouse enter / Touch Swipe Support for Mobile
        const container = document.querySelector('.carousel-container');
        if (container) {
            container.addEventListener('mouseenter', () => {
                clearInterval(autoRotation);
            });
            container.addEventListener('mouseleave', () => {
                clearInterval(autoRotation);
                autoRotation = setInterval(() => {
                    activeIndex = (activeIndex + 1) % 3;
                    updateCarousel();
                }, 4000);
            });

            // Touch events for mobile swipe
            let touchStartX = 0;
            let touchEndX = 0;

            container.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            container.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }, { passive: true });

            const handleSwipe = () => {
                const swipeThreshold = 50; // min distance in pixels
                if (touchEndX < touchStartX - swipeThreshold) {
                    // Swipe Left -> Next Card (RTL: Left swipe goes next)
                    activeIndex = (activeIndex + 1) % 3;
                    updateCarousel();
                } else if (touchEndX > touchStartX + swipeThreshold) {
                    // Swipe Right -> Prev Card
                    activeIndex = (activeIndex - 1 + 3) % 3;
                    updateCarousel();
                }
            };
        }
    }
});
