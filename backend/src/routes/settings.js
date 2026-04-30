/**
 * Settings Routes - GET/PUT /v1/settings
 */

import { ValidationError } from '../utils/errors.js';

const defaultSettings = {
  autoRefresh: true,
  refreshInterval: 30,
  notifications: true,
  theme: 'dark'
};

let settings = { ...defaultSettings };

/**
 * GET /v1/settings - Get current settings
 */
export async function getSettingsHandler(req, res) {
  return res.json(settings);
}

/**
 * PUT /v1/settings - Update settings
 */
export async function updateSettingsHandler(req, res) {
  const { autoRefresh, refreshInterval, notifications, theme } = req.body;
  
  if (autoRefresh !== undefined) {
    if (typeof autoRefresh !== 'boolean') {
      throw new ValidationError('autoRefresh must be a boolean');
    }
    settings.autoRefresh = autoRefresh;
  }
  
  if (refreshInterval !== undefined) {
    const numInterval = Number(refreshInterval);
    if (isNaN(numInterval) || numInterval < 5 || numInterval > 300) {
      throw new ValidationError('refreshInterval must be a number between 5 and 300');
    }
    settings.refreshInterval = numInterval;
  }
  
  if (notifications !== undefined) {
    if (typeof notifications !== 'boolean') {
      throw new ValidationError('notifications must be a boolean');
    }
    settings.notifications = notifications;
  }
  
  if (theme !== undefined) {
    if (typeof theme !== 'string' || !['light', 'dark', 'system'].includes(theme)) {
      throw new ValidationError('theme must be one of: light, dark, system');
    }
    settings.theme = theme;
  }
  
  return res.json(settings);
}