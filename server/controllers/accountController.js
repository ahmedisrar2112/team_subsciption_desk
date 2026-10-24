export function createAccountController({ organizations }) {
  function getOrganization(req, res) {
    if (req.user.role !== "customer") return res.status(403).json({ error: "Organization access is customer-only." });
    const organization = organizations.get(req.user.organizationId);
    if (!organization) return res.status(404).json({ error: "Organization details are unavailable." });
    res.json({ organization });
  }

  return { getOrganization };
}
