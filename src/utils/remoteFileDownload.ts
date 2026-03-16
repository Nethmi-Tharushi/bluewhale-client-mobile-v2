import * as FileSystem from 'expo-file-system/legacy';

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  txt: 'text/plain',
};

const normalizeMimeType = (value?: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();

const URL_KEYS = [
  'url',
  'fileUrl',
  'downloadUrl',
  'documentUrl',
  'secure_url',
  'secureUrl',
  'path',
  'location',
  'link',
  'src',
  'href',
];

const headerValue = (headers: Record<string, string> | undefined, key: string) => {
  if (!headers) return '';
  const match = Object.keys(headers).find((name) => name.toLowerCase() === key.toLowerCase());
  return match ? String(headers[match] || '').trim() : '';
};

const stripQuery = (value: string) =>
  String(value || '')
    .trim()
    .split('?')[0]
    .split('#')[0];

const fileNameFromValue = (value: string) => {
  const cleaned = stripQuery(value);
  const segment = cleaned.split('/').pop() || '';
  return decodeURIComponent(segment);
};

const extensionFromName = (value: string) => {
  const name = stripQuery(value);
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  const ext = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/i.test(ext) ? ext : '';
};

const filenameFromContentDisposition = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const utfMatch = raw.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]).replace(/^["']|["']$/g, '');
    } catch {
      return utfMatch[1].replace(/^["']|["']$/g, '');
    }
  }

  const basicMatch = raw.match(/filename\s*=\s*("?)([^";]+)\1/i);
  return basicMatch?.[2] ? basicMatch[2].trim() : '';
};

const sanitizeFileName = (value: string, fallbackBase: string, extension: string) => {
  const raw =
    String(value || '')
      .trim()
      .replace(/[^\w.\-]+/g, '_')
      .replace(/^_+|_+$/g, '') || fallbackBase;
  return extensionFromName(raw) ? raw : `${raw}.${extension}`;
};

const looksLikeBinaryPdfText = (value: string) => String(value || '').trimStart().startsWith('%PDF-');
const looksLikePdfBase64 = (value: string) => String(value || '').trimStart().startsWith('JVBERi0');

const readTextFileSafe = async (uri: string) => {
  try {
    return await FileSystem.readAsStringAsync(uri);
  } catch {
    return '';
  }
};

const readBase64FileSafe = async (uri: string) => {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
    });
  } catch {
    return '';
  }
};

const extractUrlValue = (payload: any): string => {
  if (!payload) return '';
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (/^(https?:\/\/|\/)/i.test(trimmed)) return trimmed;
    const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
    return match?.[0] || '';
  }
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractUrlValue(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof payload !== 'object') return '';

  for (const key of URL_KEYS) {
    const candidate = payload?.[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  for (const value of Object.values(payload)) {
    const found = extractUrlValue(value);
    if (found) return found;
  }

  return '';
};

const extractRedirectUrlFromText = (text: string) => {
  const trimmed = String(text || '').trim();
  if (!trimmed || looksLikeBinaryPdfText(trimmed)) return '';

  try {
    const parsed = JSON.parse(trimmed);
    const url = extractUrlValue(parsed);
    if (url) return url;
  } catch {
    // Continue with plain-text/HTML extraction.
  }

  const direct = extractUrlValue(trimmed);
  if (direct) return direct;

  const hrefMatch = trimmed.match(/(?:href|src)\s*=\s*["']([^"']+)["']/i);
  return hrefMatch?.[1] || '';
};

export const extensionFromMimeType = (mimeType?: string) => {
  const mime = normalizeMimeType(mimeType);
  if (!mime) return '';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('msword')) return 'doc';
  if (mime.includes('wordprocessingml')) return 'docx';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('text/plain')) return 'txt';
  return '';
};

export const mimeTypeFromExtension = (extension?: string) => {
  const ext = String(extension || '').trim().toLowerCase();
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
};

type DownloadResolvedFileOptions = {
  url: string;
  targetDir: string;
  fileName?: string;
  fallbackBaseName?: string;
  fallbackExtension?: string;
  fallbackMimeType?: string;
  headers?: Record<string, string>;
  toAbsoluteUrl?: (raw: string) => string;
  maxResolvePasses?: number;
};

type DownloadResolvedFileResult = {
  uri: string;
  fileName: string;
  extension: string;
  mimeType: string;
  sourceUrl: string;
};

export const downloadResolvedRemoteFile = async ({
  url,
  targetDir,
  fileName,
  fallbackBaseName = 'download',
  fallbackExtension = 'bin',
  fallbackMimeType,
  headers,
  toAbsoluteUrl,
  maxResolvePasses = 2,
}: DownloadResolvedFileOptions): Promise<DownloadResolvedFileResult> => {
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true }).catch(() => undefined);

  let activeUrl = String(url || '').trim();
  if (!activeUrl) throw new Error('Missing download URL.');

  for (let pass = 0; pass <= maxResolvePasses; pass += 1) {
    const tempPath = `${targetDir}/tmp-${Date.now()}-${pass}.tmp`;
    const result = await FileSystem.downloadAsync(activeUrl, tempPath, headers ? { headers } : undefined);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`File download failed (${result.status}).`);
    }

    const contentType = normalizeMimeType(headerValue((result as any)?.headers, 'content-type'));
    const contentDisposition = headerValue((result as any)?.headers, 'content-disposition');
    const info = await FileSystem.getInfoAsync(result.uri).catch(() => null);
    const smallPayload = Number((info as any)?.size || 0) > 0 && Number((info as any)?.size || 0) <= 65536;
    const expectsPdf =
      String(fallbackExtension || '').toLowerCase() === 'pdf' ||
      String(fallbackMimeType || '').toLowerCase().includes('pdf') ||
      String(fileName || '').toLowerCase().endsWith('.pdf') ||
      contentType.includes('pdf');
    const likelyTextPayload =
      !contentType ||
      contentType.includes('json') ||
      contentType.includes('text/') ||
      contentType.includes('html') ||
      (smallPayload && !['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif'].includes(extensionFromName(fileName || activeUrl)));

    let textPayload = '';
    if (likelyTextPayload) {
      textPayload = await readTextFileSafe(result.uri);
      const redirectedUrl = extractRedirectUrlFromText(textPayload);
      if (redirectedUrl && pass < maxResolvePasses) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        activeUrl = toAbsoluteUrl ? toAbsoluteUrl(redirectedUrl) : redirectedUrl;
        continue;
      }
    }

    const resolvedFileName =
      filenameFromContentDisposition(contentDisposition) ||
      String(fileName || '').trim() ||
      fileNameFromValue(activeUrl) ||
      `${fallbackBaseName}.${fallbackExtension}`;
    const resolvedExtension =
      extensionFromName(resolvedFileName) ||
      extensionFromMimeType(contentType) ||
      extensionFromName(activeUrl) ||
      fallbackExtension;

    if (expectsPdf || resolvedExtension === 'pdf') {
      const pdfText = textPayload || (await readTextFileSafe(result.uri));
      const redirectedUrl = extractRedirectUrlFromText(pdfText);
      if (redirectedUrl && pass < maxResolvePasses) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        activeUrl = toAbsoluteUrl ? toAbsoluteUrl(redirectedUrl) : redirectedUrl;
        continue;
      }
      const pdfBase64 = await readBase64FileSafe(result.uri);
      const validPdf = looksLikeBinaryPdfText(pdfText) || looksLikePdfBase64(pdfBase64) || contentType.includes('pdf');
      if (!validPdf) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        throw new Error('Downloaded file is not a valid PDF yet. The server returned a non-PDF response.');
      }
    }

    const safeFileName = sanitizeFileName(resolvedFileName, fallbackBaseName, resolvedExtension);
    const finalPath = `${targetDir}/${Date.now()}-${safeFileName}`;
    await FileSystem.copyAsync({ from: result.uri, to: finalPath });
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);

    const resolvedMimeType =
      contentType && contentType !== 'application/octet-stream'
        ? contentType
        : normalizeMimeType(fallbackMimeType) || mimeTypeFromExtension(resolvedExtension);

    return {
      uri: finalPath,
      fileName: safeFileName,
      extension: resolvedExtension,
      mimeType: resolvedMimeType,
      sourceUrl: activeUrl,
    };
  }

  throw new Error('Unable to resolve the downloaded file.');
};
