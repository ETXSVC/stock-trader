const BASE_URL = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || resp.statusText);
  }
  return resp.json();
}

export const api = {
  getStocks: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any[]>(`/api/stocks${qs}`);
  },
  createStock: (data: { ticker: string; name: string; sector?: string }) =>
    request<any>("/api/stocks", { method: "POST", body: JSON.stringify(data) }),
  updateStock: (id: number, data: Record<string, any>) =>
    request<any>(`/api/stocks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStock: (id: number) =>
    request<any>(`/api/stocks/${id}`, { method: "DELETE" }),
  initSp500: () =>
    request<any>("/api/stocks/init-sp500", { method: "POST" }),

  getSamples: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any[]>(`/api/samples${qs}`);
  },
  getLatestSamples: () => request<any[]>("/api/samples/latest"),
  getTopMovers: (type: string = "gainers", limit: number = 10) =>
    request<any[]>(`/api/samples/top-movers?type=${type}&limit=${limit}`),
  triggerSample: (sampleType: string = "mid") =>
    request<any>("/api/samples/trigger", {
      method: "POST",
      body: JSON.stringify({ sample_type: sampleType }),
    }),

  getAlerts: () => request<any[]>("/api/alerts"),
  createAlert: (data: { stock_id?: number; condition: string; threshold: number }) =>
    request<any>("/api/alerts", { method: "POST", body: JSON.stringify(data) }),
  updateAlert: (id: number, data: Record<string, any>) =>
    request<any>(`/api/alerts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAlert: (id: number) =>
    request<any>(`/api/alerts/${id}`, { method: "DELETE" }),

  getNotifications: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any[]>(`/api/notifications${qs}`);
  },
  markRead: (id: number) =>
    request<any>(`/api/notifications/${id}/read`, { method: "PUT" }),
  markAllRead: () =>
    request<any>("/api/notifications/read-all", { method: "PUT" }),

  exportCsvUrl: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return `${BASE_URL}/api/export/csv${qs}`;
  },

  getSchedules: () => request<any[]>("/api/schedules"),
  createSchedule: (data: { label: string; sample_type: string; hour: number; minute: number }) =>
    request<any>("/api/schedules", { method: "POST", body: JSON.stringify(data) }),
  updateSchedule: (id: number, data: Record<string, any>) =>
    request<any>(`/api/schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSchedule: (id: number) =>
    request<any>(`/api/schedules/${id}`, { method: "DELETE" }),

  getTasks: (completed?: boolean) => {
    const qs = completed !== undefined ? `?completed=${completed}` : "";
    return request<any[]>(`/api/tasks${qs}`);
  },
  createTask: (data: { title: string; description?: string; priority?: string; due_date?: string }) =>
    request<any>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: number, data: Record<string, any>) =>
    request<any>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (id: number) =>
    request<any>(`/api/tasks/${id}`, { method: "DELETE" }),
};
