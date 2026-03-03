import { api } from './client';
import { Endpoints } from './endpoints';
import { getToken } from '../utils/tokenStorage';
import type { Application, ChatAdmin, ChatMessage, Inquiry, Invoice, Job } from '../types/models';

type UploadableFile = {
  uri: string;
  name: string;
  type?: string;
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

export const AuthService = {
  async login(email: string, password: string) {
    const res = await api.post(Endpoints.login, { email, password });
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
    const res = await api.put(Endpoints.updateProfile, payload);
    return unwrap<any>(res);
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
        `/invoices/${invoiceId}/pdf`,
      ])
    );
    let lastErr: any;
    const attempts: string[] = [];
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint);
        const payload = unwrap<any>(res);
        if (typeof payload === 'string') return { url: payload };
        const url = extractUploadUrl(payload);
        if (url) return { ...(payload && typeof payload === 'object' ? payload : {}), url };
        return payload;
      } catch (err: any) {
        const status = Number(err?.response?.status || 0);
        if (!status) throw err;
        attempts.push(`${endpoint} -> ${status}`);
        lastErr = err;
      }
    }
    if (lastErr) {
      const msg = String(lastErr?.response?.data?.message || lastErr?.response?.data?.error || lastErr?.message || '');
      if (msg.toLowerCase().includes('admin not found')) {
        const e = new Error('PDF is not available for client users on this endpoint yet.');
        (e as any).userMessage = e.message;
        throw e;
      }
      const status = Number(lastErr?.response?.status || 0);
      if (status === 404) {
        const e = new Error(`Invoice PDF endpoint is not available for client API yet. Tried: ${attempts.join(' | ')}`);
        (e as any).userMessage = e.message;
        throw e;
      }
      throw lastErr;
    }
    throw new Error('Unable to get invoice PDF URL');
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
          }
        : undefined;

    const fileFieldCandidates = ['paymentSlip', 'slip', 'proof', 'file', 'document', 'image'];

    const submitMultipart = async (endpoint: string) => {
      if (!file) return null;
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
