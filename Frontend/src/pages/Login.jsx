import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(() => {
    const flash = typeof window !== "undefined" ? sessionStorage.getItem("auth_flash") : "";
    if (flash) {
      sessionStorage.removeItem("auth_flash");
      return flash;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("registered")) {
        return "Account created successfully. Please log in.";
      }
    }
    return "";
  });
  const [loading, setLoading] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(form);
      const role = result.user.role;
      if (role === "admin") {
        navigate("/admin");
      } else if (role === "seller") {
        navigate("/seller/dashboard");
      } else if (role === "deliveryman") {
        navigate("/delivery/dashboard");
      } else {
        navigate("/");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">Welcome back</p>
      <h1>Sign in to your account</h1>
      <p className="subtext">Enter your email and password to access your account.</p>
      {success && <p className="message success" role="status">{success}</p>}
      <form onSubmit={submit} noValidate>
        <label>Email<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="message error" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Logging in…" : "Login"}</button>
      </form>
      <p className="switch">New here? <button className="text-button" onClick={() => navigate("/register")}>Create an account</button></p>
    </section>
  );
}
