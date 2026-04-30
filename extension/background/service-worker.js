let API_BASE_URL = 'http://localhost:8000';
const API_PREFIX = '/v1';

// Constants
const CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_BLOCKED_THRESHOLD = 0.7;
const API_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const URL_MAX_LENGTH = 2048;

const urlCache = new Map();
const stats = {
  totalChecked: 0,
  blockedCount: 0,
  allowedCount: 0
};

async function fetchWithTimeout(url, options, timeout = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function analyzeUrlWithRetry(url, retryCount = 0) {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${API_PREFIX}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      is_phishing: data.action === 'block',
      confidence: data.confidence || 0,
      ml_confidence: data.mlConfidence || 0,
      threat_type: data.threatLevel || 'none',
      threat_level: data.threatLevel || 'low',
      reasons: data.reasons || []
    };
  } catch (error) {
    if (retryCount < MAX_RETRIES - 1) {
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return analyzeUrlWithRetry(url, retryCount + 1);
    }
    throw error;
  }
}

function isCached(url) {
  const cached = urlCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }
  urlCache.delete(url);
  return null;
}

function setCache(url, result) {
  urlCache.set(url, {
    result,
    timestamp: Date.now()
  });
}

function isWhitelisted(url, whitelist) {
  try {
    const urlObj = new URL(url);
    return whitelist.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.length > URL_MAX_LENGTH) return false;
  return /^https?:\/\//i.test(url);
}

async function checkUrlSafety(url) {
  const cached = isCached(url);
  if (cached) {
    return cached.result;
  }

  const whitelist = await getWhitelist();
  if (isWhitelisted(url, whitelist)) {
    return { is_phishing: false, confidence: 0, threat_type: 'none' };
  }

  try {
    const result = await analyzeUrlWithRetry(url);
    setCache(url, result);
    return result;
  } catch (error) {
    console.error('URL analysis failed:', error);
    return { is_phishing: false, confidence: 0, threat_type: 'unknown', error: error.message, apiError: true };
  }
}

async function getWhitelist() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['whitelist'], (data) => {
      resolve(data.whitelist || []);
    });
  });
}

async function addToWhitelist(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['whitelist'], (data) => {
      const whitelist = data.whitelist || [];
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        chrome.storage.local.set({ whitelist }, () => resolve());
      } else {
        resolve();
      }
    });
  });
}

async function removeFromWhitelist(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['whitelist'], (data) => {
      const whitelist = (data.whitelist || []).filter(d => d !== domain);
      chrome.storage.local.set({ whitelist }, () => resolve());
    });
  });
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (data) => {
      resolve(data.settings || { enabled: true, blockThreshold: DEFAULT_BLOCKED_THRESHOLD });
    });
  });
}

async function getStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['stats'], (data) => {
      resolve(data.stats || stats);
    });
  });
}

async function updateStats(blocked) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['stats'], (data) => {
      const currentStats = data.stats || stats;
      currentStats.totalChecked++;
      if (blocked) {
        currentStats.blockedCount++;
      } else {
        currentStats.allowedCount++;
      }
      chrome.storage.local.set({ stats: currentStats }, () => {
        chrome.action.setBadgeText({ text: currentStats.blockedCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#d32f2f' });
        resolve(currentStats);
      });
    });
  });
}

// Register listener synchronously (MV3 requirement)
registerNavigationListener();

// Load config asynchronously (used by handler when it runs)
chrome.storage.local.get(['apiBaseUrl'], (result) => {
  if (result.apiBaseUrl) API_BASE_URL = result.apiBaseUrl;
});

function registerNavigationListener() {
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;

    const settings = await getSettings();
    if (!settings.enabled) return;

    const url = details.url;
    if (url.startsWith('chrome://') || url.startsWith('about:')) return;
    if (!isValidUrl(url)) return;

    const result = await checkUrlSafety(url);

    if (result.is_phishing || result.confidence >= settings.blockThreshold) {
      await updateStats(true);

      const blockData = {
        url: url,
        scanId: result.id || null,
        threatType: result.threat_type,
        confidence: result.confidence,
        threatLevel: result.threat_level,
        redFlags: result.reasons,
        refId: 'SEC-PH-' + Math.random().toString(36).slice(2, 7).toUpperCase()
      };
      await chrome.storage.session.set({ [`block_${details.tabId}`]: blockData });
      chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL('blocked.html') });
    } else {
      await updateStats(false);
      // On API error, show warning page instead of silently allowing
      if (result.apiError) {
        const blockData = {
          url: url,
          threatType: 'unknown',
          confidence: 0,
          threatLevel: 'warning',
          redFlags: ['Unable to verify URL safety - API unavailable'],
          refId: 'SEC-PH-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
          apiError: true
        };
        await chrome.storage.session.set({ [`block_${details.tabId}`]: blockData });
        chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL('blocked.html') });
        return;
      }
    }
  }, { urls: ['<all_urls>'] });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_URL') {
    checkUrlSafety(message.url).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_STATS') {
    getStats().then(sendResponse);
    return true;
  }

  if (message.type === 'ADD_TO_WHITELIST') {
    addToWhitelist(message.domain).then(() => sendResponse(true));
    return true;
  }

  if (message.type === 'REMOVE_FROM_WHITELIST') {
    removeFromWhitelist(message.domain).then(() => sendResponse(true));
    return true;
  }

  if (message.type === 'GET_WHITELIST') {
    getWhitelist().then(sendResponse);
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.local.set({ settings: message.settings }, () => sendResponse(true));
    return true;
  }

  if (message.type === 'REPORT_FALSE_POSITIVE') {
    fetchWithTimeout(`${API_BASE_URL}${API_PREFIX}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scanId: message.scanId || 'unknown',
        isFalsePositive: true,
        userComment: message.comment || 'User reported false positive'
      })
    }).then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.type === 'GET_TAB_STATUS') {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.storage.session.get([`block_${tabId}`], (result) => {
        const data = result[`block_${tabId}`];
        sendResponse({ blocked: !!data, data });
      });
      return true;
    }
    sendResponse({ blocked: false });
    return false;
  }
});

chrome.alarms.create('cacheCleanup', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cacheCleanup') {
    const now = Date.now();
    for (const [url, cached] of urlCache.entries()) {
      if (now - cached.timestamp >= CACHE_TTL_MS) {
        urlCache.delete(url);
      }
    }
  }
});
