import { useEffect, useRef } from "react";

// Singleton SSE connection shared across all hook consumers
let sseSource = null;
let sseRefCount = 0;

function getEventSourceUrl() {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const baseUrl = import.meta.env.DEV && apiBaseUrl === "http://localhost:3000" ? "" : apiBaseUrl;
  return `${baseUrl}/api/events`;
}

function initSSE() {
  if (typeof window === "undefined") return;
  if (!sseSource || sseSource.readyState === EventSource.CLOSED) {
    try {
      sseSource = new EventSource(getEventSourceUrl());

      sseSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.type) {
            window.dispatchEvent(new CustomEvent(`live:${data.type}`, { detail: data.payload }));
            window.dispatchEvent(new CustomEvent("live:all", { detail: data }));
          }
        } catch (_) {}
      };

      sseSource.onerror = () => {
        // EventSource will automatically attempt reconnection
      };
    } catch (err) {
      console.warn("SSE connection error:", err);
    }
  }
  sseRefCount++;
}

function releaseSSE() {
  sseRefCount--;
  if (sseRefCount <= 0) {
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }
    sseRefCount = 0;
  }
}

/**
 * Trigger immediate local synchronization across the current browser window
 */
export function triggerLiveSync(type, payload = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(`live:${type}`, { detail: payload }));
    window.dispatchEvent(new CustomEvent("live:all", { detail: { type, payload } }));
  }
}

/**
 * Hook to automatically synchronize data on backend events and gentle polling
 * @param {string|string[]} eventTypes Event name(s) e.g. "order_updated", "message_sent", "stats_updated"
 * @param {Function} onUpdate Callback function to invoke when data changes
 * @param {number} pollIntervalMs Gentle background polling interval in ms (default 5000ms)
 */
export function useLiveSync(eventTypes, onUpdate, pollIntervalMs = 5000) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    initSSE();

    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    const handler = (e) => {
      if (onUpdateRef.current) {
        onUpdateRef.current(e.detail);
      }
    };

    types.forEach((t) => {
      window.addEventListener(`live:${t}`, handler);
    });

    let pollTimer = null;
    if (pollIntervalMs > 0) {
      pollTimer = setInterval(() => {
        if (onUpdateRef.current) {
          onUpdateRef.current({ isPoll: true });
        }
      }, pollIntervalMs);
    }

    return () => {
      types.forEach((t) => {
        window.removeEventListener(`live:${t}`, handler);
      });
      if (pollTimer) clearInterval(pollTimer);
      releaseSSE();
    };
  }, [JSON.stringify(eventTypes), pollIntervalMs]);
}
