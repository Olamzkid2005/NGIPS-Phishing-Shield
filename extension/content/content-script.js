let overlayInjected = false;

function injectOverlay(data) {
  if (overlayInjected) return;

  const overlay = document.createElement('div');
  overlay.id = 'phishing-warning-overlay';
  overlay.innerHTML = `
    <div class="phishing-warning-container">
      <div class="phishing-warning-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L3 7V12C3 16.97 6.84 21.77 12 23C17.16 21.77 21 16.97 21 12V7L12 2Z" fill="#FF5722"/>
          <path d="M12 8V12M12 16H12.01" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 class="phishing-warning-title">Phishing Threat Detected</h1>
      <p class="phishing-warning-message">
        This URL has been identified as a potential phishing threat.
      </p>
      <div class="phishing-warning-details">
        <div class="detail-row">
          <span class="detail-label">URL:</span>
          <span class="detail-value">${escapeHtml(data.url)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Threat Type:</span>
          <span class="detail-value">${escapeHtml(data.threatType || 'phishing')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Confidence:</span>
          <span class="detail-value">${((data.confidence || 0) * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div class="red-flags-section">
        <h3>Red Flags Detected:</h3>
        <ul class="red-flags-list">
          ${(data.redFlags || []).map(flag => `
            <li class="red-flag-item">
              <span class="red-flag-icon">⚠️</span>
              <span class="red-flag-text">${escapeHtml(flag)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="threat-level-badge ${['low', 'medium', 'high', 'critical'].includes(data.threatLevel) ? data.threatLevel : 'high'}">
        ${(['low', 'medium', 'high', 'critical'].includes(data.threatLevel) ? data.threatLevel : 'high').toUpperCase()} THREAT
      </div>
      <div class="confidence-section">
        <div class="confidence-label">ML Confidence: ${((data.mlConfidence || data.confidence || 0) * 100).toFixed(1)}%</div>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width: ${((data.mlConfidence || data.confidence || 0) * 100).toFixed(1)}%"></div>
        </div>
      </div>
      <div class="phishing-warning-actions">
        <button id="go-back-btn" class="warning-btn secondary">Go Back</button>
        <button id="report-fp-btn" class="warning-btn secondary">Report False Positive</button>
        <button id="proceed-anyway-btn" class="warning-btn primary">Proceed Anyway</button>
      </div>
      <p class="phishing-warning-disclaimer">
        Warning: Proceeding may put your personal information at risk.
      </p>
    </div>
  `;

  document.body.appendChild(overlay);
  overlayInjected = true;

  document.getElementById('go-back-btn').addEventListener('click', () => {
    window.history.back();
  });

  document.getElementById('proceed-anyway-btn').addEventListener('click', () => {
    const domain = new URL(data.url).hostname;
    chrome.runtime.sendMessage({ type: 'ADD_TO_WHITELIST', domain });
    overlay.remove();
    overlayInjected = false;
  });

  document.getElementById('report-fp-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'REPORT_FALSE_POSITIVE',
      url: data.url,
      scanId: data.scanId || data.url,
      comment: 'User reported false positive',
      threatType: data.threatType,
      confidence: data.confidence
    }, (response) => {
      const btn = document.getElementById('report-fp-btn');
      if (response && response.success) {
        btn.textContent = 'Reported - Thank You';
        btn.disabled = true;
        btn.style.opacity = '0.6';
      } else {
        btn.textContent = 'Report Failed - Retry';
        setTimeout(() => { btn.textContent = 'Report False Positive'; }, 2000);
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function removeOverlay() {
  const overlay = document.getElementById('phishing-warning-overlay');
  if (overlay) {
    overlay.remove();
    overlayInjected = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BLOCK_WARNING') {
    injectOverlay({
      url: message.url,
      threatType: message.threatType,
      confidence: message.confidence,
      mlConfidence: message.mlConfidence,
      threatLevel: message.threatLevel,
      redFlags: message.redFlags
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SHOW_WARNING') {
    injectOverlay({
      url: message.url,
      threatType: 'unknown',
      confidence: 0,
      threatLevel: 'warning',
      redFlags: [message.message || 'Unable to verify URL safety.']
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'REMOVE_OVERLAY') {
    removeOverlay();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_TAB_STATUS') {
    sendResponse({ blocked: false });
    return false;
  }

  return false;
});

function initTabStatus() {
  chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (response && response.blocked) {
      injectOverlay(response.data);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTabStatus);
} else {
  initTabStatus();
}
