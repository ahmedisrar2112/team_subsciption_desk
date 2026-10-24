import crypto from "node:crypto";
import { Router } from "express";
import { createAuthController } from "../controllers/authController.js";
import { asyncRoute } from "./asyncRoute.js";

export function createAuthRoutes({ requireAuth, csrf, loginLimiter, users, organizations, pendingVerifications, resetTokens }) {
  const router = Router();
  const controller = createAuthController({ users, organizations, pendingVerifications, resetTokens });

  router.get("/csrf", (req, res) => {
    req.session.csrfToken ||= crypto.randomBytes(32).toString("hex");
    res.json({ csrfToken: req.session.csrfToken });
  });
  router.post("/auth/login", loginLimiter, csrf, asyncRoute(controller.login));
  router.post("/auth/logout", csrf, controller.logout);
  router.get("/auth/me", requireAuth, controller.me);
  router.post("/auth/signup", csrf, asyncRoute(controller.signup));
  router.post("/auth/verify-email", csrf, controller.verifyEmail);
  router.post("/auth/password/recover", csrf, controller.recoverPassword);
  router.post("/auth/password/reset", csrf, asyncRoute(controller.resetPassword));
  return router;
}
