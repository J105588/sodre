/**
 * Hamburger Menu Module
 * Dynamically loads the hamburger menu HTML and initializes its functionality.
 */
(function () {
    const script = document.currentScript;
    const root = script.getAttribute('data-root') || './';
    const htmlPath = `${root}components/hamburger.html`;

    // Fetch and inject the hamburger menu
    fetch(htmlPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load hamburger menu: ${response.statusText}`);
            }
            return response.text();
        })
        .then(html => {
            // Replace {{ROOT}} placeholders with the actual relative path
            const processedHtml = html.replace(/{{ROOT}}/g, root);
            
            // Inject at the beginning of body
            document.body.insertAdjacentHTML('afterbegin', processedHtml);
            
            // Initialize event listeners
            initializeMenu();
        })
        .catch(error => {
            console.error('Error loading hamburger menu:', error);
        });

    function initializeMenu() {
        const hamburger = document.querySelector('.hamburger');
        const body = document.body;
        const menuLinks = document.querySelectorAll('.menu-list a');

        if (hamburger) {
            hamburger.addEventListener('click', () => {
                body.classList.toggle('menu-open');
            });
        }

        // Sub-menu Accordion Toggle (Mobile)
        const submenuToggles = document.querySelectorAll('.submenu-toggle');
        submenuToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const parent = toggle.closest('.has-submenu');
                if (parent) {
                    parent.classList.toggle('active');
                }
            });
        });

        // Close menu when a link is clicked
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                // Don't close if it's a submenu toggle being clicked
                if (!link.closest('.submenu-toggle')) {
                    body.classList.remove('menu-open');
                }
            });
        });
    }
})();
