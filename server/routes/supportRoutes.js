import { Router } from "express";
import { createSupportController } from "../controllers/supportController.js";
import { asyncRoute } from "./asyncRoute.js";

export function createSupportRoutes({ requireAuth, csrf, requireRole, tickets, organizations, service, persistTicket, audit }) {
  const router = Router();
  const controller = createSupportController({ tickets, organizations, service, persistTicket, audit });

  router.post("/support-chat", requireAuth, csrf, requireRole("customer"), asyncRoute(controller.supportChat));
  router.post("/support-agent", requireAuth, csrf, requireRole("customer"), asyncRoute(controller.supportAgent));
  return router;
}
