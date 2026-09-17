import { apiRequest } from "./api";
export const getPendingSellers = () => apiRequest("/api/admin/sellers/pending", { auth: true });
export const approveSeller = (sellerId) => apiRequest(`/api/admin/sellers/${sellerId}/approve`, { method: "PATCH", auth: true });
export const rejectSeller = (sellerId) => apiRequest(`/api/admin/sellers/${sellerId}/reject`, { method: "PATCH", auth: true });
export const getDeliverymen = () => apiRequest("/api/admin/deliverymen", { auth: true });
export const approveDeliveryman = (id) => apiRequest(`/api/admin/deliverymen/${id}/approve`, { method: "PATCH", auth: true });
export const rejectDeliveryman = (id) => apiRequest(`/api/admin/deliverymen/${id}/reject`, { method: "PATCH", auth: true });
