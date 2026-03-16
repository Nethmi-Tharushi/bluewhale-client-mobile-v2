import * as FileSystem from 'expo-file-system/legacy';
import { api, ensureApiReady, isRetryableRequestError } from './client';
import { Endpoints } from './endpoints';
import { getToken } from '../utils/tokenStorage';
import { ensureUploadBatchWithinLimit, ensureUploadSizeWithinLimit } from '../utils/uploadValidation';
import type { Application, ChatAdmin, ChatMessage, DocumentGroups, Inquiry, Invoice, Job, Meeting, Task, TaskFile, UserDocument } from '../types/models';

type UploadableFile = {
  uri: string;
  name: string;
  type?: string;
  size?: number | null;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

const DOCUMENT_ALLOWED_MIME: Record<'photo' | 'passport' | 'drivingLicense' | 'cv', string[]> = {
  photo: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  passport: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  drivingLicense: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  cv: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryOnceAfterWarmup = async <T,>(request: () => Promise<T>) => {
  await ensureApiReady({ timeoutMs: 45000, background: true }).catch(() => undefined);

  try {
    return await request();
  } catch (err) {
    if (!isRetryableRequestError(err)) throw err;

    await ensureApiReady({ force: true, timeoutMs: 45000, background: true }).catch(() => undefined);
    await wait(1200);
    return request();
  }
};

// ---- helpers ----
const unwrap = <T,>(res: any): T => {
  // backend may return {data}, {items}, {result} etc
  return (res?.data?.data ?? res?.data?.items ?? res?.data?.result ?? res?.data) as T;
};

const toAbsoluteUrl = (value: string) => {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
  if (!base) return v;
  return v.startsWith('/') ? `${base}${v}` : `${base}/${v}`;
};

const looksLikeFileName = (v: string) => /\.[a-z0-9]{2,6}($|\?)/i.test(v) && !/^https?:\/\//i.test(v);

const maybeFileNameToUrl = (value: string) => {
  const v = String(value || '').trim();
  if (!v) return '';
  if (looksLikeFileName(v) && !v.includes('/')) return toAbsoluteUrl(`/uploads/${v}`);
  return toAbsoluteUrl(v);
};

const getFileExtension = (value: string) => {
  const cleaned = String(value || '')
    .trim()
    .split('?')[0]
    .split('#')[0];
  const dot = cleaned.lastIndexOf('.');
  return dot >= 0 ? cleaned.slice(dot + 1).toLowerCase() : '';
};

const fileNameFromContentDisposition = (value: string) => {
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

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  const BufferCtor = (globalThis as any)?.Buffer;
  if (BufferCtor) return BufferCtor.from(binary, 'binary').toString('base64');
  throw new Error('Base64 encoding is not available in this environment.');
};

const bytesToText = (bytes: Uint8Array) => {
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return Array.from(bytes)
      .map((byte) => String.fromCharCode(byte))
      .join('');
  }
};

const normalizeBinaryPayload = (payload: any): Uint8Array => {
  if (!payload) return new Uint8Array();
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  if (ArrayBuffer.isView(payload)) return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  if (typeof payload === 'string') return Uint8Array.from(payload, (char) => char.charCodeAt(0) & 0xff);
  if (Array.isArray(payload)) return Uint8Array.from(payload);
  return new Uint8Array();
};

const inferMimeType = (file: Pick<UploadableFile, 'name' | 'uri' | 'type'>, fallback?: string) => {
  const explicit = String(file?.type || '').trim().toLowerCase();
  if (explicit && explicit !== 'application/octet-stream' && explicit !== '*/*') return explicit;

  const ext = getFileExtension(file?.name || '') || getFileExtension(file?.uri || '');
  if (ext && MIME_BY_EXTENSION[ext]) return MIME_BY_EXTENSION[ext];
  return fallback || 'application/octet-stream';
};

const ensureUploadableUri = async (file: UploadableFile) => {
  const originalUri = String(file?.uri || '').trim();
  if (!originalUri) return file;
  if (/^file:\/\//i.test(originalUri)) {
    return { ...file, type: inferMimeType(file) };
  }

  const extension = getFileExtension(file?.name || '') || getFileExtension(originalUri);
  const safeExtension = extension || 'bin';
  const safeName = String(file?.name || `upload-${Date.now()}.${safeExtension}`)
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const target = `${FileSystem.cacheDirectory || ''}uploads/${Date.now()}-${safeName || `file.${safeExtension}`}`;

  try {
    const dir = target.slice(0, target.lastIndexOf('/'));
    if (dir) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    }
    await FileSystem.copyAsync({ from: originalUri, to: target });
    return {
      ...file,
      uri: target,
      name: safeName || file.name,
      type: inferMimeType({ ...file, uri: target }),
    };
  } catch {
    return { ...file, type: inferMimeType(file) };
  }
};

const normalizeUploadFiles = async (files: UploadableFile[], fallbackMime?: string) => {
  const normalized = await Promise.all(
    (files || []).map(async (file) => {
      const prepared = await ensureUploadableUri(file);
      await ensureUploadSizeWithinLimit(prepared);
      return {
        ...prepared,
        type: inferMimeType(prepared, fallbackMime),
      };
    })
  );
  return normalized.filter((file) => !!String(file?.uri || '').trim());
};

const normalizeDocumentUploadFiles = async (
  docType: 'photo' | 'passport' | 'drivingLicense' | 'cv',
  files: UploadableFile[]
) => {
  const normalized = await normalizeUploadFiles(files, docType === 'cv' ? 'application/pdf' : 'image/jpeg');
  const allowed = DOCUMENT_ALLOWED_MIME[docType];

  return normalized.map((file) => {
    const explicit = String(file?.type || '').trim().toLowerCase();
    const inferred = inferMimeType(file, docType === 'cv' ? 'application/pdf' : 'image/jpeg').toLowerCase();
    const finalType =
      (allowed.includes(explicit) && explicit) ||
      (allowed.includes(inferred) && inferred) ||
      '';

    if (!finalType) {
      const name = String(file?.name || 'Selected file').trim();
      const allowedLabel = docType === 'cv' ? 'PDF, DOC, or DOCX' : 'JPG, PNG, or GIF';
      const err: any = new Error(`${name} is not a supported ${docType === 'cv' ? 'CV' : 'image'} format. Use ${allowedLabel}.`);
      err.userMessage = err.message;
      throw err;
    }

    return {
      ...file,
      type: finalType,
    };
  });
};

const extractUploadUrl = (payload: any): string | undefined => {
  if (!payload) return undefined;
  if (typeof payload === 'string') return maybeFileNameToUrl(payload);
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractUploadUrl(item);
      if (found) return found;
    }
    return undefined;
  }

  const directKeys = [
    'url',
    'fileUrl',
    'path',
    'location',
    'secure_url',
    'secureUrl',
    'link',
    'downloadUrl',
    'documentUrl',
    'documentURL',
    'documentPath',
    'filePath',
    'filepath',
    'uri',
    'src',
    'key',
    'filename',
  ];
  for (const key of directKeys) {
    const value = payload?.[key];
    if (typeof value === 'string' && value.trim()) return maybeFileNameToUrl(value);
  }

  const nestedKeys = ['data', 'result', 'file', 'upload', 'attachment', 'documents', 'document', 'files', 'attachments'];
  for (const key of nestedKeys) {
    const found = extractUploadUrl(payload?.[key]);
    if (found) return found;
  }

  // Fallback: some APIs nest file metadata under dynamic keys (e.g. documents.cv[0].url).
  if (payload && typeof payload === 'object') {
    for (const value of Object.values(payload)) {
      const found = extractUploadUrl(value);
      if (found) return found;
    }
  }

  return undefined;
};

const extractInvoices = (payload: any): Invoice[] => {
  if (Array.isArray(payload)) return payload as Invoice[];
  if (!payload || typeof payload !== 'object') return [];

  const directKeys = ['invoices', 'items', 'rows', 'docs', 'records', 'results', 'data'];
  for (const key of directKeys) {
    const value = (payload as any)?.[key];
    if (Array.isArray(value)) return value as Invoice[];
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value as Invoice[];
    if (value && typeof value === 'object') {
      const nested = extractInvoices(value);
      if (nested.length) return nested;
    }
  }

  return [];
};

const extractTasks = (payload: any): Task[] => {
  if (Array.isArray(payload)) return payload as Task[];
  if (!payload || typeof payload !== 'object') return [];

  const directKeys = ['tasks', 'items', 'rows', 'docs', 'records', 'results', 'data'];
  for (const key of directKeys) {
    const value = (payload as any)?.[key];
    if (Array.isArray(value)) return value as Task[];
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value as Task[];
    if (value && typeof value === 'object') {
      const nested = extractTasks(value);
      if (nested.length) return nested;
    }
  }

  return [];
};

const extractMeetings = (payload: any): Meeting[] => {
  if (Array.isArray(payload)) return payload as Meeting[];
  if (!payload || typeof payload !== 'object') return [];

  const directKeys = ['meetings', 'items', 'rows', 'records', 'results', 'data'];
  for (const key of directKeys) {
    const value = (payload as any)?.[key];
    if (Array.isArray(value)) return value as Meeting[];
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value as Meeting[];
    if (value && typeof value === 'object') {
      const nested = extractMeetings(value);
      if (nested.length) return nested;
    }
  }

  return [];
};

const emptyDocumentGroups = (): DocumentGroups => ({
  photo: [],
  passport: [],
  drivingLicense: [],
  cv: [],
});

const normalizeDocumentGroups = (payload: any): DocumentGroups => {
  const grouped = emptyDocumentGroups();
  const source = payload?.documents && typeof payload.documents === 'object' ? payload.documents : payload;

  if (!source || typeof source !== 'object') return grouped;

  (Object.keys(grouped) as Array<keyof DocumentGroups>).forEach((key) => {
    const value = source?.[key];
    if (Array.isArray(value)) {
      grouped[key] = value as UserDocument[];
    }
  });

  return grouped;
};

const extractTaskFiles = (payload: any): TaskFile[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as TaskFile[];
  if (typeof payload !== 'object') return [];

  const directKeys = ['files', 'items', 'uploads', 'documents', 'attachments', 'data', 'result'];
  for (const key of directKeys) {
    const value = (payload as any)?.[key];
    if (Array.isArray(value)) return value as TaskFile[];
    if (value && typeof value === 'object') {
      const nested = extractTaskFiles(value);
      if (nested.length) return nested;
    }
  }

  const directUrl = extractUploadUrl(payload);
  if (directUrl) return [payload as TaskFile];

  return [];
};

const normalizeTaskFile = (file: any): TaskFile => {
  const url = extractUploadUrl(file) || String(file?.fileUrl || file?.url || file?.path || '').trim();
  const name =
    String(file?.fileName || file?.name || file?.filename || '').trim() ||
    (url ? url.split('/').pop()?.split('?')[0] || 'Uploaded file' : 'Uploaded file');

  return {
    ...(file && typeof file === 'object' ? file : {}),
    fileName: name,
    fileUrl: url,
  } as TaskFile;
};

const normalizeInvoice = (inv: any): Invoice => {
  if (!inv || typeof inv !== 'object') return inv as Invoice;
  const normalized: any = { ...inv };
  if (!normalized._id && normalized.id) normalized._id = normalized.id;
  if (!normalized.invoiceNumber) normalized.invoiceNumber = normalized.invoiceNo || normalized.number || normalized.invoice_number;
  if (normalized.total === undefined) normalized.total = normalized.amount ?? normalized.grandTotal ?? normalized.totalAmount;
  if (!normalized.dueDate) normalized.dueDate = normalized.due || normalized.due_at;
  if (!normalized.currency) normalized.currency = normalized.currencyCode || normalized.curr || 'USD';
  return normalized as Invoice;
};

const getProfileEmail = (profile: any) =>
  String(profile?.email || profile?.user?.email || '').trim().toLowerCase();

const extractInvoiceEmail = (inv: any) =>
  String(
    inv?.customerEmail ||
      inv?.email ||
      inv?.userEmail ||
      inv?.candidateEmail ||
      inv?.customer?.email ||
      inv?.user?.email ||
      inv?.candidate?.email ||
      ''
  )
    .trim()
    .toLowerCase();

const looksLikeInvoice = (value: any) =>
  !!value &&
  typeof value === 'object' &&
  (!!value._id || !!value.invoiceNumber || value.total !== undefined || !!value.dueDate || Array.isArray(value.items));

const extractInvoice = (payload: any): Invoice | null => {
  if (!payload) return null;
  if (looksLikeInvoice(payload)) return payload as Invoice;
  if (typeof payload !== 'object') return null;

  const directKeys = ['invoice', 'data', 'result', 'item', 'doc'];
  for (const key of directKeys) {
    const value = (payload as any)?.[key];
    if (looksLikeInvoice(value)) return value as Invoice;
  }

  for (const value of Object.values(payload)) {
    const found = extractInvoice(value);
    if (found) return found;
  }

  return null;
};

const looksLikePdfPayload = (payload: any) => {
  if (!payload) return false;
  if (typeof payload === 'string') return payload.trimStart().startsWith('%PDF-');
  if (typeof ArrayBuffer !== 'undefined') {
    if (payload instanceof ArrayBuffer) return payload.byteLength > 4;
    if (ArrayBuffer.isView(payload)) return payload.byteLength > 4;
  }
  return false;
};

export const AuthService = {
  async login(email: string, password: string) {
    const res = await retryOnceAfterWarmup(() =>
      api.post(
        Endpoints.login,
        { email, password },
        {
          timeout: 45000,
        }
      )
    );
    return unwrap<{ token: string; user: any }>(res);
  },
  async signup(payload: { name: string; email: string; password: string; phone?: string; userType?: string }) {
    const resolvedUserType = payload.userType || 'candidate';
    const body = {
      ...payload,
      // Backend variants commonly expect one of these fields.
      userType: resolvedUserType,
      role: resolvedUserType,
      accountType: resolvedUserType,
    };
    const res = await api.post(Endpoints.signup, body);
    return unwrap<{ token: string; user: any }>(res);
  },
  async getProfile() {
    const res = await api.get(Endpoints.profile);
    return unwrap<any>(res);
  },
  async updateProfile(payload: any) {
    const res = await retryOnceAfterWarmup(() =>
      api.put(Endpoints.updateProfile, payload, {
        timeout: 45000,
      })
    );
    return unwrap<any>(res);
  },
  async updateProfileMultipart(form: FormData, onUploadProgress?: (progressEvent: any) => void) {
    const request = () =>
      api.put(Endpoints.updateProfile, form, {
        headers: { Accept: 'application/json' },
        onUploadProgress,
        timeout: 60000,
      });

    try {
      const res = await retryOnceAfterWarmup(request);
      return unwrap<any>(res);
    } catch (err: any) {
      if (!isRetryableRequestError(err)) throw err;

      // React Native Android can still fail generic multipart axios requests on some devices.
      const token = await getToken();
      const absoluteUrl = `${String(api.defaults.baseURL || '').replace(/\/+$/, '')}${Endpoints.updateProfile}`;
      const response = await fetch(absoluteUrl, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });

      const text = await response.text();
      let payload: any = text;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        // Keep string payload.
      }

      if (!response.ok) {
        const fallbackErr: any = new Error(
          payload?.message || payload?.error || `HTTP ${response.status}`
        );
        fallbackErr.response = { status: response.status, data: payload };
        throw fallbackErr;
      }

      return payload?.data?.data ?? payload?.data?.items ?? payload?.data?.result ?? payload;
    }
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const res = await api.post(Endpoints.changePassword, payload);
    return unwrap<any>(res);
  },
  async deleteAccount() {
    const res = await api.delete(Endpoints.deleteAccount);
    return unwrap<any>(res);
  },
  async forgotPassword(email: string) {
    const res = await api.post(Endpoints.forgotPassword, { email });
    return unwrap<any>(res);
  },
};

export const JobsService = {
  async list(params?: { q?: string; type?: string; location?: string; page?: number; limit?: number }) {
    const res = await api.get(Endpoints.jobs, { params });
    return unwrap<Job[]>(res);
  },
  async get(jobId: string) {
    const res = await api.get(Endpoints.jobById(jobId));
    return unwrap<Job>(res);
  },
};

export const UploadService = {
  async uploadFile(file: { uri: string; name: string; type?: string }) {
    await ensureUploadSizeWithinLimit(file);

    const resolveEndpointUrl = (endpoint: string) => {
      if (/^https?:\/\//i.test(endpoint)) return endpoint;
      const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
      if (!base) return endpoint;
      return endpoint.startsWith('/') ? `${base}${endpoint}` : `${base}/${endpoint}`;
    };

    const uploadWithField = async (endpoint: string, fieldName: string) => {
      const form = new FormData();
      // @ts-ignore
      form.append(fieldName, { uri: file.uri, name: file.name, type: file.type || 'application/octet-stream' });
      // Let axios/react-native set the multipart boundary automatically.
      const res = await api.post(endpoint, form, {
        headers: { Accept: 'application/json' },
        timeout: 60000,
      });
      const payload = unwrap<any>(res);
      const url = extractUploadUrl(payload);
      if (!url) {
        const keys = payload && typeof payload === 'object' ? Object.keys(payload).join(', ') : typeof payload;
        const preview =
          payload && typeof payload === 'object' ? JSON.stringify(payload).slice(0, 260) : String(payload || 'empty response');
        throw new Error(
          `Upload response missing URL field from ${endpoint} (${fieldName}). Received: ${keys || 'empty response'}. Payload: ${preview}`
        );
      }
      return { ...(payload && typeof payload === 'object' ? payload : {}), url };
    };

    const uploadWithFetch = async (endpoint: string, fieldName: string) => {
      const form = new FormData();
      // @ts-ignore
      form.append(fieldName, { uri: file.uri, name: file.name, type: file.type || 'application/octet-stream' });

      const token = await getToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const res = await fetch(resolveEndpointUrl(endpoint), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form,
          signal: controller.signal,
        });

        const text = await res.text();
        let payload: any = text;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          // Keep as string payload.
        }

        if (!res.ok) {
          const err: any = new Error(`HTTP ${res.status}`);
          err.response = { status: res.status, data: payload };
          throw err;
        }

        const unwrapped = payload?.data?.data ?? payload?.data?.items ?? payload?.data?.result ?? payload;
        const url = extractUploadUrl(unwrapped);
        if (!url) {
          const keys = unwrapped && typeof unwrapped === 'object' ? Object.keys(unwrapped).join(', ') : typeof unwrapped;
          const preview =
            unwrapped && typeof unwrapped === 'object' ? JSON.stringify(unwrapped).slice(0, 260) : String(unwrapped || 'empty response');
          throw new Error(
            `Upload response missing URL field from ${endpoint} (${fieldName}). Received: ${keys || 'empty response'}. Payload: ${preview}`
          );
        }

        return { ...(unwrapped && typeof unwrapped === 'object' ? unwrapped : {}), url };
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const endpoints = Array.from(
      new Set([
        Endpoints.upload,
        '/uploads',
        '/files/upload',
        '/uploads/file',
        '/users/upload',
        '/users/uploads',
        '/users/profile/upload',
        '/users/profile/photo',
      ])
    );
    const fields = ['file', 'cv', 'resume', 'attachment', 'document', 'cvFile', 'avatar', 'photo', 'image', 'profileImage'];
    const errors: string[] = [];
    let lastNetworkErr: any;

    for (const endpoint of endpoints) {
      for (const field of fields) {
        try {
          return await uploadWithField(endpoint, field);
        } catch (err: any) {
          const status = Number(err?.response?.status || 0);
          const body = err?.response?.data;
          const detail =
            typeof body === 'string'
              ? body.replace(/\s+/g, ' ').slice(0, 140)
              : body && typeof body === 'object'
                ? JSON.stringify(body).slice(0, 140)
                : err?.message || 'unknown error';
          errors.push(`[${endpoint}][${field}] ${status || 'ERR'} ${detail}`);

          if (!status) {
            lastNetworkErr = err;
            continue;
          }
        }
      }
    }

    // Axios multipart on React Native can fail on some Android devices with generic network errors.
    // Retry with native fetch multipart before failing the request.
    const fetchErrors: string[] = [];
    for (const endpoint of endpoints) {
      for (const field of fields) {
        try {
          return await uploadWithFetch(endpoint, field);
        } catch (err: any) {
          const status = Number(err?.response?.status || 0);
          const body = err?.response?.data;
          const detail =
            typeof body === 'string'
              ? body.replace(/\s+/g, ' ').slice(0, 140)
              : body && typeof body === 'object'
                ? JSON.stringify(body).slice(0, 140)
                : err?.message || 'unknown error';
          fetchErrors.push(`[fetch ${endpoint}][${field}] ${status || 'ERR'} ${detail}`);
        }
      }
    }

    if (lastNetworkErr) {
      const err: any = new Error(
        `Upload failed after axios + fetch retries. Axios: ${errors.slice(0, 4).join(' | ')}. Fetch: ${fetchErrors.slice(0, 4).join(' | ')}`
      );
      err.userMessage = err.message;
      throw err;
    }
    throw new Error(`Upload failed across endpoint/field fallbacks. ${errors.slice(0, 6).join(' | ')}`);
  },
};

export const DocumentsService = {
  async list(params?: { managedCandidateId?: string }) {
    const res = await retryOnceAfterWarmup(() =>
      api.get(Endpoints.userDocuments, params?.managedCandidateId ? { params } : undefined)
    );
    return normalizeDocumentGroups(unwrap<any>(res));
  },
  async upload(payload: {
    managedCandidateId?: string;
    filesByType: Partial<Record<'photo' | 'passport' | 'drivingLicense' | 'cv', Array<{ uri: string; name: string; type?: string }>>>;
  }) {
    const normalizedEntries = (
      await Promise.all(
        (
          Object.entries(payload.filesByType) as Array<
            ['photo' | 'passport' | 'drivingLicense' | 'cv', Array<{ uri: string; name: string; type?: string }> | undefined]
          >
        ).map(async ([fieldName, files]) => {
          const normalizedFiles = await normalizeDocumentUploadFiles(fieldName, (files || []) as UploadableFile[]);
          return [fieldName, normalizedFiles] as const;
        })
      )
    ).filter(([, files]) => files.length > 0);

    if (!normalizedEntries.length) {
      const err: any = new Error('No files provided for upload.');
      err.userMessage = err.message;
      throw err;
    }

    const buildForm = (fieldName: 'photo' | 'passport' | 'drivingLicense' | 'cv', files: UploadableFile[]) => {
      const form = new FormData();
      files.forEach((file) => {
        // @ts-ignore react-native FormData file shape
        form.append(fieldName, { uri: file.uri, name: file.name, type: file.type || 'application/octet-stream' });
      });
      return form;
    };

    const absoluteUrl = `${String(api.defaults.baseURL || '').replace(/\/+$/, '')}${Endpoints.userDocuments}`;
    const token = await getToken();
    let latestGroups: DocumentGroups | null = null;

    for (const [fieldName, files] of normalizedEntries) {
      const request = () =>
        api.post(Endpoints.userDocuments, buildForm(fieldName, files), {
          headers: { Accept: 'application/json' },
          timeout: 60000,
        });

      try {
        const res = await retryOnceAfterWarmup(request);
        latestGroups = normalizeDocumentGroups(unwrap<any>(res));
        continue;
      } catch (axiosErr: any) {
        const response = await fetch(absoluteUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: buildForm(fieldName, files),
        });

        const text = await response.text();
        let parsed: any = text;
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          // Keep string payload.
        }

        if (!response.ok) {
          const axiosDetail =
            typeof axiosErr?.response?.data === 'string'
              ? axiosErr.response.data
              : axiosErr?.response?.data && typeof axiosErr.response.data === 'object'
                ? JSON.stringify(axiosErr.response.data)
                : axiosErr?.userMessage || axiosErr?.message || 'unknown axios error';
          const fetchDetail =
            typeof parsed === 'string' ? parsed : parsed && typeof parsed === 'object' ? JSON.stringify(parsed) : `HTTP ${response.status}`;
          const fallbackErr: any = new Error(`Failed to upload ${fieldName}. Axios: ${axiosDetail}. Fetch: ${fetchDetail}`);
          fallbackErr.response = { status: response.status, data: parsed };
          fallbackErr.userMessage = fallbackErr.message;
          throw fallbackErr;
        }

        latestGroups = normalizeDocumentGroups(parsed?.data?.data ?? parsed?.data?.items ?? parsed?.data?.result ?? parsed);
      }
    }

    return latestGroups || (await DocumentsService.list());
  },
  async remove(documentId: string, params?: { managedCandidateId?: string }) {
    const res = await retryOnceAfterWarmup(() =>
      api.delete(`${Endpoints.userDocuments}/${documentId}`, params?.managedCandidateId ? { params } : undefined)
    );
    return normalizeDocumentGroups(unwrap<any>(res));
  },
};

export const ApplicationsService = {
  async apply(jobId: string, payload: { note?: string; cvUrl?: string }) {
    const note = payload?.note?.trim() || undefined;
    const cvUrl = payload?.cvUrl;
    // Send common alias keys used by different backend implementations.
    const requestBody = {
      jobId,
      note,
      message: note,
      coverLetter: note,
      cvUrl,
      cv: cvUrl,
      resumeUrl: cvUrl,
      resume: cvUrl,
    };
    const res = await api.post(Endpoints.applyJob(jobId), requestBody);
    return unwrap<any>(res);
  },
  async my() {
    const res = await api.get(Endpoints.myApplications);
    return unwrap<Application[]>(res);
  },
};

export const InvoicesService = {
  async list() {
    const profile = await AuthService.getProfile().catch(() => null);
    const email = getProfileEmail(profile);

    const requests = [
      { endpoint: '/users/invoices', params: undefined as any },
      { endpoint: '/users/invoices', params: email ? { email } : undefined },
      { endpoint: Endpoints.myInvoices, params: undefined as any },
    ];

    const attempts: string[] = [];
    let lastErr: any;
    for (const req of requests) {
      try {
        const res = await api.get(req.endpoint, req.params ? { params: req.params } : undefined);
        const payload = unwrap<any>(res);
        const items = extractInvoices(payload).map(normalizeInvoice);
        // /users/invoices should already be filtered by authenticated user on backend.
        const filtered =
          req.endpoint === '/users/invoices' ? items : email ? items.filter((inv: any) => extractInvoiceEmail(inv) === email) : items;
        return filtered.filter((x) => !!(x as any)?._id || !!(x as any)?.invoiceNumber);
      } catch (err: any) {
        const status = Number(err?.response?.status || 0);
        if (!status) throw err;
        attempts.push(`${req.endpoint} -> ${status}`);
        lastErr = err;
      }
    }

    if (lastErr) {
      const e = new Error(`Unable to load invoices. Tried: ${attempts.join(' | ')}`);
      (e as any).userMessage = e.message;
      throw e;
    }
    return [];
  },
  async get(invoiceId: string) {
    const profile = await AuthService.getProfile().catch(() => null);
    const userId = profile?._id || profile?.id || profile?.user?._id || profile?.user?.id;
    const email = profile?.email || profile?.user?.email;
    const endpoints = Array.from(
      new Set([
        `/users/invoices/${invoiceId}`,
        `/users/me/invoices/${invoiceId}`,
        `/users/invoices/my/${invoiceId}`,
        `/invoices/${invoiceId}`,
        `/invoices/my/${invoiceId}`,
        `/invoices/user/${invoiceId}`,
        Endpoints.invoiceById(invoiceId),
      ])
    );
    let lastErr: any;
    for (const endpoint of endpoints) {
      try {
        const params: any = {};
        if (userId) params.userId = userId;
        if (email) params.email = email;
        const res = await api.get(endpoint, Object.keys(params).length ? { params } : undefined);
        const payload = unwrap<any>(res);
        const invoice = extractInvoice(payload);
        if (invoice) return normalizeInvoice(invoice);
      } catch (err: any) {
        const status = Number(err?.response?.status || 0);
        if (!status) throw err;
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
    const list = await InvoicesService.list().catch(() => []);
    const matched = (Array.isArray(list) ? list : []).find((item: any) => String(item?._id || item?.id) === String(invoiceId));
    if (matched) return normalizeInvoice(matched);
    throw new Error('Invoice not found in response');
  },
  async getPdfUrl(invoiceId: string) {
    const endpoints = Array.from(
      new Set([
        `/users/invoices/${invoiceId}/pdf`,
        `/users/me/invoices/${invoiceId}/pdf`,
        `/users/invoices/my/${invoiceId}/pdf`,
        `/invoices/${invoiceId}/pdf`,
        `/invoices/my/${invoiceId}/pdf`,
        `/sales-admin/invoices/${invoiceId}/pdf`,
        Endpoints.invoicePdf(invoiceId),
      ])
    );

    const directPdfCandidates: Array<{ base64: string; fileName: string }> = [];
    const resolvedCandidates: string[] = [];
    let lastErr: any;

    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint, {
          responseType: 'arraybuffer' as any,
          transformResponse: [(data) => data],
          timeout: 30000,
        });
        const contentType = String((res as any)?.headers?.['content-type'] || '').toLowerCase();
        const contentDisposition = String((res as any)?.headers?.['content-disposition'] || '');
        const bytes = normalizeBinaryPayload(res?.data);
        const base64 = bytes.length ? bytesToBase64(bytes) : '';

        if (contentType.includes('pdf') || base64.startsWith('JVBERi0')) {
          directPdfCandidates.push({
            base64,
            fileName: fileNameFromContentDisposition(contentDisposition) || `invoice-${invoiceId}.pdf`,
          });
          continue;
        }

        const raw = bytesToText(bytes).trim();
        if (raw) {
          let payload: any = raw;
          try {
            payload = JSON.parse(raw);
          } catch {
            // Keep raw string.
          }
          const resolvedUrl = extractUploadUrl(payload);
          if (resolvedUrl) resolvedCandidates.push(resolvedUrl);
        }

        resolvedCandidates.push(endpoint);
      } catch (err: any) {
        const status = Number(err?.response?.status || 0);
        if (!status) throw err;
        lastErr = err;
        resolvedCandidates.push(endpoint);
      }
    }

    if (directPdfCandidates.length) {
      return {
        base64: directPdfCandidates[0].base64,
        fileName: directPdfCandidates[0].fileName,
        directDownload: true,
      };
    }
 
    const result = {
      url: resolvedCandidates[0] || Endpoints.invoicePdf(invoiceId),
      candidates: Array.from(new Set(resolvedCandidates)),
      directDownload: true,
    };
    if (lastErr && !result.candidates.length) throw lastErr;
    return result;
  },
  async markPaid(invoiceId: string, payload?: { reference?: string; notes?: string; slipUrl?: string; file?: UploadableFile } | any) {
    const endpoints = Array.from(
      new Set([
        `/users/invoices/${invoiceId}/payment-proof`,
        `/users/me/invoices/${invoiceId}/payment-proof`,
        `/users/invoices/${invoiceId}/mark-paid`,
        `/users/me/invoices/${invoiceId}/mark-paid`,
        `/invoices/${invoiceId}/mark-paid`,
      ])
    );
    const reference = String(payload?.reference || '').trim();
    const notes = String(payload?.notes || '').trim();
    const slipUrl = String(payload?.slipUrl || '').trim();
    const body = {
      ...(payload || {}),
      reference: reference || undefined,
      referenceNo: reference || undefined,
      paymentReference: reference || undefined,
      notes: notes || (slipUrl ? `Slip URL: ${slipUrl}` : undefined),
      slipUrl: slipUrl || undefined,
      slip_url: slipUrl || undefined,
      paymentSlipUrl: slipUrl || undefined,
      attachmentUrl: slipUrl || undefined,
    };
    let lastErr: any;
    const file: UploadableFile | undefined =
      payload?.file && payload.file.uri
        ? {
            uri: payload.file.uri,
            name: payload.file.name || `payment-proof-${Date.now()}.jpg`,
            type: payload.file.type || 'application/octet-stream',
            size: payload.file.size ?? null,
          }
        : undefined;

    const fileFieldCandidates = ['paymentSlip', 'slip', 'proof', 'file', 'document', 'image'];

    const submitMultipart = async (endpoint: string) => {
      if (!file) return null;
      await ensureUploadSizeWithinLimit(file);
      for (const field of fileFieldCandidates) {
        const form = new FormData();
        if (reference) form.append('reference', reference);
        if (notes) form.append('notes', notes);
        // @ts-ignore react-native FormData file type
        form.append(field, { uri: file.uri, name: file.name, type: file.type });
        try {
          const res = await api.post(endpoint, form, {
            headers: { Accept: 'application/json' },
            timeout: 60000,
          });
          return unwrap<any>(res);
        } catch (err: any) {
          const status = Number(err?.response?.status || 0);
          if (!status) throw err;
          lastErr = err;
        }
      }
      return null;
    };

    for (const endpoint of endpoints) {
      try {
        const multipartResult = await submitMultipart(endpoint);
        if (multipartResult) return multipartResult;

        const res = await api.post(endpoint, body);
        return unwrap<any>(res);
      } catch (err: any) {
        const status = Number(err?.response?.status || 0);
        if (!status) throw err;
        lastErr = err;
      }
    }
    if (lastErr) {
      const status = Number(lastErr?.response?.status || 0);
      if (status === 404 || status === 401 || status === 403) {
        const e = new Error('Payment proof endpoint is not available for client users yet.');
        (e as any).userMessage = e.message;
        throw e;
      }
      throw lastErr;
    }
    throw new Error('Unable to submit payment proof');
  },
};

export const InquiriesService = {
  async listMine() {
    const res = await api.get(Endpoints.myInquiries);
    return unwrap<Inquiry[]>(res);
  },
  async create(jobId: string, payload: { category: string; message: string; subject?: string; attachmentUrl?: string }) {
    const res = await api.post(Endpoints.createInquiry(jobId), payload);
    return unwrap<any>(res);
  },
  async getAll() {
    const res = await api.get(Endpoints.allInquiries);
    return unwrap<Inquiry[]>(res);
  },
};

export const MeetingsService = {
  async list(params?: { managedCandidateId?: string }) {
    const res = await api.get(Endpoints.meetings, params?.managedCandidateId ? { params } : undefined);
    const payload = unwrap<any>(res);
    const meetings = extractMeetings(payload);
    return meetings.length ? meetings : (Array.isArray(payload) ? (payload as Meeting[]) : []);
  },
};

export const TasksService = {
  async list(params?: { managedCandidateId?: string }) {
    const res = await api.get(Endpoints.tasks, params?.managedCandidateId ? { params } : undefined);
    const payload = unwrap<any>(res);
    const list = extractTasks(payload);
    return list.length ? list : (Array.isArray(payload) ? (payload as Task[]) : []);
  },
  async uploadTaskFiles(files: Array<{ uri: string; name: string; type?: string }>) {
    if (!files?.length) return [] as TaskFile[];
    await ensureApiReady({ timeoutMs: 45000, background: true }).catch(() => undefined);
    await ensureUploadBatchWithinLimit(files);

    const endpoints = Array.from(
      new Set([Endpoints.uploadTaskFiles, '/tasks/upload/files', '/tasks/files/upload', '/tasks/upload', Endpoints.upload])
    );
    const fieldCandidates = ['files', 'file', 'attachments', 'documents'];

    const buildForm = (fieldName: string) => {
      const form = new FormData();
      for (const file of files) {
        // @ts-ignore react-native FormData file shape
        form.append(fieldName, { uri: file.uri, name: file.name, type: file.type || 'application/octet-stream' });
      }
      return form;
    };

    const normalizeResponse = (payload: any) => {
      const uploaded = extractTaskFiles(payload).map(normalizeTaskFile).filter((item) => !!item.fileUrl);
      return uploaded;
    };

    const axiosErrors: string[] = [];
    let lastNetworkErr: any;

    for (const endpoint of endpoints) {
      for (const fieldName of fieldCandidates) {
        try {
          const res = await api.post(endpoint, buildForm(fieldName), {
            headers: { Accept: 'application/json' },
            timeout: 60000,
          });
          const payload = unwrap<any>(res);
          const uploaded = normalizeResponse(payload);
          if (uploaded.length) return uploaded;
        } catch (err: any) {
          const status = Number(err?.response?.status || 0);
          const body = err?.response?.data;
          const detail =
            typeof body === 'string'
              ? body.replace(/\s+/g, ' ').slice(0, 140)
              : body && typeof body === 'object'
                ? JSON.stringify(body).slice(0, 140)
                : err?.message || 'unknown error';
          axiosErrors.push(`[${endpoint}][${fieldName}] ${status || 'ERR'} ${detail}`);
          if (!status) lastNetworkErr = err;
        }
      }
    }

    const token = await getToken();
    const fetchErrors: string[] = [];
    const resolveEndpointUrl = (endpoint: string) => {
      if (/^https?:\/\//i.test(endpoint)) return endpoint;
      const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
      if (!base) return endpoint;
      return endpoint.startsWith('/') ? `${base}${endpoint}` : `${base}/${endpoint}`;
    };

    for (const endpoint of endpoints) {
      for (const fieldName of fieldCandidates) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
          const response = await fetch(resolveEndpointUrl(endpoint), {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: buildForm(fieldName),
            signal: controller.signal,
          });

          const text = await response.text();
          let payload: any = text;
          try {
            payload = text ? JSON.parse(text) : {};
          } catch {
            // Keep raw payload.
          }

          if (!response.ok) {
            throw Object.assign(new Error(`HTTP ${response.status}`), {
              response: { status: response.status, data: payload },
            });
          }

          const unwrapped = payload?.data?.data ?? payload?.data?.items ?? payload?.data?.result ?? payload;
          const uploaded = normalizeResponse(unwrapped);
          if (uploaded.length) return uploaded;
        } catch (err: any) {
          const status = Number(err?.response?.status || 0);
          const body = err?.response?.data;
          const detail =
            typeof body === 'string'
              ? body.replace(/\s+/g, ' ').slice(0, 140)
              : body && typeof body === 'object'
                ? JSON.stringify(body).slice(0, 140)
                : err?.message || 'unknown error';
          fetchErrors.push(`[fetch ${endpoint}][${fieldName}] ${status || 'ERR'} ${detail}`);
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    // Final fallback: use the generic upload flow file-by-file, then attach the returned URLs to the task.
    try {
      const uploaded = [] as TaskFile[];
      for (const file of files) {
        const result = await UploadService.uploadFile(file);
        const normalized = normalizeTaskFile({
          ...result,
          fileName: file.name,
          fileUrl: result?.url || result?.fileUrl || result?.path || result?.documentUrl || '',
          mimeType: file.type || 'application/octet-stream',
        });
        if (normalized.fileUrl) uploaded.push(normalized);
      }
      if (uploaded.length) return uploaded;
    } catch (err: any) {
      const detail = String(err?.userMessage || err?.message || 'unknown error');
      axiosErrors.push(`[generic upload fallback] ${detail}`);
    }

    const err: any = new Error(
      lastNetworkErr
        ? `Task upload failed after axios + fetch retries. Axios: ${axiosErrors.slice(0, 4).join(' | ')}. Fetch: ${fetchErrors.slice(0, 4).join(' | ')}`
        : `Task upload failed across endpoint/field fallbacks. ${axiosErrors.slice(0, 6).join(' | ')} ${fetchErrors.slice(0, 4).join(' | ')}`
    );
    err.userMessage = err.message;
    throw err;
  },
  async markComplete(taskId: string, payload?: { completionNotes?: string; completionFiles?: TaskFile[] }) {
    const body = {
      completionNotes: String(payload?.completionNotes || '').trim(),
      completionFiles: Array.isArray(payload?.completionFiles) ? payload?.completionFiles : [],
    };
    const res = await api.put(Endpoints.taskComplete(taskId), body);
    return unwrap<Task>(res);
  },
};

export const ChatService = {
  async listAdmins() {
    const res = await api.get(Endpoints.chatAdmins);
    return unwrap<ChatAdmin[]>(res);
  },
  async messagesWithAdmin(adminId: string) {
    const res = await api.get(Endpoints.chatMessagesWithAdmin(adminId));
    return unwrap<ChatMessage[]>(res);
  },
  async sendToAdmin(adminId: string, payload: { message: string; attachmentUrl?: string }) {
    const bodyVariants = [
      payload,
      { text: payload.message, attachmentUrl: payload.attachmentUrl },
      { content: payload.message, attachmentUrl: payload.attachmentUrl },
      { message: payload.message, attachment: payload.attachmentUrl },
    ];
    const endpoints = Array.from(
      new Set([
        Endpoints.sendMessageToAdmin(adminId),
        `/chats/user/messages/${adminId}`,
        `/chats/admin/messages/${adminId}`,
      ])
    );
    let lastErr: any;
    for (const endpoint of endpoints) {
      for (const body of bodyVariants) {
        try {
          const res = await api.post(endpoint, body);
          return unwrap<any>(res);
        } catch (err: any) {
          const status = Number(err?.response?.status || 0);
          if (!status) throw err;
          lastErr = err;
        }
      }
    }
    if (lastErr) {
      const msg = String(lastErr?.response?.data?.message || lastErr?.response?.data?.error || lastErr?.message || '');
      if (msg.toLowerCase().includes('admin not found')) {
        const e = new Error('Selected chat contact is not mapped as an admin send target on backend.');
        (e as any).userMessage = e.message;
        throw e;
      }
      throw lastErr;
    }
    throw new Error('Unable to send message');
  },
};
