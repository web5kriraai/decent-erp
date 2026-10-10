"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { IconCheck } from "@/components/icons";
import { AppButton } from "@/components/ui/AppButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/PasswordField";
import { ROUTES } from "@/config/routes";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
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
        remember: rememberMe ? "true" : "false",
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
        <div className="login-brand-intro">
          <div className="login-brand-mark">
            <BrandLogo variant="mark" size="lg" priority />
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
          <div className="login-form-logo mb-3 flex justify-center">
            <BrandLogo variant="mark" size="md" priority />
          </div>
          <h2 className="text-[length:var(--font-size-h1)] font-semibold">Sign in</h2>
          <p className="login-form-subtitle text-sm">Design Management Module</p>

          {error ? (
            <div className="login-error-alert rounded-lg border px-3 py-2 text-sm" role="alert">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
            />
            <label className="login-remember-row" htmlFor="rememberMe">
              <input
                id="rememberMe"
                type="checkbox"
                className="login-remember-row__input"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span className="login-remember-row__label">Keep me signed in on this device</span>
            </label>
            <AppButton type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in to workspace"}
            </AppButton>
          </form>
        </div>
      </div>
    </div>
  );
}
