"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { IconCheck } from "@/components/icons";
import { AppButton } from "@/components/ui/AppButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/config/routes";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        <div className="login-brand-intro">
          <div className="login-brand-mark">
            <BrandLogo variant="mark" size="lg" priority />
          </div>
          <h1>Decent ERP</h1>
          <p>
            End-to-end design lifecycle management for Saree, Suit, Kurti, Lehenga
            and textile products — from concept to production release.
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
        <Card className="w-full max-w-md shadow-md mx-auto">
          <CardHeader className="space-y-1">
            <div className="login-form-logo mb-3 flex justify-center">
              <BrandLogo variant="mark" size="md" priority />
            </div>
            <CardTitle className="text-[length:var(--font-size-h1)]">Sign in</CardTitle>
            <CardDescription>Design Management Module</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div
                className="mb-4 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]"
                role="alert"
              >
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <AppButton type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in to workspace"}
              </AppButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
