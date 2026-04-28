const API_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async fetchWithTimeout(url, options, timeout = API_TIMEOUT_MS) {
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

  async analyzeUrl(url) {
    return this.requestWithRetry('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
  }

  async requestWithRetry(endpoint, options, retryCount = 0) {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}${endpoint}`,
        options
      );

      if (!response.ok && retryCount < MAX_RETRIES - 1) {
        const delay = Math.pow(2, retryCount) * 1000;
        await this.sleep(delay);
        return this.requestWithRetry(endpoint, options, retryCount + 1);
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retryCount < MAX_RETRIES - 1) {
        const delay = Math.pow(2, retryCount) * 1000;
        await this.sleep(delay);
        return this.requestWithRetry(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const apiClient = new ApiClient('http://localhost:8000');

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiClient, apiClient, API_TIMEOUT_MS, MAX_RETRIES };
}