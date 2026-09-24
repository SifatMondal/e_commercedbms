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

  if (requireApprovedSeller && user.approval_status !== "approved") {
    return <EmptyState title="Seller approval required" description="Your seller account is awaiting an admin decision. Check Notifications for updates." action={<button onClick={() => navigate("/notifications")}>View notifications</button>} />;
  }
  return children;
}
