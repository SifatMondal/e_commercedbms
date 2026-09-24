import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { navigate } from "../utils/router";
import { getUnreadMessageCount } from "../services/deliveryService";
import { getUnreadNotificationCount } from "../services/notificationService";
import { useLiveSync } from "../hooks/useLiveSync";

export default function Header() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  function go(path) {
    setMenuOpen(false);
    navigate(path);
  }

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate("/");
  }

  const fetchUnread = async () => {
    if (!user) {
      setUnreadCount(0);
      setUnreadNotifCount(0);
      return;
    }
    try {
      const [msgRes, notifRes] = await Promise.allSettled([
        getUnreadMessageCount(),
        getUnreadNotificationCount()
      ]);
      if (msgRes.status === "fulfilled") {
        setUnreadCount(Number(msgRes.value?.unreadCount || 0));
      }
      if (notifRes.status === "fulfilled") {
        setUnreadNotifCount(Number(notifRes.value?.unreadCount || 0));
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchUnread();
  }, [user]);

  // Live real-time sync for unread messages and notifications
  useLiveSync(["message_sent", "message_read", "notification_sent", "notification_read"], () => {
    fetchUnread();
  }, 4000);

  return (
    <header className="site-header">
      <button className="brand" onClick={() => go("/")}>
        <span>EC</span>
        <p>E-Commerce<br />Portal</p>
      </button>

      <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle menu">☰</button>

      <nav className={menuOpen ? "open" : ""}>
        <button className="nav-link" onClick={() => go("/")}>Products</button>

        {user?.role === "customer" && (
          <>
            <button className="nav-link" onClick={() => go("/wishlist")}>Wishlist</button>
            <button className="nav-link" onClick={() => go("/orders")}>Orders</button>
            <button className="nav-link cart-link" onClick={() => go("/cart")}>
              Cart{itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
            </button>
          </>
        )}

        {user?.role === "seller" && user.approval_status === "approved" && (
          <>
            <button className="nav-link" onClick={() => go("/seller/dashboard")}>Dashboard</button>
            <button className="nav-link" onClick={() => go("/seller/products")}>My Products</button>
            <button className="nav-link" onClick={() => go("/seller/orders")}>Orders</button>
          </>
        )}

        {user?.role === "admin" && (
          <button className="nav-link" onClick={() => go("/admin")}>Admin Dashboard</button>
        )}

        {user?.role === "deliveryman" && user.approval_status === "approved" && (
          <button className="nav-link" onClick={() => go("/delivery/dashboard")}>Delivery Dashboard</button>
        )}

        {user && (
          <button className="nav-link message-nav-link" onClick={() => go("/messages")} title="Messages">
            💬 Messages
            {unreadCount > 0 && (
              <span className="unread-dot-badge" aria-label={`${unreadCount} unread messages`}>
                {unreadCount}
              </span>
            )}
          </button>
        )}

        {user && (
          <button className="nav-link notification-nav-link message-nav-link" onClick={() => go("/notifications")} title="Notifications">
            🔔 Notifications
            {unreadNotifCount > 0 && (
              <span className="unread-dot-badge" aria-label={`${unreadNotifCount} unread notifications`}>
                {unreadNotifCount}
              </span>
            )}
          </button>
        )}

        {user ? (
          <>
            <span className="user-label">{user.name}</span>
            <button className="nav-link" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <button className="nav-link" onClick={() => go("/login")}>Login</button>
            <button className="nav-link" onClick={() => go("/register")}>Register</button>
          </>
        )}
      </nav>
    </header>
  );
}
