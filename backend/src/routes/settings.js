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
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'autoRefresh must be a boolean' } });
    }
    settings.autoRefresh = autoRefresh;
  }
  
  if (refreshInterval !== undefined) {
    const numInterval = Number(refreshInterval);
    if (isNaN(numInterval) || numInterval < 5 || numInterval > 300) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'refreshInterval must be a number between 5 and 300' } });
    }
    settings.refreshInterval = numInterval;
  }
  
  if (notifications !== undefined) {
    if (typeof notifications !== 'boolean') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'notifications must be a boolean' } });
    }
    settings.notifications = notifications;
  }
  
  if (theme !== undefined) {
    if (typeof theme !== 'string' || !['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'theme must be one of: light, dark, system' } });
    }
    settings.theme = theme;
  }
  
  return res.json(settings);
}