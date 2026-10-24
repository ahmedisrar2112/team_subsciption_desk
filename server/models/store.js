import bcrypt from "bcryptjs";
import { TicketRecord } from "./Ticket.js";

const articleFixtures = [
  {
    id: "help-export-limits-v3", slug: "export-limits", title: "Exporting reports by plan",
    version: 3, productVersion: "2.x", category: "Plans & billing",
    excerpt: "Learn which plans include report exports and how to check your workspace limits.",
    body: "Report exports are included with the Scale plan. Starter workspaces can view reports but cannot download CSV or PDF files. An organization owner can compare plan entitlements from Workspace settings → Plan. If export is included but unavailable, confirm the workspace and report date range, then check the service status page.",
    published: true, updatedAt: "2026-02-12"
  },
  {
    id: "help-report-troubleshooting-v2", slug: "report-troubleshooting", title: "Troubleshooting report downloads",
    version: 2, productVersion: "2.x", category: "Troubleshooting",
    excerpt: "Resolve common report download errors and collect the right details for support.",
    body: "For a failed report download, retry with a smaller date range and confirm you have the Reports permission. Note the exact error, time, report name, and workspace. Do not include passwords or payment details in a support request. If a current service incident affects exports, wait for the incident update before retrying.",
    published: true, updatedAt: "2026-03-04"
  },
  {
    id: "help-workspace-roles-v1", slug: "workspace-roles", title: "Workspace roles and access",
    version: 1, productVersion: "2.x", category: "Getting started",
    excerpt: "Understand workspace roles and request the right access from an administrator.",
    body: "Workspace owners manage plan settings and invite members. Admins manage members and workspace configuration. Members can use features granted by their role and plan. Ask an owner to review your role if a permitted feature is not visible.",
    published: true, updatedAt: "2026-01-26"
  }
];

const organizationFixtures = [
  { id: "org-acme", name: "Acme Studio", emailDomain: "acme.example", plan: "Starter", members: 8, memberLimit: 10, features: { report_exports: false, advanced_analytics: false, priority_support: false } },
  { id: "org-aurora", name: "Aurora Labs", emailDomain: "aurora.example", plan: "Scale", members: 24, memberLimit: 50, features: { report_exports: true, advanced_analytics: true, priority_support: true } }
];

const incidentFixtures = [
  {
    id: "inc-204", feature: "report_exports", title: "Intermittent report export delays",
    status: "monitoring", severity: "minor", updatedAt: "2026-10-24T08:10:00.000Z",
    publicUpdate: "Some report exports are taking longer than usual. The team is monitoring the queue; existing reports and dashboard data remain available."
  },
  {
    id: "inc-198", feature: "authentication", title: "Resolved sign-in delays",
    status: "resolved", severity: "minor", updatedAt: "2026-10-21T15:35:00.000Z",
    publicUpdate: "Sign-in performance has returned to normal."
  }
];

export async function createStore({ mongoEnabled }) {
  const users = new Map();
  const organizations = new Map();
  const tickets = new Map();
  const helpArticles = new Map();
  const incidents = new Map();
  const drafts = new Map();
  const auditEvents = [];
  const resetTokens = new Map();
  const pendingVerifications = new Map();

  if (mongoEnabled) {
    const records = await TicketRecord.find({}).lean();
    for (const record of records) tickets.set(record.ticketId, record.data);
  }

  for (const organization of organizationFixtures) organizations.set(organization.id, structuredClone(organization));
  for (const article of articleFixtures) helpArticles.set(article.id, structuredClone(article));
  for (const incident of incidentFixtures) incidents.set(incident.id, structuredClone(incident));

  const demoUsers = [
    { id: "usr-maya", name: "Maya Chen", email: "maya@acme.example", role: "customer", organizationId: "org-acme" },
    { id: "usr-noah", name: "Noah Patel", email: "noah@aurora.example", role: "customer", organizationId: "org-aurora" },
    { id: "usr-sam", name: "Sam Rivera", email: "sam@northstar.example", role: "specialist", organizationId: null },
    { id: "usr-jules", name: "Jules Park", email: "jules@northstar.example", role: "knowledge_manager", organizationId: null },
    { id: "usr-aria", name: "Aria Morgan", email: "aria@northstar.example", role: "supervisor", organizationId: null }
  ];
  for (const user of demoUsers) users.set(user.id, { ...user, passwordHash: await bcrypt.hash("Demo123!", 10), verified: true });

  const ticketFixtures = [
    {
      id: "tkt-1042", subject: "Report export is unavailable", description: "I can view the report, but the export button is disabled.",
      createdBy: "usr-maya", organizationId: "org-acme", status: "open", priority: "normal", assigneeId: "usr-sam",
      createdAt: "2026-10-24T09:20:00.000Z", messages: [], checks: [], resolution: null, escalation: null
    },
    {
      id: "tkt-1043", subject: "Exports are still processing", description: "Our Scale workspace export has been processing for several minutes.",
      createdBy: "usr-noah", organizationId: "org-aurora", status: "open", priority: "normal", assigneeId: "usr-sam",
      createdAt: "2026-10-24T09:35:00.000Z", messages: [], checks: [], resolution: null, escalation: null
    }
  ];
  for (const ticket of ticketFixtures) {
    if (!tickets.has(ticket.id)) tickets.set(ticket.id, ticket);
  }

  async function persistTicket(ticket) {
    if (!mongoEnabled) return;
    await TicketRecord.updateOne(
      { ticketId: ticket.id },
      { $set: { ticketId: ticket.id, organizationId: ticket.organizationId, data: ticket } },
      { upsert: true }
    );
  }

  if (mongoEnabled) await Promise.all([...tickets.values()].map(persistTicket));

  return {
    users, organizations, tickets, helpArticles, incidents, drafts, auditEvents,
    resetTokens, pendingVerifications, persistTicket
  };
}
