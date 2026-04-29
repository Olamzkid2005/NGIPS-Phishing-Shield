document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    totalChecked: document.getElementById('total-checked'),
    blockedCount: document.getElementById('blocked-count'),
    allowedCount: document.getElementById('allowed-count'),
    enableToggle: document.getElementById('enable-toggle'),
    protectionText: document.getElementById('protection-text'),
    whitelistInput: document.getElementById('whitelist-input'),
    addWhitelistBtn: document.getElementById('add-whitelist-btn'),
    whitelistList: document.getElementById('whitelist-list'),
    whitelistCount: document.getElementById('whitelist-count'),
    threatBadge: document.getElementById('threat-badge'),
    threatDetails: document.getElementById('threat-details'),
    threatCard: document.getElementById('threat-card'),
    scanBtn: document.getElementById('scan-btn'),
    mlStatus: document.getElementById('ml-status'),
    mlDot: document.getElementById('ml-dot'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text')
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load stats
  async function loadStats() {
    try {
      const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      if (stats) {
        elements.totalChecked.textContent = stats.totalChecked || 0;
        elements.blockedCount.textContent = stats.blockedCount || 0;
        elements.allowedCount.textContent = stats.allowedCount || 0;
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  // Load settings
  async function loadSettings() {
    try {
      const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (settings) {
        elements.enableToggle.checked = settings.enabled !== false;
        elements.protectionText.textContent = settings.enabled !== false ? 'ON' : 'OFF';
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  // Load whitelist
  async function loadWhitelist() {
    try {
      const whitelist = await chrome.runtime.sendMessage({ type: 'GET_WHITELIST' });
      renderWhitelist(whitelist || []);
    } catch (error) {
      console.error('Failed to load whitelist:', error);
      renderWhitelist([]);
    }
  }

  function renderWhitelist(whitelist) {
    elements.whitelistCount.textContent = whitelist.length;
    
    if (whitelist.length === 0) {
      elements.whitelistList.innerHTML = '<div class="empty-state text-center py-4 text-slate-400 text-sm">No whitelisted domains</div>';
      return;
    }
    
    elements.whitelistList.innerHTML = whitelist.map(domain => `
      <div class="flex items-center justify-between bg-surface-container-low px-3 py-2 rounded-lg group">
        <span class="text-sm font-medium text-on-surface">${escapeHtml(domain)}</span>
        <span class="material-symbols-outlined text-error opacity-0 group-hover:opacity-100 cursor-pointer text-[16px]" data-domain="${escapeHtml(domain)}">delete</span>
      </div>
    `).join('');
    
    elements.whitelistList.querySelectorAll('[data-domain]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const domain = btn.dataset.domain;
        await chrome.runtime.sendMessage({ type: 'REMOVE_FROM_WHITELIST', domain });
        loadWhitelist();
      });
    });
  }

  // Check current page threat status
  async function checkCurrentPageThreat() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || /^(chrome|about|edge|brave|chrome-extension):/.test(tab.url)) return;

      const response = await chrome.runtime.sendMessage({ type: 'CHECK_URL', url: tab.url });
      updateThreatDisplay(response);
    } catch (error) {
      console.error('Failed to check page threat:', error);
    }
  }

  function updateThreatDisplay(result) {
    if (!result) return;

    if (result.is_phishing) {
      const level = result.threat_level || 'high';
      elements.threatBadge.textContent = level.toUpperCase();
      elements.threatBadge.className = `px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
        level === 'critical' ? 'bg-red-100 text-red-700' :
        level === 'high' ? 'bg-orange-100 text-orange-700' :
        level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
        'bg-green-100 text-green-700'
      }`;
      
      elements.threatCard.className = `bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden ${
        level === 'critical' || level === 'high' ? 'status-strip-danger' :
        level === 'medium' ? 'status-strip-warning' : 'status-strip-safe'
      }`;
      
      elements.threatDetails.innerHTML = `
        <span class="material-symbols-outlined text-error text-[32px]">warning</span>
        <div>
          <p class="text-on-surface font-medium">Phishing detected</p>
          <div class="mt-1 space-y-1">
            ${(result.reasons || []).slice(0, 2).map(r => `<div class="text-xs text-slate-500 border-l-2 border-orange-400 pl-2">${escapeHtml(r)}</div>`).join('')}
          </div>
        </div>
      `;
    } else {
      elements.threatBadge.textContent = 'SAFE';
      elements.threatBadge.className = 'px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold tracking-wider';
      elements.threatCard.className = 'bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden status-strip-safe';
      elements.threatDetails.innerHTML = `
        <span class="material-symbols-outlined text-green-500 text-[32px]">check_circle</span>
        <p class="text-on-surface font-medium">No threats detected</p>
      `;
    }
  }

  // Load ML status
  async function loadMLStatus() {
    try {
      const settings = await chrome.storage.local.get(['apiBaseUrl']);
      const baseUrl = settings.apiBaseUrl || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        if (elements.mlStatus) {
          elements.mlStatus.textContent = data.models?.status === 'loaded' ? 'Active' : 'Unavailable';
          elements.mlDot.className = `w-2 h-2 rounded-full ${data.models?.status === 'loaded' ? 'bg-green-500' : 'bg-yellow-500'}`;
        }
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      if (elements.mlStatus) {
        elements.mlStatus.textContent = 'Offline';
        elements.mlDot.className = 'w-2 h-2 rounded-full bg-red-500';
      }
    }
  }

  // Toggle handler
  elements.enableToggle.addEventListener('change', async () => {
    const enabled = elements.enableToggle.checked;
    elements.protectionText.textContent = enabled ? 'ON' : 'OFF';
    
    const currentSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { ...currentSettings, enabled }
    });
  });

  // Scan button
  elements.scanBtn.addEventListener('click', async () => {
    elements.scanBtn.disabled = true;
    elements.scanBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Scanning...';
    
    await checkCurrentPageThreat();
    
    elements.scanBtn.disabled = false;
    elements.scanBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">search</span> Scan Current Page';
  });

  // Whitelist add
  elements.addWhitelistBtn.addEventListener('click', async () => {
    const domain = elements.whitelistInput.value.trim();
    if (!domain) return;
    
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain)) {
      alert('Please enter a valid domain (e.g., example.com)');
      return;
    }
    
    await chrome.runtime.sendMessage({ type: 'ADD_TO_WHITELIST', domain });
    elements.whitelistInput.value = '';
    loadWhitelist();
  });

  elements.whitelistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.addWhitelistBtn.click();
    }
  });

  // Initialize
  await loadStats();
  await loadSettings();
  await loadWhitelist();
  await loadMLStatus();
  await checkCurrentPageThreat();
});
