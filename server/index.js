import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import { TicketVector } from "./models/Ticket.js";
import { createStore } from "./models/store.js";
import { createSupportService } from "./services/supportService.js";
import { createSupportRoutes } from "./routes/supportRoutes.js";
import { createTicketRoutes } from "./routes/ticketRoutes.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createKnowledgeRoutes } from "./routes/knowledgeRoutes.js";
import { createAccountRoutes } from "./routes/accountRoutes.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const sessionSecret = process.env.SESSION_SECRET || "development-only-change-this-secret-before-deploy";
const sessionTtlMs = 8 * 60 * 60 * 1000;
const mongoUri = process.env.MONGODB_URI;
const mongoEnabled = Boolean(mongoUri);

if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("Production requires a SESSION_SECRET of at least 32 characters.");
}
if (process.env.NODE_ENV === "production" && !mongoEnabled) {
  throw new Error("Production requires MONGODB_URI for persistent sessions.");
}

if (mongoEnabled) {
  try {
    await mongoose.connect(mongoUri);
  } catch {
    throw new Error("MongoDB connection failed. Verify MONGODB_URI and the Atlas network access rules.");
  }
}

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(express.json({ limit: "32kb" }));
app.use(session({
  name: "support.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  ...(mongoEnabled ? { store: MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: "sessions",
    ttl: Math.floor(sessionTtlMs / 1000)
  }) } : {}),
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionTtlMs
  }
}));

const store = await createStore({ mongoEnabled });
const { users, organizations, tickets, helpArticles, incidents, drafts, auditEvents, resetTokens, pendingVerifications, persistTicket } = store;
const supportService = createSupportService({ tickets, helpArticles, incidents, TicketVector, mongoEnabled });
if (mongoEnabled && process.env.OLLAMA_URL) {
  const indexedTicketIds = new Set((await TicketVector.find({}).select("ticketId").lean()).map(({ ticketId }) => ticketId));
  for (const ticket of tickets.values()) {
    if (indexedTicketIds.has(ticket.id)) continue;
    try {
      await supportService.createTicketEmbedding(ticket);
    } catch (error) {
      console.warn(`Semantic index seed unavailable for ${ticket.id}: ${error.name || "Error"}`);
    }
  }
}
function requireAuth(req, res, next) {
  const user = users.get(req.session.userId);
  if (!user || !user.verified) return res.status(401).json({ error: "Sign in with a verified account to continue." });
  req.user = user;
  next();
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) return res.status(403).json({ error: "This action is not permitted for your role." });
    next();
  };
}

function csrf(req, res, next) {
  const supplied = req.get("x-csrf-token");
  const expectedBytes = req.session.csrfToken ? Buffer.from(req.session.csrfToken) : Buffer.alloc(0);
  const suppliedBytes = supplied ? Buffer.from(supplied) : Buffer.alloc(0);
  if (expectedBytes.length === 0 || expectedBytes.length !== suppliedBytes.length ||
    !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
    return res.status(403).json({ error: "Security token expired. Refresh and try again." });
  }
  next();
}

function audit(action, userId, ticketId, detail = {}) {
  auditEvents.push({ action, userId, ticketId, detail, at: new Date().toISOString() });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

app.use("/api", createAuthRoutes({
  requireAuth,
  csrf,
  loginLimiter,
  users,
  organizations,
  pendingVerifications,
  resetTokens
}));
app.use("/api", createSupportRoutes({
  requireAuth,
  csrf,
  requireRole,
  tickets,
  organizations,
  service: supportService,
  persistTicket,
  audit
}));
app.use("/api", createKnowledgeRoutes({
  requireAuth,
  csrf,
  requireRole,
  helpArticles,
  incidents,
  drafts
}));
app.use("/api", createTicketRoutes({
  requireAuth,
  csrf,
  requireRole,
  tickets,
  users,
  service: supportService,
  persistTicket,
  audit
}));
app.use("/api", createAccountRoutes({ requireAuth, organizations }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error.name || "Error");
  res.status(500).json({ error: "The request could not be completed." });
});

if (process.env.NODE_ENV === "production") {
  const { default: path } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const clientBuild = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(clientBuild));
  app.get("*", (_req, res) => res.sendFile(path.join(clientBuild, "index.html")));
}

app.listen(port, () => {
  console.log(`Support Desk API listening on http://localhost:${port}`);
});
