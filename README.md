# Northstar Subscription Support Desk

A reproducible support-portal demo built with React, Express, Mongoose, MongoDB Atlas Vector Search, LangChain.js, Ollama, and Zod. It includes seeded organizations with different entitlements, versioned published help, simulated service incidents, role-scoped tickets, an evidence-first account investigation, and support/knowledge workflows.

## Project structure

- `index.html`, `client/App.js`, `client/main.js`, and `client/styles.css` — plain HTML/CSS with React (no JSX source files).
- `server/models/` — Mongoose ticket/vector schemas and seeded demo store.
- `server/services/` — authentication, knowledge, and support workflows.
- `server/controllers/` — request validation and HTTP response handling.
- `server/routes/` — Express routers grouped by API feature.
- `server/index.js` — Express middleware, dependency wiring, and server startup.

## Run locally

Requirements: Node.js 20+.

```sh
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The API runs on port 4000 and the Vite development server proxies `/api` requests.

Demo password for every seeded account: `Demo123!`

| Email | Role | Demo scenario |
| --- | --- | --- |
| `maya@acme.example` | Customer | Starter plan; report exports are not included |
| `noah@aurora.example` | Customer | Scale plan; report export incident is active |
| `sam@northstar.example` | Support specialist | Assigned ticket queue |
| `jules@northstar.example` | Knowledge manager | Draft and publish help articles |
| `aria@northstar.example` | Support supervisor | Ticket assignment permissions |

## Demo flow

1. Sign in as Maya or Noah and ask “Why can’t my team export this report?” Their answers differ because entitlement checks are scoped to the signed-in organization.
2. Inspect the investigation checks and citations. The export incident is simulated and its public update is shown as evidence, not as a claim that it is resolved.
3. Create a ticket to attach the assistant conversation and checks, then sign in as the assigned specialist to review it, propose a resolution, or escalate it.
4. Sign in as Jules to publish a versioned help article. Sign in as Aria to assign tickets.

## MongoDB Atlas and local AI (optional)

The account, status, and help checks run deterministically from seeded data. To persist tickets and sessions, set `MONGODB_URI` in `.env`. The application uses the `support_tickets`, `ticket_vectors`, and `sessions` collections; seeded demo organizations, users, help, and incidents remain reproducible fixtures.

To enable local grounded help answers and semantic ticket grouping, set `OLLAMA_URL`, `OLLAMA_MODEL`, and `OLLAMA_EMBED_MODEL`, and make those models available locally. Set `ATLAS_VECTOR_INDEX` to the name of a Vector Search index on `ticket_vectors` with this definition (change dimensions if your embedding model differs):

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "organizationId" }
  ]
}
```

When Atlas or Ollama is missing or fails, the app displays an **incomplete** semantic/model check and uses a private organization-scoped keyword fallback for related-issue counts. It does not present the fallback as semantic search.

## Security and demo scope

- Passwords are bcrypt-hashed; session cookies are HTTP-only, SameSite strict, and expire after eight hours. When MongoDB is configured, sessions are stored in MongoDB; otherwise the local demo uses Express's in-memory session store. Mutating routes require a session-bound CSRF token.
- Login attempts are rate-limited. Customers can access only their own organization and tickets; specialists see assigned tickets; supervisors can see and assign tickets.
- Public incident responses are sanitized. Support tools derive the customer organization from the authenticated session, never from request input.
- Sign-up enforces the customer role and organization choice. Verification and recovery tokens expire; in non-production mode only, the API returns their token to make the demo flow testable.
- This project is a reproducible demo, not a production billing or email service. Production deployment still requires email delivery, durable audit storage, persisted identity/organization/help/incident records, production secret management, and operational controls.
