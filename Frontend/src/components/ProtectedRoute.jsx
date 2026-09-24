import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import EmptyState from "./EmptyState";

// Wraps a page and only renders it if the signed-in user has an allowed role.
// Usage: <ProtectedRoute allowedRoles={["customer"]}><Cart /></ProtectedRoute>
export default function ProtectedRoute({ allowedRoles, requireApprovedSeller = false, children }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <EmptyState
        title="Please log in"
        description="You need an account to view this page."
        action={<button onClick={() => navigate("/login")}>Login</button>}
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <EmptyState
        title="Not available for your account"
        description={`This page is only available to ${allowedRoles.join(" or ")} accounts.`}
        action={<button onClick={() => navigate("/")}>Back to shop</button>}
      />
    );
  }

  // Check seller approval / suspension
  if (requireApprovedSeller && user.role === "seller" && user.approval_status !== "approved") {
    const isSuspended = user.approval_status === "suspended";
    return (
      <EmptyState
        title={isSuspended ? "Seller Account Suspended" : "Seller approval required"}
        description={
          isSuspended
            ? "Your seller account has been suspended by the administrator. You can contact admin to appeal this decision."
            : "Your seller account is awaiting an admin decision. Check Notifications for updates."
        }
        action={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            {isSuspended && (
              <button onClick={() => navigate("/messages?support=admin&appeal=suspension")}>
                Contact Admin / Appeal Suspension
              </button>
            )}
            <button className="text-button" onClick={() => navigate("/notifications")}>
              View notifications
            </button>
          </div>
        }
      />
    );
  }

  // Check deliveryman approval / suspension
  if (user.role === "deliveryman" && user.approval_status !== "approved") {
    const isSuspended = user.approval_status === "suspended";
    return (
      <EmptyState
        title={isSuspended ? "Deliveryman Account Suspended" : "Deliveryman approval required"}
        description={
          isSuspended
            ? "Your deliveryman account has been suspended by the administrator. You can contact admin to appeal this decision."
            : "Your deliveryman application is awaiting an admin decision. Check Notifications for updates."
        }
        action={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            {isSuspended && (
              <button onClick={() => navigate("/messages?support=admin&appeal=suspension")}>
                Contact Admin / Appeal Suspension
              </button>
            )}
            <button className="text-button" onClick={() => navigate("/notifications")}>
              View notifications
            </button>
          </div>
        }
      />
    );
  }

  return children;
}
