/**
 * dialog-utils.js
 * SoDRé Custom Alert & Confirm Utility
 */

(function () {
    window.showAlert = function (message, type = 'info') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'sodre-dialog-overlay';

            let iconClass = 'fa-info-circle info';
            if (type === 'success') iconClass = 'fa-check-circle success';
            if (type === 'warning') iconClass = 'fa-exclamation-triangle warning';
            if (type === 'error') iconClass = 'fa-times-circle error';

            overlay.innerHTML = `
                <div class="sodre-dialog-content">
                    <i class="fas ${iconClass} sodre-dialog-icon"></i>
                    <div class="sodre-dialog-message">${message}</div>
                    <div class="sodre-dialog-actions">
                        <button class="sodre-dialog-btn primary">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Trigger animation
            setTimeout(() => overlay.classList.add('show'), 10);

            overlay.querySelector('.primary').addEventListener('click', () => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 300);
            });
        });
    };

    window.showConfirm = function (message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'sodre-dialog-overlay';

            overlay.innerHTML = `
                <div class="sodre-dialog-content">
                    <i class="fas fa-question-circle info sodre-dialog-icon"></i>
                    <div class="sodre-dialog-message">${message}</div>
                    <div class="sodre-dialog-actions">
                        <button class="sodre-dialog-btn secondary">キャンセル</button>
                        <button class="sodre-dialog-btn primary">実行する</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Trigger animation
            setTimeout(() => overlay.classList.add('show'), 10);

            overlay.querySelector('.secondary').addEventListener('click', () => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.remove();
                    resolve(false);
                }, 300);
            });

            overlay.querySelector('.primary').addEventListener('click', () => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.remove();
                    resolve(true);
                }, 300);
            });
        });
    };
})();
