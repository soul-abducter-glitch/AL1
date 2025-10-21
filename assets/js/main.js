'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const translations = window.APEX_TRANSLATIONS || {};
    const config = window.APEX_CONFIG || {};
    const USD_EXCHANGE_RATE = Number(config.USD_EXCHANGE_RATE ?? 95);
    const contactConfig = config.contact || {};
    const submissionCooldownMs = Number(contactConfig.submissionCooldownSeconds ?? 0) * 1000;

    const carGrid = document.querySelector('.cars-grid');
    const carCards = document.querySelectorAll('.car-card');
    const filterContainer = document.querySelector('.filter-buttons');
    const brandsContainer = document.querySelector('.brands-grid');
    const burgerMenu = document.getElementById('burger-menu');
    const navWrapper = document.getElementById('nav-wrapper');
    const langToggle = document.getElementById('lang-toggle');
    const langDropdown = document.getElementById('lang-dropdown');
    const searchContainer = document.querySelector('.search-container');
    const searchIcon = document.getElementById('search-icon');
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const header = document.getElementById('header');

    const modal = document.getElementById('details-modal');
    const closeModalBtn = modal?.querySelector('.close-button');
    const modalCtaButton = modal?.querySelector('.cta-button');

    const contactForm = document.querySelector('.contact-form');
    const formNameInput = contactForm?.querySelector('input[name="name"]');
    const formEmailInput = contactForm?.querySelector('input[name="email"]');
    const formPhoneInput = contactForm?.querySelector('input[name="phone"]');
    const formMessageTextarea = contactForm?.querySelector('textarea[name="message"]');
    const privacyCheckbox = document.getElementById('privacy-checkbox');
    const submitButton = document.getElementById('submit-button');
    const honeypotInput = contactForm?.querySelector('input[name="company"]');

    let lastSubmissionTs = 0;

    function getTranslation(key, lang) {
        return translations[key]?.[lang] ?? translations[key]?.ru ?? '';
    }

    function formatPriceElement(element, lang) {
        const rawPrice = Number(element.dataset.price || 0);
        if (!Number.isFinite(rawPrice) || rawPrice <= 0) return;

        if (lang === 'ru') {
            element.textContent = `от ${rawPrice.toLocaleString('ru-RU')} ₽ / сутки`;
        } else {
            const usdPrice = Math.max(1, Math.round(rawPrice / USD_EXCHANGE_RATE));
            element.textContent = `from $${usdPrice.toLocaleString('en-US')} / day`;
        }
    }

    function switchLanguage(lang) {
        document.documentElement.lang = lang;
        document.getElementById('current-lang-text').textContent = lang.toUpperCase();
        document.getElementById('lang-ru').classList.toggle('active', lang === 'ru');
        document.getElementById('lang-en').classList.toggle('active', lang === 'en');
        langDropdown.classList.remove('active');

        document.querySelectorAll('[data-lang]').forEach((element) => {
            const key = element.dataset.lang;
            if (!translations[key]) return;

            if (key === 'priceFrom') {
                formatPriceElement(element, lang);
            } else {
                element.textContent = getTranslation(key, lang);
            }
        });

        document.querySelectorAll('[data-lang-placeholder]').forEach((element) => {
            const key = element.dataset.langPlaceholder;
            const translation = getTranslation(key, lang);
            if (translation) {
                element.placeholder = translation;
            }
        });
    }

    function setupDynamicContent() {
        if (!carGrid) return;

        const sortedCards = Array.from(carCards).sort((a, b) => {
            const nameA = a.querySelector('h3')?.textContent.trim().toLowerCase() ?? '';
            const nameB = b.querySelector('h3')?.textContent.trim().toLowerCase() ?? '';
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });

        sortedCards.forEach((card) => carGrid.appendChild(card));

        const dropdownContainer = document.getElementById('cars-dropdown-list');
        if (!dropdownContainer) return;

        dropdownContainer.innerHTML = '';
        const brandLogos = new Map();
        document.querySelectorAll('.brands-grid .brand-logo')
            .forEach((logo) => brandLogos.set(logo.dataset.brandFilter, logo.src));

        const carData = Array.from(document.querySelectorAll('.cars-grid .car-card')).map((card) => ({
            id: card.id,
            name: card.querySelector('h3')?.textContent.trim() ?? '',
            brand: card.dataset.brand,
        }));

        carData
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
            .forEach((car) => {
                const listItem = document.createElement('li');
                const logoSrc = brandLogos.get(car.brand) || '';
                listItem.innerHTML = `<a href="#${car.id}"><img src="${logoSrc}" alt="${car.brand} Logo" class="dropdown-brand-logo"><span>${car.name}</span></a>`;
                dropdownContainer.appendChild(listItem);
            });
    }

    function openModal(card) {
        if (!modal) return;
        const currentLang = document.documentElement.lang || 'ru';
        const modalImage = modal.querySelector('#modal-img');
        const modalTitle = modal.querySelector('#modal-title');
        const modalDescription = modal.querySelector('#modal-description');
        const modalPrice = modal.querySelector('#modal-price');
        const modalSpecsContainer = modal.querySelector('#modal-specs');

        const cardImage = card.querySelector('img');
        modalImage.src = cardImage?.src || '';
        modalImage.alt = cardImage?.alt || '';
        modalTitle.textContent = card.querySelector('h3')?.textContent || '';
        modalDescription.textContent = card.dataset[`description${currentLang === 'ru' ? 'Ru' : 'En'}`] || '';

        const specsClone = card.querySelector('.car-specs-overlay ul')?.cloneNode(true);
        if (specsClone) {
            specsClone.querySelectorAll('strong[data-lang]').forEach((strong) => {
                const key = strong.dataset.lang;
                strong.textContent = getTranslation(key, currentLang);
            });
            modalSpecsContainer.innerHTML = '';
            modalSpecsContainer.appendChild(specsClone);
        }

        const priceElement = card.querySelector('.price');
        if (priceElement) {
            modalPrice.textContent = priceElement.textContent;
        }

        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }

    function closeModal() {
        if (!modal) return;
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    function normalizePhone(value) {
        const trimmed = (value || '').trim();
        if (!trimmed) return '';
        const digits = trimmed.replace(/\D+/g, '');
        if (!digits) return '';

        if (trimmed.startsWith('+')) {
            return `+${digits}`;
        }

        if (digits.startsWith('8') && digits.length === 11) {
            return `+7${digits.slice(1)}`;
        }

        if (digits.startsWith('7') && digits.length === 11) {
            return `+${digits}`;
        }

        return digits.length > 0 ? `+${digits}` : '';
    }

    function handleSearch(searchTerm) {
        const currentLang = document.documentElement.lang || 'ru';
        let firstMatchFound = false;

        carCards.forEach((card) => {
            const carName = card.querySelector('h3')?.textContent.toLowerCase() ?? '';
            const primaryDescription = (
                (currentLang === 'en' ? card.dataset.descriptionEn : card.dataset.descriptionRu) || ''
            ).toLowerCase();
            const fallbackDescription = (
                (currentLang === 'en' ? card.dataset.descriptionRu : card.dataset.descriptionEn) || ''
            ).toLowerCase();

            const isMatch = carName.includes(searchTerm)
                || primaryDescription.includes(searchTerm)
                || fallbackDescription.includes(searchTerm);

            card.classList.toggle('hide', !isMatch);

            if (isMatch && searchTerm && !firstMatchFound) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                firstMatchFound = true;
            }
        });
    }

    setupDynamicContent();
    switchLanguage('ru');

    carCards.forEach((card) => {
        card.querySelector('.details-button')?.addEventListener('click', (event) => {
            event.preventDefault();
            openModal(card);
        });
    });

    closeModalBtn?.addEventListener('click', closeModal);
    modalCtaButton?.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    window.addEventListener('scroll', () => {
        header?.classList.toggle('scrolled', window.scrollY > 50);
    });

    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    animatedElements.forEach((element) => observer.observe(element));

    searchIcon?.addEventListener('click', (event) => {
        event.stopPropagation();
        searchBar?.classList.toggle('active');
        if (searchBar?.classList.contains('active')) {
            searchInput?.focus();
        }
    });

    document.addEventListener('click', (event) => {
        if (searchBar?.classList.contains('active') && !searchContainer?.contains(event.target)) {
            searchBar.classList.remove('active');
        }
    });

    searchInput?.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();

        if (searchTerm) {
            filterContainer?.querySelector('.active')?.classList.remove('active');
            brandsContainer?.querySelector('.active')?.classList.remove('active');
        } else {
            filterContainer?.querySelector('[data-filter="all"]')?.classList.add('active');
        }

        handleSearch(searchTerm);
    });

    filterContainer?.addEventListener('click', (event) => {
        const filterBtn = event.target.closest('.filter-btn');
        if (!filterBtn) return;

        searchInput.value = '';
        brandsContainer?.querySelector('.active')?.classList.remove('active');
        filterContainer.querySelector('.active')?.classList.remove('active');
        filterBtn.classList.add('active');

        const filterValue = filterBtn.dataset.filter;
        carCards.forEach((card) => {
            const categories = card.dataset.category.split(' ');
            card.classList.toggle('hide', !(filterValue === 'all' || categories.includes(filterValue)));
        });
    });

    brandsContainer?.addEventListener('click', (event) => {
        const brandLogo = event.target.closest('.brand-logo');
        if (!brandLogo) return;

        searchInput.value = '';
        filterContainer?.querySelector('.active')?.classList.remove('active');
        filterContainer?.querySelector('[data-filter="all"]')?.classList.add('active');
        brandsContainer.querySelector('.active')?.classList.remove('active');
        brandLogo.classList.add('active');

        const brandFilter = brandLogo.dataset.brandFilter;
        carCards.forEach((card) => {
            card.classList.toggle('hide', card.dataset.brand !== brandFilter);
        });
        document.getElementById('cars')?.scrollIntoView({ behavior: 'smooth' });
    });

    if (burgerMenu && navWrapper) {
        burgerMenu.addEventListener('click', () => {
            burgerMenu.classList.toggle('active');
            navWrapper.classList.toggle('active');
        });

        navWrapper.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 992) {
                    burgerMenu.classList.remove('active');
                    navWrapper.classList.remove('active');
                }
            });
        });
    }

    langToggle?.addEventListener('click', (event) => {
        event.stopPropagation();
        langDropdown?.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        if (langDropdown?.classList.contains('active')) {
            langDropdown.classList.remove('active');
        }
    });

    document.getElementById('lang-ru')?.addEventListener('click', (event) => {
        event.preventDefault();
        switchLanguage('ru');
    });

    document.getElementById('lang-en')?.addEventListener('click', (event) => {
        event.preventDefault();
        switchLanguage('en');
    });

    if (submitButton) {
        submitButton.disabled = true;
    }

    privacyCheckbox?.addEventListener('change', () => {
        if (submitButton) {
            submitButton.disabled = !privacyCheckbox.checked;
        }
    });

    contactForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentLang = document.documentElement.lang || 'ru';

        if (honeypotInput && honeypotInput.value.trim()) {
            return; // Honeypot triggered; silently ignore.
        }

        if (!privacyCheckbox?.checked) {
            const message = getTranslation('formPrivacyReminder', currentLang) || 'Пожалуйста, дайте согласие на обработку персональных данных.';
            alert(message);
            return;
        }

        if (!formEmailInput || !formPhoneInput || !formNameInput || !formMessageTextarea) {
            return;
        }

        const emailValue = formEmailInput.value.trim();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(emailValue)) {
            alert(getTranslation('formEmailInvalid', currentLang) || 'Пожалуйста, укажите корректный email.');
            formEmailInput.focus();
            return;
        }

        if (submissionCooldownMs > 0) {
            const now = Date.now();
            if (now - lastSubmissionTs < submissionCooldownMs) {
                const secondsLeft = Math.ceil((submissionCooldownMs - (now - lastSubmissionTs)) / 1000);
                const cooldownMessageTemplate = getTranslation('formCooldown', currentLang) || 'Подождите {seconds} с перед повторной отправкой.';
                alert(cooldownMessageTemplate.replace('{seconds}', secondsLeft));
                return;
            }
        }

        submitButton.disabled = true;
        submitButton.textContent = currentLang === 'ru' ? 'Отправка...' : 'Sending...';

        const formData = new FormData(contactForm);
        formData.set('phone', normalizePhone(formPhoneInput.value));
        formData.set('lang', currentLang);

        try {
            const response = await fetch('mail.php', {
                method: 'POST',
                body: formData,
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });

            const result = await response.json();

            if (result.success) {
                alert(result.message);
                lastSubmissionTs = Date.now();
                formNameInput.value = '';
                formEmailInput.value = '';
                formPhoneInput.value = '';
                formMessageTextarea.value = '';
                privacyCheckbox.checked = false;
                submitButton.disabled = true;
            } else {
                alert(result.message || 'Не удалось отправить форму.');
            }
        } catch (error) {
            console.error('Ошибка при отправке формы:', error);
            alert(currentLang === 'ru' ? 'Произошла ошибка при отправке формы. Попробуйте позже.' : 'An error occurred while sending the form. Please try again later.');
        } finally {
            submitButton.textContent = getTranslation('formButton', document.documentElement.lang) || (document.documentElement.lang === 'ru' ? 'Отправить' : 'Send');
            if (privacyCheckbox.checked) {
                submitButton.disabled = false;
            }
        }
    });
});
