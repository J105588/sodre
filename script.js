document.addEventListener('DOMContentLoaded', () => {

    // --- Opening Animation (CSS / WebGL Handled) ---
    // If WebGL opening is present, it will handle the trigger.
    if (!document.getElementById('webgl-opening')) {
        const overlay = document.getElementById('opening-overlay');
        if (overlay) {
            // Old CSS fallback
            if (sessionStorage.getItem('hasTakenIntro')) {
                overlay.style.display = 'none';
                triggerHeroAnimations();
            } else {
                document.body.style.overflow = 'hidden';
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    overlay.style.visibility = 'hidden';
                    document.body.style.overflow = 'auto';
                    triggerHeroAnimations();
                    sessionStorage.setItem('hasTakenIntro', 'true');
                }, 3500);
            }
        } else {
            // No opening overlay found, trigger immediately
            // But wait... if WebGL is running, we don't want this.
            // Actually, if webgl-opening is there, we do NOTHING here.
            triggerHeroAnimations();
        }
    }

    // --- Hero Animations ---
    window.triggerHeroAnimations = function () {
        const reveals = document.querySelectorAll('.reveal-text');
        reveals.forEach(el => el.classList.add('active'));
    };


    // --- Scroll Animations (Intersection Observer) ---
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    const scrollElements = document.querySelectorAll('.scroll-reveal');
    scrollElements.forEach(el => observer.observe(el));


    // --- Header Scroll Effect (Smart Sticky) ---
    const header = document.querySelector('.header');
    let lastScrollTop = 0;
    const headerHeight = header.offsetHeight;

    window.addEventListener('scroll', () => {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > lastScrollTop && scrollTop > headerHeight) {
            // Scroll Down > Hide (but visible if at top)
            header.classList.add('hide');
        } else {
            // Scroll Up > Show
            header.classList.remove('hide');
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling
    });

    // --- Smooth Scroll for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // --- Hamburger Menu Toggle ---
    const hamburger = document.querySelector('.hamburger'); // Changed from getElementById('hamburger-btn')
    const body = document.body;
    const menuLinks = document.querySelectorAll('.menu-list a');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            body.classList.toggle('menu-open');
        });
    }

    // Close menu when a link is clicked
    menuLinks.forEach(link => {
        link.addEventListener('click', () => {
            body.classList.remove('menu-open');
        });
    });

});

// --- Hero Animations (Global) ---
window.triggerHeroAnimations = function () {
    const reveals = document.querySelectorAll('.reveal-text');
    reveals.forEach(el => el.classList.add('active'));
};
