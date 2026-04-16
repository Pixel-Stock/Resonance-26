"use client";

import { signIn } from "next-auth/react";

import { Shield } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/",
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0eeeb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        className="glass-outer"
        style={{
          maxWidth: 400,
          width: "100%",
          padding: "3rem 2.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
            boxShadow: "0 8px 24px rgba(124,58,237,0.3), inset 0 1px 1px rgba(255,255,255,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Shield style={{ width: 30, height: 30, color: "white" }} />
        </div>

        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b", margin: 0, letterSpacing: "-0.02em" }}>
            Log Sentinel
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.4rem", margin: "0.4rem 0 0" }}>
            AI-Powered Cybersecurity Anomaly Detection
          </p>
        </div>

        <div style={{ width: "100%", height: 1, background: "rgba(0,0,0,0.08)" }} />

        {/* Email/password form */}
        <form onSubmit={handleCredentials} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {error && (
            <p style={{ fontSize: "0.8rem", color: "#ef4444", margin: 0, textAlign: "left" }}>{error}</p>
          )}
          <button type="submit" disabled={loading} style={{ ...btnStyle, background: "#7c3aed", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" style={{ color: "#7c3aed", fontWeight: 600, textDecoration: "none" }}>
            Register
          </Link>
        </p>

<p style={{ fontSize: "0.72rem", color: "#94a3b8", maxWidth: 280, lineHeight: 1.5, margin: 0 }}>
          Your session is private. Log data is processed locally and never stored in your account.
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(0,0,0,0.12)",
  fontSize: "0.9rem",
  fontFamily: "var(--font-sans)",
  background: "rgba(255,255,255,0.7)",
  color: "#1e293b",
  outline: "none",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 24px",
  borderRadius: 999,
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "white",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.75rem",
  fontFamily: "var(--font-sans)",
};

