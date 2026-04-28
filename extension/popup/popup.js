document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    totalChecked: document.getElementById('total-checked'),
    blockedCount: document.getElementById('blocked-count'),
    allowedCount: document.getElementById('allowed-count'),
    enableToggle: document.getElementById('enable-toggle'),
    whitelistInput: document.getElementById('whitelist-input'),
    addWhitelistBtn: document.getElementById('add-whitelist-btn'),
    whitelistList: document.getElementById('whitelist-list'),
    whitelistCount: document.getElementById('whitelist-count')
  };

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

  async function loadSettings() {
    try {
      const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (settings) {
        elements.enableToggle.checked = settings.enabled !== false;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

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
    elements.whitelistCount.textContent = `${whitelist.length} domain${whitelist.length !== 1 ? 's' : ''}`;
    
    if (whitelist.length === 0) {
      elements.whitelistList.innerHTML = '<div class="empty-state">No whitelisted domains</div>';
      return;
    }
    
    elements.whitelistList.innerHTML = whitelist.map(domain => `
      <div class="whitelist-item">
        <span class="whitelist-domain">${escapeHtml(domain)}</span>
        <button class="remove-btn" data-domain="${escapeHtml(domain)}">&times;</button>
      </div>
    `).join('');
    
    elements.whitelistList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const domain = btn.dataset.domain;
        await chrome.runtime.sendMessage({ type: 'REMOVE_FROM_WHITELIST', domain });
        loadWhitelist();
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  elements.enableToggle.addEventListener('change', async () => {
    const enabled = elements.enableToggle.checked;
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { enabled }
    });
  });

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

  await loadStats();
  await loadSettings();
  await loadWhitelist();
});