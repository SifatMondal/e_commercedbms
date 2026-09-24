import { useEffect, useState } from "react";
import Spinner from "../../components/Spinner";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import { approveSeller, getPendingSellers, rejectSeller, getDeliverymen, approveDeliveryman, rejectDeliveryman } from "../../services/adminService";

const displayDate = (date) => date ? new Date(date).toLocaleDateString() : "—";
export default function AdminDashboard() {
  const [sellers, setSellers] = useState([]); const [status, setStatus] = useState("loading");
  const [deliverymen, setDeliverymen] = useState([]);
  const [error, setError] = useState(""); const [actionId, setActionId] = useState(null); const [message, setMessage] = useState("");
  function load() { setStatus("loading"); setError(""); Promise.all([getPendingSellers(),getDeliverymen()]).then(([data,drivers]) => { setSellers(Array.isArray(data) ? data : []); setDeliverymen(Array.isArray(drivers)?drivers:[]); setStatus("ready"); }).catch((requestError) => { setError(requestError.message); setStatus("error"); }); }
  useEffect(load, []);
  async function decide(seller, decision) { setActionId(seller.seller_id); setMessage(""); try { const result = decision === "approve" ? await approveSeller(seller.seller_id) : await rejectSeller(seller.seller_id); setSellers((current) => current.filter((item) => item.seller_id !== seller.seller_id)); setMessage(result.message); } catch (requestError) { setMessage(requestError.message); } finally { setActionId(null); } }
  if (status === "loading") return <Spinner label="Loading pending sellers…" />;
  if (status === "error") return <ErrorState message={error} onRetry={load} />;
  return <section className="admin-dashboard"><p className="eyebrow">Administration</p><h1>Approvals</h1><p className="subtext">Review seller and deliveryman applications.</p>{message && <p className={message.includes("successfully") ? "message success" : "message error"} role="status">{message}</p>}{sellers.length === 0 ? <EmptyState title="No pending sellers" description="New seller applications will appear here." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Registered</th><th>Status</th><th>Action</th></tr></thead><tbody>{sellers.map((seller) => <tr key={seller.seller_id}><td>{seller.name}</td><td>{seller.email}</td><td>{seller.phone}</td><td>{displayDate(seller.created_at)}</td><td>Pending</td><td className="table-actions"><button className="text-button" disabled={actionId === seller.seller_id} onClick={() => decide(seller, "approve")}>Approve</button><button className="text-button remove-link" disabled={actionId === seller.seller_id} onClick={() => decide(seller, "reject")}>Reject</button></td></tr>)}</tbody></table></div>}<h2>Deliverymen</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Approval</th><th>Availability</th><th>Action</th></tr></thead><tbody>{deliverymen.map(d=><tr key={d.deliveryman_id}><td>{d.name}</td><td>{d.email}</td><td>{d.phone}</td><td>{d.approval_status}</td><td>{d.availability_status}</td><td>{d.approval_status==="pending"&&<><button onClick={()=>approveDeliveryman(d.deliveryman_id).then(load)}>Approve</button><button onClick={()=>rejectDeliveryman(d.deliveryman_id).then(load)}>Reject</button></>}</td></tr>)}</tbody></table></div></section>;
}
