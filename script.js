document.addEventListener('DOMContentLoaded', () => {

    // --- Opening Animation (CSS Based) ---
    const overlay = document.getElementById('opening-overlay');

    if (overlay) {
        // Check if already visited
        if (sessionStorage.getItem('hasTakenIntro')) {
            overlay.style.display = 'none';
            triggerHeroAnimations();
        } else {
            document.body.style.overflow = 'hidden';

            // Wait for CSS animations to complete (approx 3.5s)
            setTimeout(() => {
                overlay.style.opacity = '0';
                overlay.style.visibility = 'hidden';
                document.body.style.overflow = 'auto';
                triggerHeroAnimations();
                sessionStorage.setItem('hasTakenIntro', 'true');
            }, 3500);
        }
    } else {
        triggerHeroAnimations();
    }


    // --- Hero Animations ---
    function triggerHeroAnimations() {
        const reveals = document.querySelectorAll('.reveal-text');
        reveals.forEach(el => el.classList.add('active'));
    }


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


    // --- Header Scroll Effect ---
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
    const hamburger = document.getElementById('hamburger-btn');
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
