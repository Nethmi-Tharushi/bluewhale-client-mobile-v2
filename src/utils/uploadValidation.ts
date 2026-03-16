import * as FileSystem from 'expo-file-system/legacy';

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_LABEL = '5 MB';

type UploadValidationFile = {
  uri?: string | null;
  name?: string | null;
  size?: number | null;
};

const createUploadSizeError = (fileName?: string | null) => {
  const safeName = String(fileName || 'Selected file').trim() || 'Selected file';
  const err: any = new Error(`${safeName} exceeds the ${MAX_UPLOAD_SIZE_LABEL} limit. Please choose a smaller file.`);
  err.userMessage = err.message;
  err.code = 'FILE_TOO_LARGE';
  return err;
};

export const isUploadTooLarge = (size?: number | null) => {
  const normalized = Number(size);
  return Number.isFinite(normalized) && normalized > MAX_UPLOAD_SIZE_BYTES;
};

const resolveUploadSize = async (file: UploadValidationFile) => {
  const explicitSize = Number(file?.size);
  if (Number.isFinite(explicitSize) && explicitSize >= 0) return explicitSize;

  const uri = String(file?.uri || '').trim();
  if (!uri) return null;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info?.exists) return null;

    const resolvedSize = Number((info as any)?.size);
    return Number.isFinite(resolvedSize) && resolvedSize >= 0 ? resolvedSize : null;
  } catch {
    return null;
  }
};

export const ensureUploadSizeWithinLimit = async (file: UploadValidationFile) => {
  const size = await resolveUploadSize(file);
  if (isUploadTooLarge(size)) throw createUploadSizeError(file?.name);
  return size;
};

export const ensureUploadBatchWithinLimit = async (files: UploadValidationFile[]) => {
  for (const file of files || []) {
    await ensureUploadSizeWithinLimit(file);
  }
};
