import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export function redactSensitive(value) {
  return value
    .replace(/\b(password|passcode|secret|api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|token|cvv|cvc|security code|card number|credit card|debit card)\s*(?:is|[:=])\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED TOKEN]")
    .replace(/\b(?:sk|pk|rk|ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{10,}\b/gi, "[REDACTED TOKEN]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED PAYMENT NUMBER]");
}

export function createSupportService({ tickets, helpArticles, incidents, TicketVector, mongoEnabled }) {
  function toolCheck(name, status, summary, data = null) {
    return { name, status, summary, ...(data ? { data } : {}), checkedAt: new Date().toISOString() };
  }

  function findHelp(query, productVersion = "2.x") {
    const stopWords = new Set(["why", "can", "cannot", "my", "the", "is", "there", "how", "do", "i", "what", "where", "when", "your", "this", "that", "with", "for", "about"]);
    const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word));
    return [...helpArticles.values()]
      .filter((article) => article.published && article.productVersion === productVersion)
      .map((article) => {
        const articleWords = `${article.title} ${article.excerpt} ${article.body}`.toLowerCase().split(/[^a-z0-9]+/);
        const score = words.reduce((sum, word) => sum + (articleWords.some((articleWord) => articleWord === word || articleWord.startsWith(word)) ? 1 : 0), 0);
        return { article, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(({ article }) => article);
  }

  function currentFeatureIncidents(feature = null) {
    return [...incidents.values()]
      .filter((incident) => (!feature || incident.feature === feature) && incident.status !== "resolved")
      .map(({ id, title, status, severity, updatedAt, publicUpdate }) => ({ id, title, status, severity, updatedAt, publicUpdate }));
  }

  function issueGroupFor(text) {
    if (/export|report|download/i.test(text)) return "report_exports";
    if (/sign.?in|login|authentication/i.test(text)) return "authentication";
    if (/invite|member|team/i.test(text)) return "workspace_access";
    return "general_support";
  }

  async function createTicketEmbedding(ticket) {
    if (!mongoEnabled || !process.env.OLLAMA_URL) return;
    const embeddings = new OllamaEmbeddings({
      baseUrl: process.env.OLLAMA_URL,
      model: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text"
    });
    const embedding = await embeddings.embedQuery(`${ticket.subject}\n${ticket.description}`);
    await TicketVector.updateOne(
      { ticketId: ticket.id },
      { $set: { ticketId: ticket.id, organizationId: ticket.organizationId, issueGroup: issueGroupFor(ticket.subject), embedding } },
      { upsert: true }
    );
  }

  async function findRelatedIssueGroups(question, organizationId, excludedTicketId) {
    const fallback = [...tickets.values()]
      .filter((ticket) => ticket.organizationId === organizationId && ticket.id !== excludedTicketId)
      .filter((ticket) => issueGroupFor(`${ticket.subject} ${ticket.description}`) === issueGroupFor(question))
      .reduce((groups, ticket) => {
        const category = issueGroupFor(`${ticket.subject} ${ticket.description}`);
        groups.set(category, (groups.get(category) || 0) + 1);
        return groups;
      }, new Map());
    const fallbackGroups = [...fallback].map(([category, relatedCount]) => ({ category, relatedCount }));

    if (!mongoEnabled || !process.env.OLLAMA_URL || !process.env.ATLAS_VECTOR_INDEX) {
      return {
        check: toolCheck("groupRelatedTickets", "incomplete", "Atlas Vector Search is not configured; showing a private, organization-scoped keyword grouping fallback."),
        groups: fallbackGroups
      };
    }

    try {
      const embeddings = new OllamaEmbeddings({
        baseUrl: process.env.OLLAMA_URL,
        model: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text"
      });
      const queryVector = await embeddings.embedQuery(question);
      const groups = await TicketVector.aggregate([
        {
          $vectorSearch: {
            index: process.env.ATLAS_VECTOR_INDEX,
            path: "embedding",
            queryVector,
            numCandidates: 50,
            limit: 8,
            filter: { organizationId }
          }
        },
        { $match: { ticketId: { $ne: excludedTicketId || "" } } },
        { $group: { _id: "$issueGroup", relatedCount: { $sum: 1 } } },
        { $project: { _id: 0, category: "$_id", relatedCount: 1 } }
      ]);
      return {
        check: toolCheck("groupRelatedTickets", "complete", groups.length
          ? `${groups.reduce((count, group) => count + group.relatedCount, 0)} related organization issue(s) grouped privately.`
          : "No semantically related organization tickets were found."),
        groups
      };
    } catch (error) {
      return {
        check: toolCheck("groupRelatedTickets", "incomplete", `Semantic grouping failed: ${error.message}`),
        groups: fallbackGroups
      };
    }
  }

  async function investigate({ question, organization, ticket, articles }) {
    const feature = /sign.?in|login|authentication/i.test(question)
      ? "authentication"
      : /export|download|report/i.test(question)
        ? "report_exports"
        : null;
    const activeIncidents = currentFeatureIncidents(feature);
    const entitlementCheck = toolCheck("readEntitlements", "complete", `${organization.plan} plan entitlements loaded for your organization`, {
      plan: organization.plan, features: organization.features, members: organization.members, memberLimit: organization.memberLimit
    });
    const statusCheck = toolCheck("readServiceStatus", "complete", activeIncidents.length
      ? `${activeIncidents.length} active report export incident(s) found`
      : "No active report export incident found", activeIncidents);
    const helpCheck = toolCheck("searchHelp", articles.length ? "complete" : "incomplete",
      articles.length ? `${articles.length} relevant help article(s) for product 2.x` : "No matching help article was found.",
      articles.map((article) => ({ id: article.id, title: article.title, version: article.version })));

    let answer;
    if (/incident|outage|service status|status page/i.test(question)) {
      answer = activeIncidents.length
        ? `The current service status shows ${activeIncidents.length} active incident(s). ${activeIncidents[0].title}: ${activeIncidents[0].publicUpdate} I can’t confirm resolution until the status data changes.`
        : "The current simulated service status shows no active incidents for that feature.";
    } else if (/export|download|report/i.test(question) && !organization.features.report_exports) {
      answer = `I checked your organization’s entitlements: the ${organization.plan} plan does not include report exports. You can view reports, but downloading them requires the Scale plan. This is a plan limit, not an account-specific outage. An organization owner can review plan options.`;
      if (activeIncidents.length) answer += ` Separately, service status reports: ${activeIncidents[0].publicUpdate}`;
    } else if (/export|download|report/i.test(question) && activeIncidents.length) {
      answer = `Your ${organization.plan} plan includes report exports. The status check found an active incident: ${activeIncidents[0].publicUpdate} I can’t confirm resolution until the status data changes.`;
    } else if (articles.length) {
      answer = articles[0].body;
    } else {
      answer = "I don't have enough verified information to diagnose this yet. Please share the exact error, approximate time, and which page or action you were using. No account change has been made.";
    }
    let checks = [entitlementCheck, statusCheck, helpCheck];
    const semanticResults = await findRelatedIssueGroups(question, organization.id, ticket?.id);
    checks.push(semanticResults.check);

    const ollamaUrl = process.env.OLLAMA_URL;
    const accountOrIncidentQuestion = /export|download|report|incident|outage|service status|status page/i.test(question);
    if (ollamaUrl && articles.length && !accountOrIncidentQuestion && checks.slice(0, 3).every((check) => check.status === "complete")) {
      try {
        const prompt = ChatPromptTemplate.fromMessages([
          ["system", "Answer only from the supplied published help text. Do not invent product capabilities, expose private data, recommend a completed refund or subscription change, or claim incidents are resolved. If evidence is insufficient, say what is missing. Cite sources using [title]."],
          ["human", "Question: {question}\nPublished help: {sources}"]
        ]);
        const model = new ChatOllama({ baseUrl: ollamaUrl, model: process.env.OLLAMA_MODEL || "llama3.1", temperature: 0 });
        const result = await prompt.pipe(model).invoke({
          question,
          sources: JSON.stringify(articles.map(({ title, version, body }) => ({ title, version, body })))
        }, { signal: AbortSignal.timeout(8000) });
        const generated = typeof result.content === "string"
          ? result.content.trim()
          : Array.isArray(result.content)
            ? result.content.map((part) => typeof part === "string" ? part : part.text || "").join("\n").trim()
            : "";
        if (generated && !/\b(refund|credit your account|subscription change|upgraded your plan)\b/i.test(generated)) answer = generated;
        else throw new Error("Ollama returned no grounded answer.");
      } catch (error) {
        checks = [...checks, toolCheck("ollama_answer", "incomplete", `Model answer unavailable: ${error.message}`)];
      }
    }
    return { answer, checks, semanticResults };
  }

  return { toolCheck, findHelp, createTicketEmbedding, investigate, redactSensitive };
}
