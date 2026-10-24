import { Router } from "express";
import { createAccountController } from "../controllers/accountController.js";

export function createAccountRoutes({ requireAuth, organizations }) {
  const router = Router();
  const controller = createAccountController({ organizations });
  router.get("/organization", requireAuth, controller.getOrganization);
  return router;
}
