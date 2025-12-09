/**
 * RailGuard V2 - Real-Time Dashboard
 * Server-Sent Events (SSE) Client for Live Alerts
 */

const BACKEND_URL = 'http://192.168.111.84:8000';
let eventSource = null;
let alertCount = 0;
let dangerCount = 0;
let safeCount = 0;

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const overallStatus = document.getElementById('overallStatus');
const alertsContainer = document.getElementById('alertsContainer');
const emptyState = document.getElementById('emptyState');
const totalAlertsEl = document.getElementById('totalAlerts');
const dangerAlertsEl = document.getElementById('dangerAlerts');
const safeAlertsEl = document.getElementById('safeAlerts');
const lastUpdateEl = document.getElementById('lastUpdate');

/**
 * Initialize SSE Connection
 */
function initSSE() {
    console.log('🔌 Connecting to SSE endpoint...');

    eventSource = new EventSource(`${BACKEND_URL}/events`);

    eventSource.onopen = () => {
        console.log('✅ SSE Connected');
        updateConnectionStatus('connected');
    };

    eventSource.addEventListener('alert', (event) => {
        console.log('🚨 New Alert Received:', event.data);
        const alertData = JSON.parse(event.data);
        handleNewAlert(alertData);
    });

    eventSource.onerror = (error) => {
        console.error('❌ SSE Error:', error);
        updateConnectionStatus('error');

        // Attempt reconnection after 5 seconds
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            eventSource.close();
            initSSE();
        }, 5000);
    };
}

/**
 * Update Connection Status Indicator
 */
function updateConnectionStatus(status) {
    const statusDot = connectionStatus.querySelector('.status-dot');
    const statusText = connectionStatus.querySelector('.status-text');

    connectionStatus.className = 'status-indicator';

    switch (status) {
        case 'connected':
            connectionStatus.classList.add('connected');
            statusText.textContent = 'Connected';
            break;
        case 'error':
            connectionStatus.classList.add('error');
            statusText.textContent = 'Disconnected';
            break;
        default:
            connectionStatus.classList.add('connecting');
            statusText.textContent = 'Connecting...';
    }
}

/**
 * Handle New Alert from SSE
 */
function handleNewAlert(alertData) {
    // Hide empty state
    if (emptyState) {
        emptyState.style.display = 'none';
    }

    // Update statistics
    alertCount++;
    if (alertData.final_status === 'DANGER') {
        dangerCount++;
        updateOverallStatus('DANGER');
    } else {
        safeCount++;
    }

    updateStats();

    // Create and insert alert card
    const alertCard = createAlertCard(alertData);

    // Insert at the top with animation
    alertsContainer.insertBefore(alertCard, alertsContainer.firstChild);

    // Trigger entrance animation
    setTimeout(() => {
        alertCard.classList.add('show');
    }, 10);

    // Play notification sound (optional)
    if (alertData.final_status === 'DANGER') {
        playNotificationSound();
    }

    // Auto-scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Create Alert Card Element
 */
function createAlertCard(data) {
    const template = document.getElementById('alertTemplate');
    const card = template.content.cloneNode(true).querySelector('.alert-card');

    // Set alert ID
    card.setAttribute('data-alert-id', data.id);

    // Status Badge
    const statusBadge = card.querySelector('.alert-status-badge');
    const badgeDot = statusBadge.querySelector('.badge-dot');
    const badgeText = statusBadge.querySelector('.badge-text');

    badgeText.textContent = data.final_status;
    statusBadge.classList.add(data.final_status.toLowerCase());

    // Timestamp
    const alertTime = card.querySelector('.alert-time');
    alertTime.textContent = formatTimestamp(data.timestamp);

    // Image
    const alertImage = card.querySelector('.alert-image');
    alertImage.src = `${BACKEND_URL}${data.image_url}`;
    alertImage.onerror = () => {
        alertImage.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect fill="%23ddd" width="640" height="480"/><text x="50%" y="50%" text-anchor="middle" fill="%23999">Image Not Available</text></svg>';
    };

    // Trigger Badge
    const triggerBadge = card.querySelector('.trigger-badge');
    triggerBadge.textContent = data.trigger_reason;
    triggerBadge.className = `trigger-badge ${data.trigger_reason.toLowerCase()}`;

    // YOLO Detection
    const detectionFlag = card.querySelector('.detection-flag');
    const yoloDetections = JSON.parse(data.yolo_detections || '[]');

    detectionFlag.innerHTML = `
        <span class="flag-badge ${data.yolo_flag.toLowerCase()}">${data.yolo_flag}</span>
        <span class="confidence">Confidence: ${(data.yolo_confidence * 100).toFixed(1)}%</span>
    `;

    const detectionItems = card.querySelector('.detection-items');
    if (yoloDetections.length > 0) {
        detectionItems.innerHTML = yoloDetections.map(det => `
            <div class="detection-item">
                <span class="detection-name">${det.class_name}</span>
                <span class="detection-conf">${(det.confidence * 100).toFixed(1)}%</span>
            </div>
        `).join('');
    } else {
        detectionItems.innerHTML = '<div class="no-detections">No objects detected</div>';
    }

    // Gemini Analysis
    const geminiStatus = card.querySelector('.gemini-status');
    const geminiReason = card.querySelector('.gemini-reason');
    const geminiConfidence = card.querySelector('.gemini-confidence');

    if (data.gemini_status) {
        geminiStatus.innerHTML = `<span class="status-badge ${data.gemini_status.toLowerCase()}">${data.gemini_status}</span>`;
        geminiReason.innerHTML = `<p class="reason-text">${data.gemini_reason}</p>`;
        geminiConfidence.innerHTML = `<div class="confidence-bar">
            <div class="confidence-fill" style="width: ${data.gemini_confidence * 100}%"></div>
            <span class="confidence-text">${(data.gemini_confidence * 100).toFixed(1)}% Confidence</span>
        </div>`;
    } else {
        geminiStatus.innerHTML = '<span class="status-badge skipped">SKIPPED</span>';
        geminiReason.innerHTML = '<p class="reason-text">Gemini analysis not required</p>';
    }

    // Final Verdict
    const verdictText = card.querySelector('.verdict-text');
    verdictText.innerHTML = `
        <div class="verdict-badge ${data.final_status.toLowerCase()}">
            ${data.final_status === 'DANGER' ? '⚠️ DANGER DETECTED' : '✅ SAFE'}
        </div>
    `;

    return card;
}

/**
 * Update Statistics Display
 */
function updateStats() {
    totalAlertsEl.textContent = alertCount;
    dangerAlertsEl.textContent = dangerCount;
    safeAlertsEl.textContent = safeCount;
    lastUpdateEl.textContent = new Date().toLocaleTimeString();
}

/**
 * Update Overall System Status
 */
function updateOverallStatus(status) {
    const badgeDot = overallStatus.querySelector('.badge-dot');
    const badgeText = overallStatus.querySelector('.badge-text');

    overallStatus.className = 'status-badge';
    overallStatus.classList.add(status.toLowerCase());
    badgeText.textContent = status;
}

/**
 * Format Timestamp
 */
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

    return date.toLocaleString();
}

/**
 * Play Notification Sound
 */
function playNotificationSound() {
    // Create a simple beep using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Audio notification not available');
    }
}

/**
 * Load Recent Alerts on Page Load
 */
async function loadRecentAlerts() {
    try {
        const response = await fetch(`${BACKEND_URL}/alerts?limit=10`);
        const data = await response.json();

        if (data.alerts && data.alerts.length > 0) {
            emptyState.style.display = 'none';

            data.alerts.reverse().forEach(alert => {
                const alertCard = createAlertCard(alert);
                alertsContainer.appendChild(alertCard);

                // Update counts
                alertCount++;
                if (alert.final_status === 'DANGER') {
                    dangerCount++;
                } else {
                    safeCount++;
                }
            });

            updateStats();

            // Set overall status based on most recent alert
            if (data.alerts[0].final_status === 'DANGER') {
                updateOverallStatus('DANGER');
            }

            // Trigger show animation
            setTimeout(() => {
                document.querySelectorAll('.alert-card').forEach(card => {
                    card.classList.add('show');
                });
            }, 100);
        }
    } catch (error) {
        console.error('Error loading recent alerts:', error);
    }
}

/**
 * Initialize Dashboard
 */
function init() {
    console.log('🚂 RailGuard V2 Dashboard Initializing...');

    // Load recent alerts
    loadRecentAlerts();

    // Connect to SSE
    initSSE();

    console.log('✅ Dashboard Ready');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
