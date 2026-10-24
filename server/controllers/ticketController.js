import crypto from "node:crypto";
import { z } from "zod";

export function createTicketController({ tickets, users, service, persistTicket, audit }) {
  function listTickets(req, res) {
    const visible = [...tickets.values()].filter((ticket) =>
      req.user.role === "customer"
        ? ticket.createdBy === req.user.id && ticket.organizationId === req.user.organizationId
        : req.user.role === "supervisor" || (req.user.role === "specialist" && ticket.assigneeId === req.user.id)
    );
    res.json({ tickets: visible });
  }

  function getTicket(req, res) {
    const ticket = tickets.get(req.params.id);
    const visible = ticket && (
      (req.user.role === "customer" && ticket.createdBy === req.user.id && ticket.organizationId === req.user.organizationId) ||
      req.user.role === "supervisor" ||
      (req.user.role === "specialist" && ticket.assigneeId === req.user.id)
    );
    if (!visible) return res.status(404).json({ error: "Ticket not found." });
    res.json({ ticket });
  }

  async function createTicket(req, res) {
    const parsed = z.object({
      subject: z.string().trim().min(5).max(120),
      description: z.string().trim().min(10).max(4000)
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Add a subject and at least 10 characters of detail." });
    const id = `tkt-${crypto.randomUUID()}`;
    const ticket = {
      id,
      subject: service.redactSensitive(parsed.data.subject),
      description: service.redactSensitive(parsed.data.description),
      createdBy: req.user.id,
      organizationId: req.user.organizationId,
      status: "open",
      priority: "normal",
      assigneeId: null,
      createdAt: new Date().toISOString(),
      messages: req.session.supportConversation?.messages || [],
      checks: req.session.supportConversation?.checks || [],
      resolution: null,
      escalation: null
    };
    tickets.set(id, ticket);
    await persistTicket(ticket);
    try {
      await service.createTicketEmbedding(ticket);
    } catch (error) {
      ticket.checks = [service.toolCheck("groupRelatedTickets", "incomplete", `Ticket saved, but its semantic index could not be updated: ${error.message}`)];
      await persistTicket(ticket);
    }
    delete req.session.supportConversation;
    res.status(201).json({ ticket });
  }

  async function updateTicket(req, res) {
    const ticket = tickets.get(req.params.id);
    if (!ticket || !["supervisor", "specialist"].includes(req.user.role) ||
      (req.user.role === "specialist" && ticket.assigneeId !== req.user.id)) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    const parsed = z.object({
      status: z.enum(["open", "waiting_on_customer", "in_progress", "resolved"]).optional(),
      priority: z.enum(["low", "normal", "high"]).optional()
    }).strict().safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) return res.status(400).json({ error: "Provide a valid status or priority update." });
    Object.assign(ticket, parsed.data, { updatedAt: new Date().toISOString() });
    await persistTicket(ticket);
    res.json({ ticket });
  }

  async function resolveTicket(req, res) {
    const ticket = tickets.get(req.params.id);
    if (!ticket || !["supervisor", "specialist"].includes(req.user.role) ||
      (req.user.role === "specialist" && ticket.assigneeId !== req.user.id)) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    const parsed = z.object({ summary: z.string().trim().min(10).max(2000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Add a resolution summary." });
    ticket.resolution = { ...parsed.data, by: req.user.id, at: new Date().toISOString() };
    ticket.status = "resolved";
    await persistTicket(ticket);
    res.json({ ticket });
  }

  async function escalateTicket(req, res) {
    const ticket = tickets.get(req.params.id);
    if (!ticket || !["supervisor", "specialist"].includes(req.user.role) ||
      (req.user.role === "specialist" && ticket.assigneeId !== req.user.id)) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    const parsed = z.object({ reason: z.string().trim().min(10).max(1000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Add an escalation reason." });
    ticket.escalation = { ...parsed.data, by: req.user.id, at: new Date().toISOString(), checks: ticket.checks };
    ticket.status = "in_progress";
    await persistTicket(ticket);
    res.json({ ticket });
  }

  async function assignTicket(req, res) {
    const ticket = tickets.get(req.params.id);
    const parsed = z.object({ assigneeId: z.string().min(1) }).safeParse(req.body);
    const assignee = parsed.success ? users.get(parsed.data.assigneeId) : null;
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });
    if (!assignee || assignee.role !== "specialist") return res.status(400).json({ error: "Choose a support specialist." });
    ticket.assigneeId = assignee.id;
    audit("ticket.assignment", req.user.id, ticket.id, { assigneeId: assignee.id });
    await persistTicket(ticket);
    res.json({ ticket });
  }

  function staffQueue(req, res) {
    const queue = [...tickets.values()].filter((ticket) =>
      req.user.role === "supervisor" || (req.user.role === "specialist" && ticket.assigneeId === req.user.id)
    );
    res.json({ tickets: queue });
  }

  function specialists(_req, res) {
    res.json({ specialists: [...users.values()].filter((user) => user.role === "specialist").map(({ id, name, email, role, organizationId }) => ({ id, name, email, role, organizationId })) });
  }

  return { listTickets, getTicket, createTicket, updateTicket, resolveTicket, escalateTicket, assignTicket, staffQueue, specialists };
}
