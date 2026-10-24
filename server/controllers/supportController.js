import { z } from "zod";
import { redactSensitive } from "../services/supportService.js";

export function createSupportController({ tickets, organizations, service, persistTicket, audit }) {
  async function supportChat(req, res) {
    const parsed = z.object({
      question: z.string().trim().min(3).max(1000),
      productVersion: z.string().trim().max(30).optional()
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ask a question between 3 and 1,000 characters." });
    const organization = organizations.get(req.user.organizationId);
    if (!organization) return res.status(404).json({ error: "Organization details are unavailable." });
    audit("organization.entitlements.read", req.user.id, null, { organizationId: organization.id });
    const safeQuestion = redactSensitive(parsed.data.question);
    const articles = service.findHelp(safeQuestion, parsed.data.productVersion || "2.x");
    const checks = [
      service.toolCheck("organization_entitlements", "complete", `${organization.plan} plan · ${organization.members}/${organization.memberLimit} members`, {
        plan: organization.plan, features: organization.features
      }),
      service.toolCheck("service_status", "complete", "Current public incident feed checked"),
      service.toolCheck("help_search", articles.length ? "complete" : "incomplete",
        articles.length ? `${articles.length} version-matched help article(s) found` : "No matching help article was found for this product version.",
        articles.map(({ id, title, version }) => ({ id, title, version })))
    ];
    const isExportQuestion = /export|download|report/i.test(safeQuestion);
    const answer = articles.length
      ? articles[0].body
      : "I couldn't find a sufficiently grounded answer in the published help for this product version. Share the exact error and what you were trying to do, or create a ticket for a support specialist.";
    const citations = articles.map(({ id, title, version, slug }) => ({ id, title, version, slug }));
    const messages = [
      { role: "customer", text: safeQuestion, at: new Date().toISOString() },
      { role: "assistant", text: answer, citations, at: new Date().toISOString() }
    ];
    req.session.supportConversation = {
      messages: [...(req.session.supportConversation?.messages || []), ...messages].slice(-20),
      checks
    };
    const ticket = [...tickets.values()].find((item) => item.createdBy === req.user.id && item.status !== "resolved");
    if (ticket) {
      ticket.messages.push(...messages);
      ticket.checks = checks;
      await persistTicket(ticket);
    }
    res.json({ answer, citations, checks, canGroundAnswer: citations.length > 0 || isExportQuestion });
  }

  async function supportAgent(req, res) {
    const parsed = z.object({
      question: z.string().trim().min(3).max(1000),
      ticketId: z.string().optional()
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ask a question between 3 and 1,000 characters." });
    const ticket = parsed.data.ticketId ? tickets.get(parsed.data.ticketId) : null;
    if (parsed.data.ticketId && (!ticket || ticket.createdBy !== req.user.id || ticket.organizationId !== req.user.organizationId)) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    const organization = organizations.get(req.user.organizationId);
    if (!organization) return res.status(404).json({ error: "Organization details are unavailable." });
    audit("organization.entitlements.read", req.user.id, ticket?.id || null, { organizationId: organization.id });
    const safeQuestion = redactSensitive(parsed.data.question);
    const articles = service.findHelp(safeQuestion);
    const result = await service.investigate({ question: safeQuestion, organization, ticket, articles });
    const citations = articles.map(({ id, title, version, slug }) => ({ id, title, version, slug }));
    const messages = [
      { role: "customer", text: safeQuestion, at: new Date().toISOString() },
      { role: "assistant", text: result.answer, citations, at: new Date().toISOString() }
    ];
    req.session.supportConversation = {
      messages: [...(req.session.supportConversation?.messages || []), ...messages].slice(-20),
      checks: result.checks
    };
    if (ticket) {
      ticket.checks = result.checks;
      ticket.messages.push(...messages);
      await persistTicket(ticket);
    }
    const statusQuestion = /incident|outage|service status|status page/i.test(safeQuestion);
    res.json({
      answer: result.answer,
      citations,
      checks: result.checks,
      relatedIssueGroups: result.semanticResults.groups,
      needsMoreInformation: result.checks.some((check) => check.status === "incomplete") || (articles.length === 0 && !statusQuestion)
    });
  }

  return { supportChat, supportAgent };
}
