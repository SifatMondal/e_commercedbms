import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getDeliveryMessages, sendDeliveryMessage } from "../services/deliveryService";

export default function DeliveryChat({ orderId }) {
  const { user } = useAuth(); const [messages, setMessages] = useState([]); const [text, setText] = useState(""); const [error, setError] = useState("");
  const load = () => getDeliveryMessages(orderId).then(setMessages).catch((e) => setError(e.message));
  useEffect(load, [orderId]);
  async function submit(e) { e.preventDefault(); try { await sendDeliveryMessage(orderId, text); setText(""); load(); } catch (err) { setError(err.message); } }
  const recipient = user?.role === "deliveryman" ? "Customer" : "Deliveryman";
  return <section className="delivery-chat"><h3>Message {recipient}</h3>{messages.map((m) => <p key={m.message_id}><strong>{m.sender_role}:</strong> {m.message}</p>)}{error && <p className="message error">{error}</p>}<form onSubmit={submit}><input value={text} onChange={(e) => setText(e.target.value)} maxLength="2000" placeholder={`Message ${recipient.toLowerCase()}`} required /><button>Send</button></form></section>;
}
