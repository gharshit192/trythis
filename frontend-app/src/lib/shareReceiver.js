import { Capacitor, registerPlugin } from '@capacitor/core';

// Native share bridge (Android ShareReceiverPlugin). On the web this is inert:
// the PWA's share_target path in App.js does the same job.
const ShareReceiver = registerPlugin('ShareReceiver');
export const isNative = () => Capacitor.isNativePlatform();

// Normalise what Android hands us into the shape share-intake already understands.
const normalise = (d) => {
  if (!d || (!d.text && !d.subject && !(d.images || []).length)) return null;
  const text = String(d.text || '').trim();
  const title = String(d.subject || '').trim();
  const url = (text.match(/https?:\/\/\S+/) || [])[0] || (title.match(/https?:\/\/\S+/) || [])[0] || '';
  const images = (d.images || []).filter((i) => i && i.base64).map((i, k) => ({ mimeType: i.mimeType || 'image/jpeg', base64: i.base64, name: `shared-${k + 1}.${(i.mimeType || 'image/jpeg').split('/')[1] || 'jpg'}` }));
  return { url, text, title, images };
};

// The share that launched (or resumed) the app, once.
export async function consumeNativeShare() {
  if (!isNative()) return null;
  try { return normalise(await ShareReceiver.checkIntent()); } catch { return null; }
}

// Shares that arrive while the app is already open.
export function onNativeShare(cb) {
  if (!isNative()) return () => {};
  const h = ShareReceiver.addListener('shareReceived', (d) => { const s = normalise(d); if (s) cb(s); });
  return () => { Promise.resolve(h).then((x) => x?.remove?.()); };
}

// base64 → File, for the existing multipart upload.
export const imagesToFiles = (images = []) => images.map((i) => {
  const bin = atob(i.base64); const bytes = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  return new File([bytes], i.name, { type: i.mimeType });
});
