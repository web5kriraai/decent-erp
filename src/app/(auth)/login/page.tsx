"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconCheck, IconDesigns } from "@/components/icons";
import { ROUTES } from "@/config/routes";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@decent-erp.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password. Please try again.");
        return;
      }
      router.push(ROUTES.dashboard);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand-panel">
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: "rgba(255,255,255,0.15)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.5rem",
            }}
          >
            <IconDesigns size={28} />
          </div>
          <h1>Decent ERP</h1>
          <p>
            End-to-end design lifecycle management for Saree, Suit, Kurti, Lehenga
            and textile products - from concept to production release.
          </p>
        </div>
        <div className="login-features">
          {[
            "Sketch → Punching → Sample workflow",
            "Server-authoritative task timers & KPI",
            "Multi-level approval & costing rollup",
          ].map((text) => (
            <div key={text} className="login-feature">
              <span className="login-feature-icon">
                <IconCheck size={14} />
              </span>
              {text}
            </div>
          ))}
        </div>
      </div>

      <div className="login-form-panel">
        <div className="login-form-card">
          <h2>Sign in</h2>
          <p style={{ color: "var(--color-neutral-500)", marginBottom: "1.5rem" }}>
            Design Management Module
          </p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }} role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in to workspace"}
            </button>
          </form>

          <p
            className="form-hint"
            style={{ marginTop: "1.25rem", textAlign: "center" }}
          >
            Default: admin@decent-erp.local / Admin@123
          </p>
        </div>
      </div>
    </div>
  );
}
