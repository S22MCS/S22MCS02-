/**
 * Overlays Manager
 * Handles the floating alert button and its modal interactions.
 */

document.addEventListener('DOMContentLoaded', function () {
    initFloatingButton();
    initThemeControls();
});

function initThemeControls() {
    // Inject HTML
    const barHTML = `
        <div class="floating-action-bar">
            <button id="theme-toggle" class="fab-btn" title="الوضع الليلي">
                <i class="fas fa-moon"></i>
            </button>
            <button id="eye-protect-toggle" class="fab-btn" title="حماية العين">
                <i class="fas fa-eye"></i>
            </button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', barHTML);

    const themeBtn = document.getElementById('theme-toggle');
    const eyeBtn = document.getElementById('eye-protect-toggle');

    // Load Saved Preferences
    if (localStorage.getItem('nightMode') === 'true') {
        document.body.classList.add('night-mode');
        themeBtn.classList.add('active');
        themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }

    if (localStorage.getItem('eyeProtect') === 'true') {
        document.body.classList.add('eye-protect-mode');
        eyeBtn.classList.add('active');
        eyeBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    }

    // Toggle Night Mode
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('night-mode');
        const isActive = document.body.classList.contains('night-mode');

        themeBtn.classList.toggle('active', isActive);
        themeBtn.innerHTML = isActive ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

        localStorage.setItem('nightMode', isActive);
    });

    // Toggle Eye Protection
    eyeBtn.addEventListener('click', () => {
        document.body.classList.toggle('eye-protect-mode');
        const isActive = document.body.classList.contains('eye-protect-mode');

        eyeBtn.classList.toggle('active', isActive);
        eyeBtn.innerHTML = isActive ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';

        localStorage.setItem('eyeProtect', isActive);
    });
}

function initFloatingButton() {
    // Inject HTML for the floating button if it doesn't exist
    if (!document.querySelector('._x1')) {
        const floatBtnHTML = `
            <div class="_x1" id="floatAlertBtn">
                <i class="fas fa-bell"></i>
            </div>
            <div class="_x2" id="overlayBackdrop"></div>
            <div class="_x3" id="overlayModal">
                <div class="_x4">
                    <button class="_x6" id="closeOverlayBtn">×</button>
                    <h2>⚠️ تنبيهات هامة</h2>
                </div>
                <div class="_x5" id="overlayContent">
                    <div class="_x7">
                        <div class="_x8"></div>
                        <p>جاري تحميل البيانات...</p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', floatBtnHTML);
    }

    const floatBtn = document.getElementById('floatAlertBtn');
    const backdrop = document.getElementById('overlayBackdrop');
    const modal = document.getElementById('overlayModal');
    const closeBtn = document.getElementById('closeOverlayBtn');
    const content = document.getElementById('overlayContent');

    let isLoaded = false;
    const TARGET_URL = (typeof examConfig !== 'undefined' && examConfig.noteUrl)
        ? examConfig.noteUrl
        : "https://s22mcs.github.io/S22MCS02-/MEDECINE_EXAM_NOTE.html";

    function openOverlay() {
        backdrop.style.display = 'block';
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        floatBtn.style.animation = 'none'; // Stop pulsing when open

        if (!isLoaded) {
            loadContent();
        }
    }

    function closeOverlay() {
        backdrop.style.display = 'none';
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        floatBtn.style.animation = 'pulse-red 2s infinite';
    }

    function loadContent() {
        content.innerHTML = `
            <iframe src="${TARGET_URL}" 
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                loading="lazy">
            </iframe>
        `;
        isLoaded = true;
    }

    // Event Listeners
    floatBtn.addEventListener('click', openOverlay);
    closeBtn.addEventListener('click', closeOverlay);
    backdrop.addEventListener('click', closeOverlay);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeOverlay();
        }
    });
}
