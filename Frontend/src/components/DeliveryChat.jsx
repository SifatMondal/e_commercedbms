import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getDeliveryMessages, sendDeliveryMessage } from "../services/deliveryService";
import Spinner from "./Spinner";

export default function DeliveryChat({ orderId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const isDeliveryman = user?.role === "deliveryman";
  const recipientRole = isDeliveryman ? "Customer" : "Deliveryman";

  const fetchMessages = async (isInitial = false) => {
    if (!orderId) return;
    if (isInitial) setLoading(true);
    try {
      const data = await getDeliveryMessages(orderId);
      setMessages(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      // Only show error prominently if initial load fails
      if (isInitial) {
        setError(err.message || "Failed to load messages.");
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchMessages(true);

    // Poll for new messages every 3 seconds
    const interval = setInterval(() => {
      if (mounted) {
        fetchMessages(false);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError("");
    try {
      await sendDeliveryMessage(orderId, trimmed);
      setText("");
      await fetchMessages(false);
    } catch (err) {
      setError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="delivery-chat" aria-label={`Delivery chat for Order #${orderId}`}>
      <div className="chat-header">
        <h4>💬 Delivery Chat ({recipientRole})</h4>
        <span className="chat-sub">Direct messages for Order #{orderId}</span>
      </div>

      <div className="chat-messages-container">
        {loading ? (
          <div className="chat-loading">
            <Spinner label="Loading messages…" />
          </div>
        ) : error && messages.length === 0 ? (
          <div className="chat-error">
            <p className="message error">{error}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => fetchMessages(true)}
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet.</p>
            <span className="hint">Send a message below to reach the {recipientRole.toLowerCase()}.</span>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = user?.role === m.sender_role;
            const senderLabel = isMe
              ? "You"
              : m.sender_role === "deliveryman"
              ? "Deliveryman"
              : "Customer";
            const timeStr = m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <div
                key={m.message_id}
                className={`chat-message-row ${isMe ? "row-me" : "row-them"}`}
              >
                <div className={`chat-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                  <div className="bubble-meta">
                    <strong>{senderLabel}</strong>
                    {timeStr && <span className="bubble-time">{timeStr}</span>}
                  </div>
                  <p className="bubble-text">{m.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && messages.length > 0 && (
        <p className="message error chat-inline-error">{error}</p>
      )}

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${recipientRole.toLowerCase()}…`}
          maxLength="2000"
          disabled={sending}
          required
        />
        <button type="submit" disabled={sending || !text.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
