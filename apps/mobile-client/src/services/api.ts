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
  decline: (id: string) => api.post(`/opportunities/${id}/decline`),
};

// ─── Biddings ─────────────────────────────────────────────────────────────────
export const biddingsApi = {
  getById: (id: string) => api.get(`/biddings/${id}`),
  getItems: (id: string) => api.get(`/biddings/${id}/items`),
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
};

// ─── CAPAG ───────────────────────────────────────────────────────────────────
export const capagApi = {
  getByMunicipality: (ibgeCode: string) =>
    api.get(`/capag/municipalities/${ibgeCode}`),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  // Dashboard
  overview: () => api.get('/admin/dashboard/overview'),
  participations: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/dashboard/participations', { params }),

  // Tenants
  listTenants: () => api.get('/admin/tenants'),
  createTenant: (data: { corporateName: string; tradeName?: string; cnpj: string; contactName?: string; contactEmail?: string; contactPhone?: string }) =>
    api.post('/admin/tenants', data),
  getTenant: (id: string) => api.get(`/admin/tenants/${id}`),
  updateTenant: (id: string, data: { corporateName?: string; tradeName?: string; contactName?: string; contactEmail?: string; contactPhone?: string; status?: string; cnpj?: string }) =>
    api.patch(`/admin/tenants/${id}`, data),

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
};
