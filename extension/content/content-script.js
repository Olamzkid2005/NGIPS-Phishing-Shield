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
      <div class="phishing-warning-actions">
        <button id="go-back-btn" class="warning-btn secondary">Go Back</button>
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
    overlay.remove();
    overlayInjected = false;
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
      confidence: message.confidence
    });
    sendResponse({ success: true });
  }
  
  if (message.type === 'REMOVE_OVERLAY') {
    removeOverlay();
    sendResponse({ success: true });
  }
  
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS' }, (response) => {
      if (response && response.blocked) {
        injectOverlay(response.data);
      }
    });
  });
} else {
  chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS' }, (response) => {
    if (response && response.blocked) {
      injectOverlay(response.data);
    }
  });
}