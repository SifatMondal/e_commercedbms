import { apiRequest } from "./api";

export const createOrder = (paymentMethod, shippingAddress, deliveryLocation) =>
  apiRequest("/api/orders", {
    method: "POST",
    auth: true,
    body: {
      payment_method: paymentMethod,
      shipping_address: shippingAddress,
      delivery_latitude: deliveryLocation.latitude,
      delivery_longitude: deliveryLocation.longitude,
    },
  });

export const validateDeliveryLocation = (deliveryLocation) =>
  apiRequest("/api/orders/validate-delivery-location", {
    method: "POST",
    auth: true,
    body: {
      delivery_latitude: deliveryLocation.latitude,
      delivery_longitude: deliveryLocation.longitude,
    },
  });

export const getOrders = () => apiRequest("/api/orders", { auth: true });

export const getOrder = (orderId) => apiRequest(`/api/orders/${orderId}`, { auth: true });

export const cancelOrder = (orderId) => apiRequest(`/api/orders/${orderId}/cancel`, { method: "PUT", auth: true });
