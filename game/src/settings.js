const KEY = 'bellunoPatrol.settings.v1';

export const DEFAULTS = {
  master: 0.8,
  sfx: 1.0,
  engine: 0.8,
  sirenVol: 0.7,
  mouseSens: 1.0,
  padSens: 1.0,
  invertY: false,
  fov: 70,
  shadows: 'high', // off | low | high
  resolution: 1.0,
  viewDist: 1.0,
  showFps: false,
  crosshair: true,
  units: 'kmh',
};

export const settings = { ...DEFAULTS };

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  Object.assign(settings, saved);
} catch (e) { /* localStorage non disponibile */ }

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}
export function resetSettings() {
  Object.assign(settings, DEFAULTS);
  saveSettings();
}
