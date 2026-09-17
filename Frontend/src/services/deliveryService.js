import { apiRequest } from "./api";
export const getDeliveryDashboard = () => apiRequest("/api/delivery/dashboard", { auth: true });
export const setAvailability = (availability_status) => apiRequest("/api/delivery/availability", { method: "PATCH", auth: true, body: { availability_status } });
export const updateDelivery = (orderId, body) => apiRequest(`/api/delivery/orders/${orderId}`, { method: "PATCH", auth: true, body });
export const respondToDeliveryRequest = (requestId, decision) => apiRequest(`/api/delivery/requests/${requestId}`, { method: "PATCH", auth: true, body: { decision } });
export const getDeliveryMessages = (orderId) => apiRequest(`/api/delivery-messages?orderId=${orderId}`, { auth: true });
export const sendDeliveryMessage = (order_id, message) => apiRequest("/api/delivery-messages", { method: "POST", auth: true, body: { order_id, message } });
