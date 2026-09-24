import { apiRequest } from "./api";

// Stats
export const getAdminStats = () => apiRequest("/api/admin/stats", { auth: true });

// Products
export const getAdminProducts = () => apiRequest("/api/admin/products", { auth: true });
export const pauseProduct = (id) => apiRequest(`/api/admin/products/${id}/pause`, { method: "PATCH", auth: true });
export const unpauseProduct = (id) => apiRequest(`/api/admin/products/${id}/unpause`, { method: "PATCH", auth: true });
export const deleteProductSafely = (id) => apiRequest(`/api/admin/products/${id}`, { method: "DELETE", auth: true });

// Sellers
export const getPendingSellers = () => apiRequest("/api/admin/sellers/pending", { auth: true });
export const getAllSellers = () => apiRequest("/api/admin/sellers", { auth: true });
export const approveSeller = (sellerId) => apiRequest(`/api/admin/sellers/${sellerId}/approve`, { method: "PATCH", auth: true });
export const rejectSeller = (sellerId) => apiRequest(`/api/admin/sellers/${sellerId}/reject`, { method: "PATCH", auth: true });
export const suspendSeller = (sellerId, durationDays = null) =>
  apiRequest(`/api/admin/sellers/${sellerId}/suspend`, { method: "PATCH", auth: true, body: { durationDays } });
export const reactivateSeller = (sellerId) =>
  apiRequest(`/api/admin/sellers/${sellerId}/reactivate`, { method: "PATCH", auth: true });
export const deleteSellerSafely = (sellerId) =>
  apiRequest(`/api/admin/sellers/${sellerId}`, { method: "DELETE", auth: true });

// Deliverymen
export const getDeliverymen = () => apiRequest("/api/admin/deliverymen", { auth: true });
export const approveDeliveryman = (id) => apiRequest(`/api/admin/deliverymen/${id}/approve`, { method: "PATCH", auth: true });
export const rejectDeliveryman = (id) => apiRequest(`/api/admin/deliverymen/${id}/reject`, { method: "PATCH", auth: true });
export const suspendDeliveryman = (id, durationDays = null) =>
  apiRequest(`/api/admin/deliverymen/${id}/suspend`, { method: "PATCH", auth: true, body: { durationDays } });
export const reactivateDeliveryman = (id) =>
  apiRequest(`/api/admin/deliverymen/${id}/reactivate`, { method: "PATCH", auth: true });
export const deleteDeliverymanSafely = (id) =>
  apiRequest(`/api/admin/deliverymen/${id}`, { method: "DELETE", auth: true });
