import crypto from "node:crypto";
import { z } from "zod";
import { publicIncident, publishHelpDraft } from "../services/knowledgeService.js";

export function createKnowledgeController({ helpArticles, incidents, drafts }) {
  function listHelp(_req, res) {
    res.json({
      articles: [...helpArticles.values()].filter((article) => article.published).map((article) => ({
        id: article.id,
        slug: article.slug,
        title: article.title,
        version: article.version,
        productVersion: article.productVersion,
        category: article.category,
        excerpt: article.excerpt,
        body: article.body,
        updatedAt: article.updatedAt
      }))
    });
  }

  function listStatus(_req, res) {
    res.json({ incidents: [...incidents.values()].map(publicIncident) });
  }

  function createDraft(req, res) {
    const parsed = z.object({
      title: z.string().trim().min(5).max(140),
      excerpt: z.string().trim().min(10).max(300),
      body: z.string().trim().min(30).max(6000),
      productVersion: z.string().trim().min(1).max(30),
      category: z.string().trim().min(2).max(60)
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Complete each draft field before saving." });
    const id = `draft-${crypto.randomUUID()}`;
    const draft = { id, ...parsed.data, createdBy: req.user.id, createdAt: new Date().toISOString() };
    drafts.set(id, draft);
    res.status(201).json({ draft });
  }

  function publishDraft(req, res) {
    const draft = drafts.get(req.params.id);
    if (!draft) return res.status(404).json({ error: "Draft not found." });
    const article = publishHelpDraft(draft, helpArticles);
    helpArticles.set(article.id, article);
    drafts.delete(draft.id);
    res.status(201).json({ article });
  }

  return { listHelp, listStatus, createDraft, publishDraft };
}
