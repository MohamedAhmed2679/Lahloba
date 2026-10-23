import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { normalizePicked, type PickFile } from './filePickerTypes';

export * from './filePickerTypes';

/**
 * Native file picking for verification documents (iOS/Android).
 * Photos are re-encoded as JPEG by the picker (quality < 1), which also avoids HEIC on iOS.
 * Location metadata is removed again on the server before storage.
 */
export const pickFile: PickFile = async (source) => {
  if (source === 'document') {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets[0]) return null;
    const a = r.assets[0];
    return normalizePicked({ bytes: new Uint8Array(await new File(a.uri).arrayBuffer()), mimeType: a.mimeType ?? null, name: a.name });
  }
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw Object.assign(new Error('camera'), { code: 'PERMISSION_DENIED' });
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], quality: 0.8, exif: false, allowsEditing: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  return normalizePicked({ bytes: new Uint8Array(await new File(a.uri).arrayBuffer()), mimeType: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg' });
};
