import { Router } from "express";
import { createKnowledgeController } from "../controllers/knowledgeController.js";

export function createKnowledgeRoutes({ requireAuth, csrf, requireRole, helpArticles, incidents, drafts }) {
  const router = Router();
  const controller = createKnowledgeController({ helpArticles, incidents, drafts });

  router.get("/help", controller.listHelp);
  router.get("/status", controller.listStatus);
  router.post("/help-drafts", requireAuth, csrf, requireRole("knowledge_manager"), controller.createDraft);
  router.post("/help-drafts/:id/publish", requireAuth, csrf, requireRole("knowledge_manager"), controller.publishDraft);
  return router;
}
