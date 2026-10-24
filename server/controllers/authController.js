import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { safeUser } from "../services/authService.js";

export function createAuthController({ users, organizations, pendingVerifications, resetTokens }) {
  async function login(req, res) {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password." });
    const user = [...users.values()].find((candidate) => candidate.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (!user || !await bcrypt.compare(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (!user.verified) return res.status(403).json({ error: "Verify your email before signing in." });
    req.session.regenerate((error) => {
      if (error) return res.status(500).json({ error: "Unable to start a secure session." });
      req.session.userId = user.id;
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
      res.json({ user: safeUser(user), csrfToken: req.session.csrfToken });
    });
  }

  function logout(req, res) {
    req.session.destroy((error) => {
      if (error) return res.status(500).json({ error: "Unable to end the session." });
      res.clearCookie("support.sid", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
      res.status(204).end();
    });
  }

  function me(req, res) {
    res.json({ user: safeUser(req.user) });
  }

  async function signup(req, res) {
    const parsed = z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().email(),
      password: z.string().min(10).max(128),
      organizationId: z.enum(["org-acme", "org-aurora"])
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Check your details. Passwords must be at least 10 characters." });
    const organization = organizations.get(parsed.data.organizationId);
    const emailDomain = parsed.data.email.toLowerCase().split("@")[1];
    if (!organization || organization.emailDomain !== emailDomain) {
      return res.status(400).json({ error: "Use an email address verified for the selected organization." });
    }
    if ([...users.values()].some((user) => user.email.toLowerCase() === parsed.data.email.toLowerCase())) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const id = `usr-${crypto.randomUUID()}`;
    users.set(id, {
      id,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      role: "customer",
      organizationId: parsed.data.organizationId,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      verified: false
    });
    pendingVerifications.set(crypto.createHash("sha256").update(token).digest("hex"), {
      userId: id,
      expiresAt: Date.now() + 30 * 60 * 1000
    });
    res.status(201).json({
      message: "Account created. Verify your email to sign in.",
      ...(process.env.NODE_ENV !== "production" ? { developmentVerificationToken: token } : {})
    });
  }

  function verifyEmail(req, res) {
    const parsed = z.object({ token: z.string().min(32) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid or expired verification link." });
    const key = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
    const record = pendingVerifications.get(key);
    if (!record || record.expiresAt < Date.now()) {
      pendingVerifications.delete(key);
      return res.status(400).json({ error: "Invalid or expired verification link." });
    }
    users.get(record.userId).verified = true;
    pendingVerifications.delete(key);
    res.json({ message: "Email verified. You can now sign in." });
  }

  function recoverPassword(req, res) {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid email address." });
    const user = [...users.values()].find((candidate) => candidate.email.toLowerCase() === parsed.data.email.toLowerCase());
    const response = { message: "If that account exists, password recovery instructions have been sent." };
    if (!user) return res.json(response);
    const token = crypto.randomBytes(32).toString("hex");
    resetTokens.set(crypto.createHash("sha256").update(token).digest("hex"), {
      userId: user.id,
      expiresAt: Date.now() + 30 * 60 * 1000
    });
    res.json({ ...response, ...(process.env.NODE_ENV !== "production" ? { developmentResetToken: token } : {}) });
  }

  async function resetPassword(req, res) {
    const parsed = z.object({ token: z.string().min(32), password: z.string().min(10).max(128) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid reset request. Passwords must be at least 10 characters." });
    const key = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
    const record = resetTokens.get(key);
    if (!record || record.expiresAt < Date.now()) {
      resetTokens.delete(key);
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }
    users.get(record.userId).passwordHash = await bcrypt.hash(parsed.data.password, 12);
    resetTokens.delete(key);
    res.json({ message: "Password updated. Sign in with your new password." });
  }

  return { login, logout, me, signup, verifyEmail, recoverPassword, resetPassword };
}
