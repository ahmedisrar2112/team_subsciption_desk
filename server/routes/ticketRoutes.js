import { Router } from "express";
import { createTicketController } from "../controllers/ticketController.js";
import { asyncRoute } from "./asyncRoute.js";

export function createTicketRoutes({ requireAuth, csrf, requireRole, tickets, users, service, persistTicket, audit }) {
  const router = Router();
  const controller = createTicketController({ tickets, users, service, persistTicket, audit });

  router.get("/tickets", requireAuth, controller.listTickets);
  router.post("/tickets", requireAuth, csrf, requireRole("customer"), asyncRoute(controller.createTicket));
  router.get("/tickets/:id", requireAuth, controller.getTicket);
  router.patch("/tickets/:id", requireAuth, csrf, requireRole("specialist", "supervisor"), asyncRoute(controller.updateTicket));
  router.post("/tickets/:id/resolution", requireAuth, csrf, requireRole("specialist", "supervisor"), asyncRoute(controller.resolveTicket));
  router.post("/tickets/:id/escalation", requireAuth, csrf, requireRole("specialist", "supervisor"), asyncRoute(controller.escalateTicket));
  router.post("/tickets/:id/assignment", requireAuth, csrf, requireRole("supervisor"), asyncRoute(controller.assignTicket));
  router.get("/staff/queue", requireAuth, requireRole("specialist", "supervisor"), controller.staffQueue);
  router.get("/staff/specialists", requireAuth, requireRole("supervisor"), controller.specialists);
  return router;
}
