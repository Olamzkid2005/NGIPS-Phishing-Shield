const API_BASE_URL = 'http://localhost:8000';
const CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_BLOCKED_THRESHOLD = 0.7;
const API_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

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
    const response = await fetchWithTimeout(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
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
    return { is_phishing: false, confidence: 0, threat_type: 'error', error: error.message };
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
      chrome.storage.local.set({ stats: currentStats }, () => resolve(currentStats));
    });
  });
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  
  const settings = await getSettings();
  if (!settings.enabled) return;
  
  const url = details.url;
  if (url.startsWith('chrome://') || url.startsWith('about:')) return;
  
  const result = await checkUrlSafety(url);
  
  if (result.is_phishing || result.confidence >= settings.blockThreshold) {
    await updateStats(true);
    
    chrome.tabs.update(details.tabId, { url: 'blocked.html' });
    
    const tab = await chrome.tabs.get(details.tabId);
    chrome.tabs.sendMessage(details.tabId, {
      type: 'BLOCK_WARNING',
      url: url,
      threatType: result.threat_type,
      confidence: result.confidence
    });
  } else {
    await updateStats(false);
  }
}, { urls: ['<all_urls>'] });

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
});

setInterval(() => {
  const now = Date.now();
  for (const [url, cached] of urlCache.entries()) {
    if (now - cached.timestamp >= CACHE_TTL_MS) {
      urlCache.delete(url);
    }
  }
}, CACHE_TTL_MS);