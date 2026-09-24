import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getConversations } from "../services/deliveryService";
import DeliveryChat from "../components/DeliveryChat";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { useLiveSync, triggerLiveSync } from "../hooks/useLiveSync";

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [initialText, setInitialText] = useState("");

  const fetchConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getConversations();
      const list = Array.isArray(data) ? data : [];
      // Deduplicate conversations list to prevent unnecessary re-rendering
      setConversations((prev) => {
        if (prev.length === list.length) {
          const isSame = prev.every((c, idx) => {
            const next = list[idx];
            return (
              c.type === next?.type &&
              String(c.order_id) === String(next?.order_id) &&
              c.conversation_id === next?.conversation_id &&
              c.unread_count === next?.unread_count &&
              c.last_message === next?.last_message &&
              c.last_message_time === next?.last_message_time &&
              c.order_status === next?.order_status
            );
          });
          if (isSame) return prev;
        }
        return list;
      });

      // Check URL parameters for direct navigation
      const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const supportParam = searchParams.get("support");
      const appealParam = searchParams.get("appeal");
      const orderIdParam = searchParams.get("orderId");
      const productIdParam = searchParams.get("productId");
      const productNameParam = searchParams.get("productName");

      if (appealParam === "suspension") {
        setInitialText("Appeal Suspension: I am requesting a review of my account suspension. Reason / explanation: ");
      } else if (appealParam === "product") {
        setInitialText(`Appeal for paused product "${productNameParam || ""}" (ID #${productIdParam || ""}): `);
      }

      setSelectedConv((prev) => {
        if (orderIdParam) {
          const match = list.find((c) => c.type === "order" && String(c.order_id) === String(orderIdParam));
          if (match) return match;
          return { type: "order", order_id: orderIdParam };
        }
        if (supportParam || appealParam) {
          const supportMatch = list.find((c) => c.type === "support");
          if (supportMatch) return supportMatch;
          return { type: "support", conversation_id: "support_admin", title: "Admin Support & Appeals" };
        }
        if (prev) {
          const stillThere = list.find((c) =>
            prev.type === "order"
              ? c.type === "order" && String(c.order_id) === String(prev.order_id)
              : c.type === "support" && c.conversation_id === prev.conversation_id
          );
          if (stillThere) {
            if (
              prev.unread_count === stillThere.unread_count &&
              prev.last_message === stillThere.last_message &&
              prev.last_message_time === stillThere.last_message_time &&
              prev.recipient_role === stillThere.recipient_role &&
              prev.recipient_id === stillThere.recipient_id &&
              prev.order_status === stillThere.order_status
            ) {
              return prev;
            }
            return { ...prev, ...stillThere };
          }
        }
        return list.length > 0 ? list[0] : null;
      });
    } catch (e) {
      console.error("Failed to load conversations:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Live synchronization: when a message arrives or order updates, refresh list silently
  useLiveSync(["message_sent", "order_updated"], () => {
    fetchConversations(true);
  }, 5000);

  const handleSelect = (conv) => {
    setSelectedConv(conv);
    setMobileView("chat");
    setInitialText("");

    // Mark as locally read
    setConversations((prev) =>
      prev.map((c) => {
        const isMatch =
          conv.type === "order"
            ? c.type === "order" && String(c.order_id) === String(conv.order_id)
            : c.type === "support" && c.conversation_id === conv.conversation_id;
        return isMatch ? { ...c, unread_count: 0 } : c;
      })
    );
  };

  if (loading) return <Spinner label="Loading messages…" />;

  if (conversations.length === 0) {
    return (
      <section className="messages-page messages-empty-wrapper">
        <p className="eyebrow">Communication</p>
        <h1>Messages & Support</h1>
        <EmptyState
          title="No message conversations yet"
          description="Direct order messages between customers, sellers, deliverymen, and admin will appear here."
        />
      </section>
    );
  }

  return (
    <section className="messages-page">
      <div className="messages-heading">
        <p className="eyebrow">Communication</p>
        <h1>Messages & Support</h1>
      </div>

      <div className="messages-layout">
        <aside className={`conversations-sidebar ${mobileView === "list" ? "mobile-show" : "mobile-hide"}`}>
          <div className="conversations-sidebar-header">
            <h3>Conversations</h3>
            <span className="conv-count-badge">{conversations.length}</span>
          </div>

          <ul className="conversations-list">
            {conversations.map((c) => {
              const isSelected =
                selectedConv &&
                (c.type === "order"
                  ? selectedConv.type === "order" && String(c.order_id) === String(selectedConv.order_id)
                  : selectedConv.type === "support" && c.conversation_id === selectedConv.conversation_id);

              const otherParty =
                c.type === "support"
                  ? c.other_party || "Platform Admin"
                  : user?.role === "customer"
                  ? c.deliveryman_name ? `Deliveryman (${c.deliveryman_name})` : "Store & Admin Support"
                  : user?.role === "deliveryman"
                  ? `Customer (${c.customer_name || "Buyer"})`
                  : user?.role === "seller"
                  ? c.deliveryman_name ? `Deliveryman (${c.deliveryman_name})` : `Customer (${c.customer_name || "Buyer"})`
                  : `Order #${c.order_id} (${c.customer_name || "Customer"})`;

              const itemKey = c.type === "order" ? `order_${c.order_id}` : c.conversation_id;

              return (
                <li
                  key={itemKey}
                  className={`conversation-item ${isSelected ? "selected" : ""} ${c.unread_count > 0 ? "has-unread" : ""}`}
                  onClick={() => handleSelect(c)}
                >
                  <div className="conv-top">
                    <strong className="conv-title">
                      {c.type === "support" ? `🛡️ ${c.title || "Admin Support"}` : `📦 Order #${c.order_id}`}
                    </strong>
                    {c.unread_count > 0 && (
                      <span className="unread-badge">{c.unread_count} new</span>
                    )}
                  </div>
                  <span className="conv-party">{otherParty}</span>
                  {c.last_message && (
                    <p className="conv-snippet">
                      <span className="conv-sender">
                        {c.last_sender_role === user?.role ? "You: " : ""}
                      </span>
                      {c.last_message}
                    </p>
                  )}
                  <div className="conv-meta">
                    {c.order_status ? (
                      <span className="conv-status">{c.order_status}</span>
                    ) : (
                      <span className="conv-status support-status">Direct</span>
                    )}
                    {c.last_message_time && (
                      <span className="conv-time">
                        {new Date(c.last_message_time).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        <main className={`chat-main-panel ${mobileView === "chat" ? "mobile-show" : "mobile-hide"}`}>
          {selectedConv ? (
            <>
              <div className="mobile-chat-back-bar">
                <button
                  type="button"
                  className="btn-back-to-list"
                  onClick={() => setMobileView("list")}
                >
                  ← Back to conversations
                </button>
              </div>
              {selectedConv.type === "order" ? (
                <DeliveryChat key={`order_${selectedConv.order_id}`} orderId={selectedConv.order_id} />
              ) : (
                <DeliveryChat
                  key={`support_${selectedConv.conversation_id}`}
                  supportMode={true}
                  initialRecipientRole={selectedConv.recipient_role}
                  initialRecipientId={selectedConv.recipient_id}
                  initialText={initialText}
                />
              )}
            </>
          ) : (
            <div className="chat-placeholder">
              <p>Select a conversation from the left to view messages.</p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
