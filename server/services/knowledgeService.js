export function publicIncident(incident) {
  return {
    id: incident.id,
    title: incident.title,
    status: incident.status,
    severity: incident.severity,
    updatedAt: incident.updatedAt,
    publicUpdate: incident.publicUpdate
  };
}

export function publishHelpDraft(draft, helpArticles) {
  const slug = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const previousVersions = [...helpArticles.values()].filter((article) => article.slug === slug);
  return {
    ...draft,
    slug,
    version: previousVersions.reduce((version, article) => Math.max(version, article.version), 0) + 1,
    published: true,
    updatedAt: new Date().toISOString().slice(0, 10)
  };
}
