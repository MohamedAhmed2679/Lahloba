import { normalizePicked, type PickFile } from './filePickerTypes';

export * from './filePickerTypes';

/** Web: a hidden file input. "camera" uses capture on mobile browsers. */
export const pickFile: PickFile = (source) =>
  new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = source === 'document' ? 'application/pdf,image/jpeg,image/png' : 'image/jpeg,image/png';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try {
        resolve(normalizePicked({ bytes: new Uint8Array(await f.arrayBuffer()), mimeType: f.type || null, name: f.name }));
      } catch (e) { reject(e); }
    };
    input.click();
  });
