import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/env';
import { getItem, setItem, deleteItem } from '../utils/storage';

const BASE_URL = API_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: AxiosError | null, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// Response interceptor — refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        await setItem('accessToken', String(data.accessToken ?? ''));
        await setItem('refreshToken', String(data.refreshToken ?? ''));

        processQueue(null, data.accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        await deleteItem('accessToken');
        await deleteItem('refreshToken');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
};

// ─── Opportunities ────────────────────────────────────────────────────────────
export interface OpportunitiesListParams {
  page?: number;
  limit?: number;
  status?: string;
  uf?: string;
  minValue?: number;
  maxValue?: number;
}

export const opportunitiesApi = {
  list: (params?: OpportunitiesListParams) =>
    api.get('/opportunities', { params }),
  getById: (id: string) => api.get(`/opportunities/${id}`),
  updateStatus: (id: string, status: 'accepted' | 'declined') =>
    api.patch(`/opportunities/${id}/status`, { status }),
  participate: (id: string) =>
    api.post(`/opportunities/${id}/participate`),
  participateWithTenant: (id: string, tenantId: string) =>
    api.post(`/opportunities/${id}/participate`, { tenantId }),
  decline: (id: string) => api.post(`/opportunities/${id}/decline`),
  sendToTenant: (opportunityId: string, tenantId: string) =>
    api.post(`/opportunities/${opportunityId}/send-to-tenant`, { tenantId }),
};

// ─── Biddings ─────────────────────────────────────────────────────────────────
export interface BiddingsListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  uf?: string;
  municipalityIbgeCode?: string;
  municipalityName?: string;
  modalityCode?: number;
  modality?: string;
  source?: string;
  sphere?: string;
  minValue?: number;
  maxValue?: number;
  publicationFrom?: string;
  publicationTo?: string;
  proposalFrom?: string;
  proposalTo?: string;
  openingFrom?: string;
  openingTo?: string;
  sortBy?: 'publicationDate' | 'proposalDueDate' | 'estimatedValue' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
}

export interface BiddingListItem {
  id: string;
  source: string;
  sourceExternalId: string;
  sourceRecordKey: string | null;
  pncpControlNumber: string | null;
  sourceSystemName: string | null;
  modalityCode: string | null;
  modalityNormalized: string | null;
  procurementLaw: string | null;
  processNumber: string | null;
  purchaseYear: number | null;
  sourceUrl: string | null;
  biddingNumber: string | null;
  modality: string | null;
  uasg: string | null;
  sphere: string | null;
  agencyName: string | null;
  agencyDocument: string | null;
  objectText: string;
  objectSummary: string | null;
  publicationDate: string | null;
  openingDate: string | null;
  proposalDueDate: string | null;
  estimatedValue: number | string | null;
  municipalityName: string | null;
  municipalityIbgeCode: string | null;
  uf: string | null;
  status: string;
  publicationUpdatedAt: string | null;
  sourceUpdatedAt: string | null;
  lastSeenAt: string | null;
}

export interface BiddingFacetResponse {
  data: BiddingListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  facets: {
    municipality: Array<{ code: string | null; name: string | null; uf: string | null; count: number }>;
    modality: Array<{ code: string | null; name: string | null; normalized: string | null; count: number }>;
    source: Array<{ source: string; count: number }>;
    status: Array<{ status: string; count: number }>;
  };
}

export const biddingsApi = {
  list: (params?: BiddingsListParams) => api.get<BiddingFacetResponse>('/biddings', { params }),
  getById: (id: string) => api.get<BiddingListItem & Record<string, unknown>>(`/biddings/${id}`),
  getItems: (id: string) => api.get(`/biddings/${id}/items`),
  notifyClient: (id: string) => api.post(`/biddings/${id}/notify`),
};

// ─── Alert profile ────────────────────────────────────────────────────────────
export interface AlertProfile {
  filter: {
    municipioBase: string | null;
    raioKm: number;
    participaMunicipal: boolean;
    participaEstadual: boolean;
    participaFederal: boolean;
    participaAutarquias: boolean;
    modalidadePregao: boolean;
    modalidadeDispensa: boolean;
    modalidadeOutros: boolean;
    notificaEmail: boolean;
    notificaWhatsapp: boolean;
    notificaPush: boolean;
  };
  keywords: Array<{ id: string; keyword: string; matchType: string; weight: number }>;
  regions: Array<{
    id: string;
    uf: string;
    municipalityName: string | null;
    municipalityIbgeCode: string | null;
    scopeType: string;
  }>;
  cnaes: Array<{ id: string; code: string; description: string; isPrimary: boolean }>;
}

export const alertProfileApi = {
  get: () => api.get<AlertProfile>('/alert-profile'),
  update: (payload: unknown) => api.put<AlertProfile>('/alert-profile', payload),
};

// ─── Participations ──────────────────────────────────────────────────────────
export const participationsApi = {
  getById: (id: string) => api.get(`/participations/${id}`),
  updateItems: (
    id: string,
    items: { biddingItemId: string; brand: string; finalUnitPrice: number; quantity?: number }[],
  ) => api.put(`/participations/${id}/items`, { items }),
  submit: (id: string) => api.post(`/participations/${id}/submit`),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  getByOpportunity: (opportunityId: string) =>
    api.get(`/opportunities/${opportunityId}/report`),
  getDownloadUrl: (reportId: string) =>
    `${BASE_URL}/reports/${reportId}/download`,
  download: (reportId: string) =>
    api.get(`/reports/${reportId}/download`, { responseType: 'arraybuffer' }),
};

// ─── Notifications ───────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
};

// ─── Notification Preferences ────────────────────────────────────────────────
export const preferencesApi = {
  get: () => api.get('/notification-preferences'),
  update: (prefs: unknown) => api.put('/notification-preferences', prefs),
};

// ─── Analysis ─────────────────────────────────────────────────────────────────
export const analysisApi = {
  getByBidding: (biddingId: string) =>
    api.get(`/analysis/biddings/${biddingId}`),

  // Upload edital for analysis (multipart/form-data) — tenantId is optional
  upload: (file: File, tenantId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (tenantId) formData.append('tenantId', tenantId);
    return api.post('/analysis/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000, // 3 min for large files + Gemini pipeline
    });
  },

  // Get single analysis result
  get: (id: string) => api.get(`/analysis/${id}`),

  // Download PDF report
  getPdf: (id: string) =>
    api.get(`/analysis/${id}/pdf`, { responseType: 'arraybuffer' }),

  // Alias for getPdf (explicit download intent)
  downloadPdf: (id: string) =>
    api.get(`/analysis/${id}/pdf`, { responseType: 'arraybuffer' }),

  // List analyses (optional tenantId filter)
  list: (tenantId?: string) =>
    api.get('/analysis', { params: tenantId ? { tenantId } : undefined }),

  // Send analysis result to tenant client
  sendToTenant: (id: string, tenantId: string) =>
    api.post(`/analysis/${id}/send-to-tenant`, { tenantId }),

  // Upload document for habilitation
  uploadDocument: (tenantId: string, docId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/admin/tenants/${tenantId}/documents/${docId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
};

// ─── CAPAG ───────────────────────────────────────────────────────────────────
export const capagApi = {
  getByMunicipality: (ibgeCode: string) =>
    api.get(`/capag/municipalities/${ibgeCode}`),
};

// ─── Dashboard (client) ──────────────────────────────────────────────────────
export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  documents: () => api.get('/documents'),
  results: () => api.get('/results'),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  // Dashboard
  overview: () => api.get('/admin/dashboard/overview'),
  stats: () => api.get('/admin/dashboard/stats'),
  participations: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/dashboard/participations', { params }),

  // Companies with stats
  companies: () => api.get('/admin/companies'),

  // Documents expiring
  documentsExpiring: (days?: number) =>
    api.get('/admin/documents/expiring', { params: days ? { days } : undefined }),

  // Tenants
  listTenants: () => api.get('/admin/tenants'),
  createTenant: (data: { corporateName: string; tradeName?: string; cnpj: string; contactName?: string; contactEmail?: string; contactPhone?: string; address?: string }) =>
    api.post('/admin/tenants', data),
  getTenant: (id: string) => api.get(`/admin/tenants/${id}`),
  updateTenant: (id: string, data: { corporateName?: string; tradeName?: string; contactName?: string; contactEmail?: string; contactPhone?: string; status?: string; cnpj?: string }) =>
    api.patch(`/admin/tenants/${id}`, data),

  // CNPJ Lookup
  cnpjLookup: (cnpj: string) => api.get(`/admin/cnpj-lookup/${cnpj.replace(/\D/g, '')}`),

  // Habilitation Documents
  updateHabilitationDocument: (tenantId: string, docId: string, data: { status?: string; validUntil?: string; fileUrl?: string }) =>
    api.put(`/admin/tenants/${tenantId}/documents/${docId}`, data),
  seedTenantDocs: (tenantId: string) =>
    api.post(`/admin/tenants/${tenantId}/documents/seed`),

  // Tenant users
  getTenantUsers: (tenantId: string) => api.get(`/admin/tenants/${tenantId}/users`),
  createTenantUser: (tenantId: string, data: { fullName: string; email: string; role: string }) =>
    api.post(`/admin/tenants/${tenantId}/users`, data),

  // Keywords
  getTenantKeywords: (tenantId: string) => api.get(`/admin/tenants/${tenantId}/keywords`),
  addTenantKeyword: (tenantId: string, keyword: string) =>
    api.post(`/admin/tenants/${tenantId}/keywords`, { keyword }),

  // Regions
  getTenantRegions: (tenantId: string) => api.get(`/admin/tenants/${tenantId}/regions`),
  addTenantRegion: (tenantId: string, data: { uf: string; municipalityIbgeCode?: string }) =>
    api.post(`/admin/tenants/${tenantId}/regions`, data),

  // Results
  createResult: (data: { tenantId: string; biddingId: string; status: string; valorContrato?: number; prazoEntrega?: string; obrigacoes?: string }) =>
    api.post('/admin/results', data),
};
