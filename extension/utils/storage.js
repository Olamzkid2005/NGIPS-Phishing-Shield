const DEFAULT_STORAGE = {
  stats: {
    totalChecked: 0,
    blockedCount: 0,
    allowedCount: 0
  },
  whitelist: [],
  settings: {
    enabled: true,
    blockThreshold: 0.7,
    showNotifications: true
  }
};

class StorageManager {
  constructor() {
    this.storage = chrome.storage.local;
  }

  get(key) {
    return new Promise((resolve, reject) => {
      this.storage.get(key, (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(data[key] ?? DEFAULT_STORAGE[key] ?? null);
        }
      });
    });
  }

  set(key, value) {
    return new Promise((resolve, reject) => {
      this.storage.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  }

  getAll() {
    return new Promise((resolve, reject) => {
      this.storage.get(null, (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ ...DEFAULT_STORAGE, ...data });
        }
      });
    });
  }

  clear() {
    return new Promise((resolve, reject) => {
      this.storage.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  }

  async getStats() {
    return this.get('stats');
  }

  async setStats(stats) {
    return this.set('stats', stats);
  }

  async getWhitelist() {
    return this.get('whitelist');
  }

  async setWhitelist(whitelist) {
    return this.set('whitelist', whitelist);
  }

  async addToWhitelist(domain) {
    const whitelist = await this.getWhitelist();
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      return this.setWhitelist(whitelist);
    }
  }

  async removeFromWhitelist(domain) {
    const whitelist = await this.getWhitelist();
    const filtered = whitelist.filter(d => d !== domain);
    return this.setWhitelist(filtered);
  }

  async getSettings() {
    return this.get('settings');
  }

  async setSettings(settings) {
    return this.set('settings', settings);
  }
}

const storageManager = new StorageManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager, storageManager, DEFAULT_STORAGE };
}