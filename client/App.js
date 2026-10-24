import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Filter,
  Headphones,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  X
} from "lucide-react";
const DEMOS = [
  { label: "Maya Chen", email: "maya@acme.example", role: "Customer", hint: "Starter plan \xB7 exports not included" },
  { label: "Noah Patel", email: "noah@aurora.example", role: "Customer", hint: "Scale plan \xB7 active export incident" },
  { label: "Sam Rivera", email: "sam@northstar.example", role: "Specialist", hint: "Assigned support queue" },
  { label: "Jules Park", email: "jules@northstar.example", role: "Knowledge manager", hint: "Publish help articles" },
  { label: "Aria Morgan", email: "aria@northstar.example", role: "Supervisor", hint: "Assign and review tickets" }
];
async function request(path, options = {}, csrfToken) {
  const headers = { ...options.body ? { "content-type": "application/json" } : {}, ...options.headers };
  if (csrfToken && options.method && options.method !== "GET") headers["x-csrf-token"] = csrfToken;
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
const initialMessage = {
  role: "assistant",
  text: "Hi there. I can help you understand plan limits, investigate service issues, and find the right setup guide. What are you trying to do?",
  citations: []
};
function IconBadge({ icon: Icon, color = "blue" }) {
  return /* @__PURE__ */ React.createElement("span", { className: `icon-badge ${color}` }, /* @__PURE__ */ React.createElement(Icon, { size: 17, strokeWidth: 1.8 }));
}
function App() {
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [page, setPage] = useState("home");
  const [help, setHelp] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([initialMessage]);
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [checks, setChecks] = useState([]);
  const [citations, setCitations] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [authEmail, setAuthEmail] = useState(DEMO_EMAIL);
  const [authPassword, setAuthPassword] = useState("Demo123!");
  const [ticketFormOpen, setTicketFormOpen] = useState(false);
  const [draftForm, setDraftForm] = useState({ title: "", excerpt: "", body: "", productVersion: "2.x", category: "Troubleshooting" });
  const [requestedArticle, setRequestedArticle] = useState(null);
  const isCustomer = user?.role === "customer";
  const isStaff = user && user.role !== "customer";
  const queueCount = tickets.filter((ticket) => ticket.status !== "resolved").length;
  const loadPublic = useCallback(async () => {
    try {
      const [helpData, statusData] = await Promise.all([request("/api/help"), request("/api/status")]);
      setHelp(helpData.articles);
      setIncidents(statusData.incidents);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  const refreshUser = useCallback(async () => {
    try {
      const [token] = await Promise.all([request("/api/csrf"), loadPublic()]);
      setCsrfToken(token.csrfToken);
      const data = await request("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, [loadPublic]);
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);
  useEffect(() => {
    const navigateHelp = () => setPage("help");
    const openArticle = (event) => {
      setRequestedArticle(event.detail);
      setPage("help");
    };
    window.addEventListener("navigate-help", navigateHelp);
    window.addEventListener("open-article", openArticle);
    return () => {
      window.removeEventListener("navigate-help", navigateHelp);
      window.removeEventListener("open-article", openArticle);
    };
  }, []);
  const refreshWorkspace = useCallback(async (activeUser = user) => {
    if (!activeUser) return;
    try {
      if (activeUser.role === "customer") {
        const [ticketData, orgData] = await Promise.all([request("/api/tickets"), request("/api/organization")]);
        setTickets(ticketData.tickets);
        setOrganization(orgData.organization);
      } else {
        const data = await request("/api/staff/queue");
        setTickets(data.tickets);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [user]);
  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);
  const filteredHelp = useMemo(() => help.filter((article) => {
    const searchText = `${article.title} ${article.excerpt} ${article.category}`.toLowerCase();
    return searchText.includes(search.toLowerCase());
  }), [help, search]);
  function clearMessages() {
    setMessages([initialMessage]);
    setChecks([]);
    setCitations([]);
    setSelectedTicket(null);
  }
  async function login(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      let token = csrfToken;
      if (!token) {
        const response = await request("/api/csrf");
        token = response.csrfToken;
        setCsrfToken(token);
      }
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword })
      }, token);
      setUser(data.user);
      setCsrfToken(data.csrfToken);
      setPage("home");
      setNotice(`Welcome back, ${data.user.name.split(" ")[0]}.`);
      clearMessages();
      await refreshWorkspace(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await request("/api/auth/logout", { method: "POST" }, csrfToken);
      setUser(null);
      setOrganization(null);
      setTickets([]);
      setPage("home");
      setCsrfToken("");
      clearMessages();
      setNotice("You\u2019ve been signed out.");
    } catch (e) {
      setError(e.message);
    }
  }
  async function askSupport(event) {
    event?.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError("");
    const currentQuestion = question.trim();
    setMessages((previous) => [...previous, { role: "customer", text: currentQuestion }]);
    setQuestion("");
    try {
      const data = await request("/api/support-agent", {
        method: "POST",
        body: JSON.stringify({ question: currentQuestion, ticketId: selectedTicket?.id })
      }, csrfToken);
      setMessages((previous) => [...previous, { role: "assistant", text: data.answer, citations: data.citations }]);
      setChecks(data.checks);
      setCitations(data.citations);
      await refreshWorkspace();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function createTicket(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const data = await request("/api/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: form.get("subject"), description: form.get("description") })
      }, csrfToken);
      setTicketFormOpen(false);
      await refreshWorkspace();
      setSelectedTicket(data.ticket);
      setPage("tickets");
      setNotice("Support ticket created. Your conversation and investigation checks are attached.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function publishDraft(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { draft } = await request("/api/help-drafts", { method: "POST", body: JSON.stringify(draftForm) }, csrfToken);
      await request(`/api/help-drafts/${draft.id}/publish`, { method: "POST", body: JSON.stringify({}) }, csrfToken);
      setDraftForm({ title: "", excerpt: "", body: "", productVersion: "2.x", category: "Troubleshooting" });
      await loadPublic();
      setNotice("Help article published and added to the versioned knowledge base.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function showPage(nextPage) {
    setPage(nextPage);
    setError("");
    if (nextPage === "home") clearMessages();
  }
  const activeIncident = incidents.find((incident) => incident.status !== "resolved");
  return /* @__PURE__ */ React.createElement("div", { className: "app-shell" }, /* @__PURE__ */ React.createElement("header", { className: "topbar" }, /* @__PURE__ */ React.createElement("button", { className: "brand", onClick: () => showPage("home"), "aria-label": "Northstar home" }, /* @__PURE__ */ React.createElement("span", { className: "brand-mark" }, /* @__PURE__ */ React.createElement("span", null)), /* @__PURE__ */ React.createElement("span", null, "northstar", /* @__PURE__ */ React.createElement("span", { className: "brand-support" }, "support"))), /* @__PURE__ */ React.createElement("div", { className: "topbar-right" }, /* @__PURE__ */ React.createElement("button", { className: "top-link", onClick: () => showPage("help") }, /* @__PURE__ */ React.createElement(CircleHelp, { size: 16 }), " Help center"), /* @__PURE__ */ React.createElement("span", { className: "top-divider" }), user ? /* @__PURE__ */ React.createElement("div", { className: "user-menu" }, /* @__PURE__ */ React.createElement("span", { className: "avatar" }, initials(user.name)), /* @__PURE__ */ React.createElement("div", { className: "user-meta" }, /* @__PURE__ */ React.createElement("b", null, user.name), /* @__PURE__ */ React.createElement("span", null, roleLabel(user.role))), /* @__PURE__ */ React.createElement("button", { className: "icon-button logout", "aria-label": "Sign out", title: "Sign out", onClick: logout }, /* @__PURE__ */ React.createElement(LogOut, { size: 16 }))) : /* @__PURE__ */ React.createElement("button", { className: "signin-link", onClick: () => document.getElementById("login-email")?.focus() }, "Sign in"))), /* @__PURE__ */ React.createElement("div", { className: "layout" }, /* @__PURE__ */ React.createElement("aside", { className: "sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "workspace-select" }, /* @__PURE__ */ React.createElement("span", { className: "workspace-mark" }, "N"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("small", null, "WORKSPACE"), /* @__PURE__ */ React.createElement("b", null, organization?.name || (isStaff ? "Support team" : "Northstar"))), /* @__PURE__ */ React.createElement(ChevronDown, { size: 15 })), /* @__PURE__ */ React.createElement("div", { className: "side-section-label" }, "WORKSPACE"), /* @__PURE__ */ React.createElement("nav", { className: "side-nav" }, /* @__PURE__ */ React.createElement("button", { className: page === "home" ? "selected" : "", onClick: () => showPage("home") }, /* @__PURE__ */ React.createElement(MessageCircle, { size: 17 }), " Ask support"), /* @__PURE__ */ React.createElement("button", { className: page === "tickets" ? "selected" : "", onClick: () => showPage("tickets") }, /* @__PURE__ */ React.createElement(Ticket, { size: 17 }), " ", isStaff ? "Assigned queue" : "My tickets", " ", queueCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "nav-count" }, queueCount)), /* @__PURE__ */ React.createElement("button", { className: page === "help" ? "selected" : "", onClick: () => showPage("help") }, /* @__PURE__ */ React.createElement(BookOpen, { size: 17 }), " Help articles"), user?.role === "knowledge_manager" && /* @__PURE__ */ React.createElement("button", { className: page === "knowledge" ? "selected" : "", onClick: () => showPage("knowledge") }, /* @__PURE__ */ React.createElement(FileText, { size: 17 }), " Knowledge")), /* @__PURE__ */ React.createElement("div", { className: "side-section-label status-label" }, "STATUS"), /* @__PURE__ */ React.createElement("button", { className: "side-status", onClick: () => document.getElementById("status-card")?.scrollIntoView({ behavior: "smooth" }) }, /* @__PURE__ */ React.createElement("span", { className: `status-dot ${activeIncident ? "warn" : ""}` }), " ", activeIncident ? "Partial disruption" : "All systems operational", " ", /* @__PURE__ */ React.createElement(ArrowUpRight, { size: 14 })), organization && /* @__PURE__ */ React.createElement("div", { className: "plan-card" }, /* @__PURE__ */ React.createElement("div", { className: "plan-top" }, /* @__PURE__ */ React.createElement("span", { className: "plan-icon" }, /* @__PURE__ */ React.createElement(Activity, { size: 15 })), /* @__PURE__ */ React.createElement("span", null, "YOUR PLAN"), /* @__PURE__ */ React.createElement("span", { className: "plan-badge" }, organization.plan)), /* @__PURE__ */ React.createElement("div", { className: "plan-feature" }, /* @__PURE__ */ React.createElement("span", { className: organization.features.report_exports ? "feature-on" : "feature-off" }), " Report exports ", /* @__PURE__ */ React.createElement("b", null, organization.features.report_exports ? "Included" : "Not included")), /* @__PURE__ */ React.createElement("div", { className: "plan-feature" }, /* @__PURE__ */ React.createElement("span", { className: "feature-on" }), " Team members ", /* @__PURE__ */ React.createElement("b", null, organization.members, " / ", organization.memberLimit)), /* @__PURE__ */ React.createElement("button", { className: "plan-link", onClick: () => {
    setPage("home");
    setQuestion("Why can\u2019t my team export this report?");
  } }, "Ask about a plan limit ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 13 }))), /* @__PURE__ */ React.createElement("div", { className: "sidebar-spacer" }), /* @__PURE__ */ React.createElement("div", { className: "sidebar-help" }, /* @__PURE__ */ React.createElement("span", { className: "support-orb" }, /* @__PURE__ */ React.createElement(Headphones, { size: 17 })), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "Need a human?"), /* @__PURE__ */ React.createElement("small", null, "We\u2019re here to help.")), /* @__PURE__ */ React.createElement("button", { "aria-label": "Create ticket", onClick: () => setTicketFormOpen(true) }, /* @__PURE__ */ React.createElement(ArrowRight, { size: 16 }))), /* @__PURE__ */ React.createElement("div", { className: "sidebar-foot" }, "NORTHSTAR \xB7 PRODUCT SUPPORT")), /* @__PURE__ */ React.createElement("main", { className: "main-content" }, (error || notice) && /* @__PURE__ */ React.createElement("div", { className: `toast ${error ? "toast-error" : "toast-success"}`, role: "status" }, /* @__PURE__ */ React.createElement("span", null, error || notice), /* @__PURE__ */ React.createElement("button", { "aria-label": "Dismiss", onClick: () => {
    setError("");
    setNotice("");
  } }, /* @__PURE__ */ React.createElement(X, { size: 15 }))), page === "home" && /* @__PURE__ */ React.createElement(
    HomeScreen,
    {
      user,
      login,
      authEmail,
      setAuthEmail,
      authPassword,
      setAuthPassword,
      busy,
      messages,
      question,
      setQuestion,
      askSupport,
      checks,
      citations,
      help,
      incidents,
      askPreset: (text) => setQuestion(text),
      onTicket: () => setTicketFormOpen(true),
      onTickets: () => showPage("tickets")
    }
  ), page === "help" && /* @__PURE__ */ React.createElement(HelpScreen, { search, setSearch, articles: filteredHelp, initialArticle: requestedArticle }), page === "tickets" && /* @__PURE__ */ React.createElement(
    TicketsScreen,
    {
      user,
      tickets,
      selected: selectedTicket,
      selectTicket: async (ticket) => {
        setSelectedTicket(ticket);
        try {
          const data = await request(`/api/tickets/${ticket.id}`);
          setSelectedTicket(data.ticket);
        } catch (e) {
          setError(e.message);
        }
      },
      onNew: () => setTicketFormOpen(true),
      onRefresh: refreshWorkspace,
      csrfToken,
      setError,
      setNotice
    }
  ), page === "knowledge" && /* @__PURE__ */ React.createElement(
    KnowledgeScreen,
    {
      draftForm,
      setDraftForm,
      publishDraft,
      articles: help,
      busy
    }
  ))), ticketFormOpen && /* @__PURE__ */ React.createElement("div", { className: "modal-backdrop", onClick: () => setTicketFormOpen(false) }, /* @__PURE__ */ React.createElement("form", { className: "modal", onSubmit: createTicket, onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "modal-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "SUPPORT REQUEST"), /* @__PURE__ */ React.createElement("h2", null, "Talk to our team")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "icon-button", "aria-label": "Close", onClick: () => setTicketFormOpen(false) }, /* @__PURE__ */ React.createElement(X, { size: 18 }))), /* @__PURE__ */ React.createElement("p", { className: "modal-copy" }, "Your recent assistant conversation and investigation checks will be included automatically."), /* @__PURE__ */ React.createElement("label", null, "Subject", /* @__PURE__ */ React.createElement("input", { required: true, name: "subject", minLength: "5", maxLength: "120", placeholder: "A short summary of the issue" })), /* @__PURE__ */ React.createElement("label", null, "What happened?", /* @__PURE__ */ React.createElement("textarea", { required: true, name: "description", minLength: "10", maxLength: "4000", rows: "5", placeholder: "Include what you expected and what you saw." })), /* @__PURE__ */ React.createElement("div", { className: "modal-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "button-secondary", onClick: () => setTicketFormOpen(false) }, "Cancel"), /* @__PURE__ */ React.createElement("button", { className: "button-primary", disabled: busy }, /* @__PURE__ */ React.createElement(Send, { size: 15 }), " Create ticket")))), /* @__PURE__ */ React.createElement("footer", { className: "app-footer" }, /* @__PURE__ */ React.createElement("span", null, "\xA9 2026 Northstar, Inc."), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(ShieldCheck, { size: 13 }), " Your data stays private and secure"), /* @__PURE__ */ React.createElement("a", { href: "#help", onClick: (e) => {
    e.preventDefault();
    setPage("help");
  } }, "Privacy & support")));
}
function HomeScreen({ user, login, authEmail, setAuthEmail, authPassword, setAuthPassword, busy, messages, question, setQuestion, askSupport, checks, citations, help, incidents, askPreset, onTicket, onTickets }) {
  const activeIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const isCustomer = user?.role === "customer";
  return /* @__PURE__ */ React.createElement("div", { className: "home-screen" }, !user ? /* @__PURE__ */ React.createElement("section", { className: "welcome-hero login-hero" }, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, /* @__PURE__ */ React.createElement(Sparkles, { size: 13 }), " SUPPORT THAT KNOWS YOUR WORKSPACE"), /* @__PURE__ */ React.createElement("h1", null, "A little help,", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", null, "right when you need it.")), /* @__PURE__ */ React.createElement("p", null, "Get clear, source-backed answers about your account, your plan, and the product. Start a conversation with Northstar Support."), /* @__PURE__ */ React.createElement("div", { className: "login-card" }, /* @__PURE__ */ React.createElement("div", { className: "login-card-top" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "Welcome to Northstar"), /* @__PURE__ */ React.createElement("span", null, "Sign in to get workspace-specific help")), /* @__PURE__ */ React.createElement("span", { className: "lock-icon" }, /* @__PURE__ */ React.createElement(ShieldCheck, { size: 18 }))), /* @__PURE__ */ React.createElement("form", { onSubmit: login }, /* @__PURE__ */ React.createElement("label", { htmlFor: "login-email" }, "Email address"), /* @__PURE__ */ React.createElement("input", { id: "login-email", type: "email", autoComplete: "username", value: authEmail, onChange: (e) => setAuthEmail(e.target.value), required: true }), /* @__PURE__ */ React.createElement("label", { htmlFor: "login-password" }, "Password"), /* @__PURE__ */ React.createElement("input", { id: "login-password", type: "password", autoComplete: "current-password", value: authPassword, onChange: (e) => setAuthPassword(e.target.value), required: true }), /* @__PURE__ */ React.createElement("button", { className: "button-primary login-button", disabled: busy }, busy ? "Signing in\u2026" : "Sign in securely", " ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 16 }))), /* @__PURE__ */ React.createElement("div", { className: "demo-accounts" }, /* @__PURE__ */ React.createElement("span", null, "DEMO ACCOUNTS"), /* @__PURE__ */ React.createElement("div", null, DEMOS.map((demo) => /* @__PURE__ */ React.createElement("button", { key: demo.email, title: `${demo.role} \xB7 ${demo.hint}`, onClick: () => {
    setAuthEmail(demo.email);
    setAuthPassword("Demo123!");
  } }, /* @__PURE__ */ React.createElement("span", { className: "demo-avatar" }, initials(demo.label)), demo.label, /* @__PURE__ */ React.createElement("span", { className: "demo-role" }, demo.role)))), /* @__PURE__ */ React.createElement("small", null, "All demo accounts use password ", /* @__PURE__ */ React.createElement("code", null, "Demo123!"))))) : /* @__PURE__ */ React.createElement("section", { className: "welcome-hero" }, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, /* @__PURE__ */ React.createElement(Sparkles, { size: 13 }), " ", isCustomer ? "NORTHSTAR SUPPORT" : "SUPPORT OPERATIONS"), /* @__PURE__ */ React.createElement("h1", null, isCustomer ? /* @__PURE__ */ React.createElement(React.Fragment, null, "How can we", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", null, "help today?")) : /* @__PURE__ */ React.createElement(React.Fragment, null, "Good to see you,", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", null, user.name.split(" ")[0], "."))), /* @__PURE__ */ React.createElement("p", null, isCustomer ? "Ask a question and get an answer grounded in your plan, live service status, and our latest help articles." : "Your workspace is ready. Review assigned customer requests and use verified account checks to investigate."), isCustomer ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("form", { className: "ask-box", onSubmit: askSupport }, /* @__PURE__ */ React.createElement("textarea", { rows: "2", value: question, onChange: (e) => setQuestion(e.target.value), placeholder: "Ask anything about your account or product\u2026", "aria-label": "Ask support" }), /* @__PURE__ */ React.createElement("div", { className: "ask-box-footer" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(ShieldCheck, { size: 13 }), " Answers are scoped to your workspace"), /* @__PURE__ */ React.createElement("button", { className: "button-primary ask-submit", disabled: busy || !question.trim() }, busy ? "Checking\u2026" : "Ask support", " ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 15 })))), /* @__PURE__ */ React.createElement("div", { className: "suggestion-row" }, /* @__PURE__ */ React.createElement("span", null, "TRY ASKING"), ["Why can\u2019t my team export this report?", "Is there an active incident?", "How do I invite a teammate?"].map((suggestion) => /* @__PURE__ */ React.createElement("button", { key: suggestion, onClick: () => askPreset(suggestion) }, suggestion, /* @__PURE__ */ React.createElement(ArrowUpRight, { size: 12 }))))) : /* @__PURE__ */ React.createElement("div", { className: "staff-hero-actions" }, /* @__PURE__ */ React.createElement("button", { className: "button-primary", onClick: onTickets }, "Open assigned queue ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 15 })), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(ShieldCheck, { size: 14 }), " Access follows ticket assignment"))), user && isCustomer && messages.length > 1 && /* @__PURE__ */ React.createElement(ConversationPanel, { messages, checks, citations, onTicket, busy, question, setQuestion, askSupport }), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, /* @__PURE__ */ React.createElement("section", { className: "content-primary" }, /* @__PURE__ */ React.createElement("div", { className: "section-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "THE HELP YOU NEED"), /* @__PURE__ */ React.createElement("h2", null, "Find your way forward")), /* @__PURE__ */ React.createElement("a", { href: "#help", onClick: (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("navigate-help"));
  } }, "Browse all ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 14 }))), /* @__PURE__ */ React.createElement("div", { className: "guide-grid" }, help.slice(0, 3).map((article, index) => /* @__PURE__ */ React.createElement("button", { className: "guide-card", key: article.id, onClick: () => window.dispatchEvent(new CustomEvent("open-article", { detail: article })) }, /* @__PURE__ */ React.createElement(IconBadge, { icon: [FileText, Activity, BookOpen][index % 3], color: ["blue", "amber", "violet"][index % 3] }), /* @__PURE__ */ React.createElement("span", { className: "guide-category" }, article.category.toUpperCase(), " \xB7 V", article.version), /* @__PURE__ */ React.createElement("h3", null, article.title), /* @__PURE__ */ React.createElement("p", null, article.excerpt), /* @__PURE__ */ React.createElement("span", { className: "guide-link" }, "Read article ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 13 }))))), /* @__PURE__ */ React.createElement("div", { className: "privacy-note" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(ShieldCheck, { size: 16 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "Your support is private by design"), /* @__PURE__ */ React.createElement("p", null, "Account checks only use your signed-in workspace. Other customers\u2019 details are never shown in your answers.")))), /* @__PURE__ */ React.createElement("aside", { className: "content-aside" }, /* @__PURE__ */ React.createElement("div", { className: "aside-heading" }, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "LIVE SERVICE STATUS"), /* @__PURE__ */ React.createElement("a", { href: "#status-card" }, "View status ", /* @__PURE__ */ React.createElement(ArrowUpRight, { size: 12 }))), /* @__PURE__ */ React.createElement("div", { className: `system-card ${activeIncidents.length ? "has-incident" : ""}`, id: "status-card" }, /* @__PURE__ */ React.createElement("div", { className: "system-card-title" }, /* @__PURE__ */ React.createElement("span", { className: `status-dot ${activeIncidents.length ? "warn" : ""}` }), /* @__PURE__ */ React.createElement("b", null, activeIncidents.length ? "Some systems need attention" : "All systems operational")), /* @__PURE__ */ React.createElement("div", { className: "service-row" }, /* @__PURE__ */ React.createElement("span", null, "Dashboard & reports"), /* @__PURE__ */ React.createElement("span", { className: "service-state" }, /* @__PURE__ */ React.createElement("i", null), " Operational")), /* @__PURE__ */ React.createElement("div", { className: "service-row" }, /* @__PURE__ */ React.createElement("span", null, "Report exports"), /* @__PURE__ */ React.createElement("span", { className: `service-state ${activeIncidents.length ? "degraded" : ""}` }, /* @__PURE__ */ React.createElement("i", null), " ", activeIncidents.length ? "Degraded" : "Operational")), /* @__PURE__ */ React.createElement("div", { className: "service-row" }, /* @__PURE__ */ React.createElement("span", null, "Authentication"), /* @__PURE__ */ React.createElement("span", { className: "service-state" }, /* @__PURE__ */ React.createElement("i", null), " Operational")), activeIncidents.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "incident-update" }, /* @__PURE__ */ React.createElement("span", { className: "incident-tag" }, "INVESTIGATING"), /* @__PURE__ */ React.createElement("b", null, activeIncidents[0].title), /* @__PURE__ */ React.createElement("p", null, activeIncidents[0].publicUpdate), /* @__PURE__ */ React.createElement("small", null, "Updated ", formatDate(activeIncidents[0].updatedAt)))), /* @__PURE__ */ React.createElement("div", { className: "aside-help-card" }, /* @__PURE__ */ React.createElement("div", { className: "help-illustration" }, /* @__PURE__ */ React.createElement(LifeBuoy, { size: 21 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "Can\u2019t find what you need?"), /* @__PURE__ */ React.createElement("p", null, "Our support team is one click away."), /* @__PURE__ */ React.createElement("button", { onClick: onTicket }, "Contact support ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 13 })))))));
}
function ConversationPanel({ messages, checks, citations, onTicket, busy, question, setQuestion, askSupport }) {
  return /* @__PURE__ */ React.createElement("section", { className: "conversation-panel" }, /* @__PURE__ */ React.createElement("div", { className: "conversation-title" }, /* @__PURE__ */ React.createElement("span", { className: "assistant-avatar" }, /* @__PURE__ */ React.createElement(Sparkles, { size: 15 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "Workspace investigation"), /* @__PURE__ */ React.createElement("small", null, "Evidence-backed \xB7 your organization only")), /* @__PURE__ */ React.createElement("span", { className: "conversation-live" }, /* @__PURE__ */ React.createElement("i", null), " ACTIVE")), /* @__PURE__ */ React.createElement("div", { className: "conversation-messages" }, messages.slice(1).map((message, index) => /* @__PURE__ */ React.createElement("div", { className: `message ${message.role}`, key: `${index}-${message.text.slice(0, 12)}` }, /* @__PURE__ */ React.createElement("div", { className: "message-avatar" }, message.role === "assistant" ? /* @__PURE__ */ React.createElement(Sparkles, { size: 13 }) : "Y"), /* @__PURE__ */ React.createElement("div", { className: "message-content" }, /* @__PURE__ */ React.createElement("span", { className: "message-author" }, message.role === "assistant" ? "NORTHSTAR ASSISTANT" : "YOU"), /* @__PURE__ */ React.createElement("p", null, message.text), message.citations?.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "citations-row" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(BookOpen, { size: 12 }), " SOURCES"), message.citations.map((citation) => /* @__PURE__ */ React.createElement("span", { className: "citation-chip", key: citation.id }, citation.title, " ", /* @__PURE__ */ React.createElement("small", null, "v", citation.version))))))), busy && /* @__PURE__ */ React.createElement("div", { className: "thinking" }, /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null), " Checking your workspace\u2026")), checks.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "checks-panel" }, /* @__PURE__ */ React.createElement("div", { className: "checks-heading" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(ShieldCheck, { size: 14 }), " INVESTIGATION CHECKS"), /* @__PURE__ */ React.createElement("small", null, checks.filter((check) => check.status === "complete").length, "/", checks.length, " complete")), /* @__PURE__ */ React.createElement("div", { className: "checks-list" }, checks.map((check) => /* @__PURE__ */ React.createElement("div", { className: "check-row", key: check.name }, /* @__PURE__ */ React.createElement("span", { className: check.status === "complete" ? "check-good" : "check-incomplete" }, check.status === "complete" ? /* @__PURE__ */ React.createElement(CheckCircle2, { size: 14 }) : /* @__PURE__ */ React.createElement(Clock3, { size: 14 })), /* @__PURE__ */ React.createElement("b", null, check.name), /* @__PURE__ */ React.createElement("span", null, check.summary), /* @__PURE__ */ React.createElement("i", { className: check.status }, check.status))))), /* @__PURE__ */ React.createElement("div", { className: "conversation-footer" }, /* @__PURE__ */ React.createElement("form", { className: "followup-input", onSubmit: askSupport }, /* @__PURE__ */ React.createElement("input", { value: question, onChange: (e) => setQuestion(e.target.value), placeholder: "Ask a follow-up\u2026", "aria-label": "Ask a follow-up" }), /* @__PURE__ */ React.createElement("button", { title: "Send follow-up", disabled: busy || !question.trim() }, /* @__PURE__ */ React.createElement(Send, { size: 15 }))), /* @__PURE__ */ React.createElement("button", { className: "escalate-button", onClick: onTicket }, /* @__PURE__ */ React.createElement(Headphones, { size: 15 }), " Talk to a person")));
}
function HelpScreen({ search, setSearch, articles, initialArticle }) {
  const [selected, setSelected] = useState(initialArticle);
  useEffect(() => {
    const openArticle = (event) => setSelected(event.detail);
    window.addEventListener("open-article", openArticle);
    return () => window.removeEventListener("open-article", openArticle);
  }, []);
  useEffect(() => {
    if (initialArticle) setSelected(initialArticle);
  }, [initialArticle]);
  return /* @__PURE__ */ React.createElement("div", { className: "page-screen" }, /* @__PURE__ */ React.createElement("div", { className: "page-hero" }, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, /* @__PURE__ */ React.createElement(BookOpen, { size: 13 }), " KNOWLEDGE THAT MOVES YOU FORWARD"), /* @__PURE__ */ React.createElement("h1", null, "The help center"), /* @__PURE__ */ React.createElement("p", null, "Product guidance, clear answers, and practical next steps."), /* @__PURE__ */ React.createElement("div", { className: "help-search" }, /* @__PURE__ */ React.createElement(Search, { size: 17 }), /* @__PURE__ */ React.createElement("input", { value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search help articles\u2026", "aria-label": "Search help articles" }), /* @__PURE__ */ React.createElement("span", null, "\u2318 K"))), /* @__PURE__ */ React.createElement("div", { className: "help-list-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "PUBLISHED ARTICLES"), /* @__PURE__ */ React.createElement("h2", null, articles.length, " helpful guides")), /* @__PURE__ */ React.createElement("span", { className: "version-pill" }, /* @__PURE__ */ React.createElement("span", null), " PRODUCT VERSION 2.X")), /* @__PURE__ */ React.createElement("div", { className: "help-list" }, articles.map((article) => /* @__PURE__ */ React.createElement("button", { className: `help-list-card ${selected?.id === article.id ? "expanded" : ""}`, key: article.id, onClick: () => setSelected(selected?.id === article.id ? null : article) }, /* @__PURE__ */ React.createElement("div", { className: "help-icon" }, /* @__PURE__ */ React.createElement(FileText, { size: 17 })), /* @__PURE__ */ React.createElement("div", { className: "help-list-copy" }, /* @__PURE__ */ React.createElement("span", { className: "guide-category" }, article.category.toUpperCase(), " \xB7 V", article.version), /* @__PURE__ */ React.createElement("h3", null, article.title), /* @__PURE__ */ React.createElement("p", null, article.excerpt), selected?.id === article.id && /* @__PURE__ */ React.createElement("div", { className: "article-body" }, article.body, /* @__PURE__ */ React.createElement("small", null, "Last updated ", article.updatedAt))), /* @__PURE__ */ React.createElement("span", { className: "help-open" }, selected?.id === article.id ? /* @__PURE__ */ React.createElement(ArrowDown, { size: 16 }) : /* @__PURE__ */ React.createElement(ArrowUpRight, { size: 16 }))))), articles.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement(Search, { size: 22 }), /* @__PURE__ */ React.createElement("b", null, "No matching articles"), /* @__PURE__ */ React.createElement("span", null, "Try another search term.")));
}
function TicketsScreen({ user, tickets, selected, selectTicket, onNew, onRefresh, csrfToken, setError, setNotice }) {
  const [updating, setUpdating] = useState(false);
  const [specialists, setSpecialists] = useState([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  useEffect(() => {
    if (user?.role === "supervisor") {
      request("/api/staff/specialists").then((data) => setSpecialists(data.specialists)).catch((error) => setError(error.message));
    }
  }, [user, setError]);
  async function updateTicket(path, body) {
    if (!selected) return;
    setUpdating(true);
    try {
      await request(`/api/tickets/${selected.id}/${path}`, { method: "POST", body: JSON.stringify(body) }, csrfToken);
      await onRefresh();
      const updated = await request(`/api/tickets/${selected.id}`);
      selectTicket(updated.ticket);
      setNotice(path === "escalation" ? "Escalation added to the case." : "Resolution saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdating(false);
    }
  }
  async function assignTicket() {
    if (!selected || !assigneeId) return;
    setUpdating(true);
    try {
      await request(`/api/tickets/${selected.id}/assignment`, { method: "POST", body: JSON.stringify({ assigneeId }) }, csrfToken);
      await onRefresh();
      setNotice("Ticket assigned to the selected specialist.");
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdating(false);
    }
  }
  async function requestCustomerInformation() {
    if (!selected) return;
    setUpdating(true);
    try {
      await request(`/api/tickets/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "waiting_on_customer" })
      }, csrfToken);
      await onRefresh();
      const updated = await request(`/api/tickets/${selected.id}`);
      selectTicket(updated.ticket);
      setNotice("Ticket marked as waiting for customer information.");
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdating(false);
    }
  }
  const staff = user && user.role !== "customer";
  return /* @__PURE__ */ React.createElement("div", { className: "page-screen ticket-screen" }, /* @__PURE__ */ React.createElement("div", { className: "page-heading-row" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, staff ? "SUPPORT OPERATIONS" : "YOUR SUPPORT HISTORY"), /* @__PURE__ */ React.createElement("h1", null, staff ? "Assigned queue" : "Your tickets"), /* @__PURE__ */ React.createElement("p", null, staff ? "Cases assigned to you, with investigation context." : "Your conversations and support requests, all in one place.")), !staff && /* @__PURE__ */ React.createElement("button", { className: "button-primary", onClick: onNew }, /* @__PURE__ */ React.createElement(Plus, { size: 15 }), " New ticket")), /* @__PURE__ */ React.createElement("div", { className: "ticket-workspace" }, /* @__PURE__ */ React.createElement("div", { className: "ticket-list" }, tickets.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-ticket" }, /* @__PURE__ */ React.createElement(Ticket, { size: 21 }), /* @__PURE__ */ React.createElement("b", null, "No open tickets"), /* @__PURE__ */ React.createElement("span", null, "When you reach out to support, your case will show up here.")) : tickets.map((ticket) => /* @__PURE__ */ React.createElement("button", { className: `ticket-item ${selected?.id === ticket.id ? "active" : ""}`, key: ticket.id, onClick: () => selectTicket(ticket) }, /* @__PURE__ */ React.createElement("span", { className: `ticket-status ${ticket.status}` }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "ticket-id" }, ticket.id, " \xB7 ", formatDate(ticket.createdAt)), /* @__PURE__ */ React.createElement("b", null, ticket.subject), /* @__PURE__ */ React.createElement("small", null, ticket.status.replaceAll("_", " "))), /* @__PURE__ */ React.createElement(ArrowRight, { size: 14 })))), /* @__PURE__ */ React.createElement("div", { className: "ticket-detail" }, selected ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "ticket-detail-header" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "ticket-id" }, selected.id, " \xB7 ", formatDate(selected.createdAt)), /* @__PURE__ */ React.createElement("h2", null, selected.subject)), /* @__PURE__ */ React.createElement("span", { className: `ticket-state ${selected.status}` }, selected.status.replaceAll("_", " "))), /* @__PURE__ */ React.createElement("div", { className: "ticket-description" }, selected.description), /* @__PURE__ */ React.createElement("div", { className: "timeline" }, /* @__PURE__ */ React.createElement("div", { className: "timeline-marker" }, /* @__PURE__ */ React.createElement(Check, { size: 12 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "Request created"), /* @__PURE__ */ React.createElement("span", null, "Your conversation and relevant checks are attached."), /* @__PURE__ */ React.createElement("small", null, formatDate(selected.createdAt)))), (selected.checks || []).map((check, index) => /* @__PURE__ */ React.createElement("div", { className: "timeline", key: `${check.name}-${index}` }, /* @__PURE__ */ React.createElement("div", { className: `timeline-marker ${check.status === "incomplete" ? "pending" : ""}` }, check.status === "complete" ? /* @__PURE__ */ React.createElement(Check, { size: 12 }) : /* @__PURE__ */ React.createElement(Clock3, { size: 12 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, check.name, " \xB7 ", check.status), /* @__PURE__ */ React.createElement("span", null, check.summary)))), (selected.messages || []).length > 0 && /* @__PURE__ */ React.createElement("div", { className: "ticket-conversation" }, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "ATTACHED CONVERSATION"), selected.messages.map((message, index) => /* @__PURE__ */ React.createElement("div", { className: "ticket-message", key: `${message.at}-${index}` }, /* @__PURE__ */ React.createElement("b", null, message.role === "customer" ? "Customer" : "Assistant"), /* @__PURE__ */ React.createElement("p", null, message.text), message.citations?.map((citation) => /* @__PURE__ */ React.createElement("small", { key: citation.id }, citation.title, " \xB7 v", citation.version))))), selected.resolution && /* @__PURE__ */ React.createElement("div", { className: "resolution-box" }, /* @__PURE__ */ React.createElement(CheckCircle2, { size: 16 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "Resolution"), /* @__PURE__ */ React.createElement("p", null, selected.resolution.summary))), selected.escalation && /* @__PURE__ */ React.createElement("div", { className: "resolution-box escalation-box" }, /* @__PURE__ */ React.createElement(Activity, { size: 16 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "Escalated for review"), /* @__PURE__ */ React.createElement("p", null, selected.escalation.reason))), staff && /* @__PURE__ */ React.createElement("div", { className: "staff-ticket-actions" }, /* @__PURE__ */ React.createElement("button", { disabled: updating, className: "button-secondary", onClick: requestCustomerInformation }, "Request information"), /* @__PURE__ */ React.createElement("button", { disabled: updating, className: "button-secondary", onClick: () => {
    const summary = window.prompt("Enter resolution summary (at least 10 characters):");
    if (summary) updateTicket("resolution", { summary });
  } }, "Propose resolution"), /* @__PURE__ */ React.createElement("button", { disabled: updating, className: "button-secondary", onClick: () => {
    const reason = window.prompt("Why should this be escalated? (at least 10 characters)");
    if (reason) updateTicket("escalation", { reason });
  } }, "Escalate incident")), user?.role === "supervisor" && /* @__PURE__ */ React.createElement("div", { className: "assignment-actions" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "ticket-assignee" }, "ASSIGN TO SPECIALIST"), /* @__PURE__ */ React.createElement("select", { id: "ticket-assignee", value: assigneeId, onChange: (event) => setAssigneeId(event.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Choose a specialist"), specialists.map((specialist) => /* @__PURE__ */ React.createElement("option", { key: specialist.id, value: specialist.id }, specialist.name))), /* @__PURE__ */ React.createElement("button", { className: "button-secondary", disabled: updating || !assigneeId, onClick: assignTicket }, "Assign ticket"))) : /* @__PURE__ */ React.createElement("div", { className: "ticket-detail-empty" }, /* @__PURE__ */ React.createElement("span", { className: "empty-ticket-icon" }, /* @__PURE__ */ React.createElement(Ticket, { size: 21 })), /* @__PURE__ */ React.createElement("b", null, "Select a support request"), /* @__PURE__ */ React.createElement("span", null, "Choose a case to review its conversation, account checks, and next steps.")))));
}
function KnowledgeScreen({ draftForm, setDraftForm, publishDraft, articles, busy }) {
  const update = (key, value) => setDraftForm((previous) => ({ ...previous, [key]: value }));
  return /* @__PURE__ */ React.createElement("div", { className: "page-screen knowledge-screen" }, /* @__PURE__ */ React.createElement("div", { className: "page-heading-row" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "KNOWLEDGE MANAGEMENT"), /* @__PURE__ */ React.createElement("h1", null, "Help that stays current"), /* @__PURE__ */ React.createElement("p", null, "Draft practical, version-aware answers for customers and the support assistant.")), /* @__PURE__ */ React.createElement("span", { className: "role-pill" }, /* @__PURE__ */ React.createElement(ShieldCheck, { size: 13 }), " KNOWLEDGE MANAGER")), /* @__PURE__ */ React.createElement("div", { className: "knowledge-grid" }, /* @__PURE__ */ React.createElement("form", { className: "draft-card", onSubmit: publishDraft }, /* @__PURE__ */ React.createElement("div", { className: "draft-card-head" }, /* @__PURE__ */ React.createElement("span", { className: "draft-icon" }, /* @__PURE__ */ React.createElement(FileText, { size: 17 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "Create a help article"), /* @__PURE__ */ React.createElement("small", null, "New articles are versioned when published."))), /* @__PURE__ */ React.createElement("label", null, "Article title", /* @__PURE__ */ React.createElement("input", { required: true, minLength: "5", maxLength: "140", value: draftForm.title, onChange: (e) => update("title", e.target.value), placeholder: "e.g. Troubleshooting report downloads" })), /* @__PURE__ */ React.createElement("div", { className: "draft-fields" }, /* @__PURE__ */ React.createElement("label", null, "Product version", /* @__PURE__ */ React.createElement("input", { required: true, value: draftForm.productVersion, onChange: (e) => update("productVersion", e.target.value) })), /* @__PURE__ */ React.createElement("label", null, "Category", /* @__PURE__ */ React.createElement("select", { value: draftForm.category, onChange: (e) => update("category", e.target.value) }, /* @__PURE__ */ React.createElement("option", null, "Getting started"), /* @__PURE__ */ React.createElement("option", null, "Plans & billing"), /* @__PURE__ */ React.createElement("option", null, "Troubleshooting"), /* @__PURE__ */ React.createElement("option", null, "Account & access")))), /* @__PURE__ */ React.createElement("label", null, "Short summary", /* @__PURE__ */ React.createElement("input", { required: true, minLength: "10", maxLength: "300", value: draftForm.excerpt, onChange: (e) => update("excerpt", e.target.value), placeholder: "What will customers learn?" })), /* @__PURE__ */ React.createElement("label", null, "Article content", /* @__PURE__ */ React.createElement("textarea", { required: true, minLength: "30", maxLength: "6000", rows: "7", value: draftForm.body, onChange: (e) => update("body", e.target.value), placeholder: "Write clear steps. Avoid sensitive customer information." })), /* @__PURE__ */ React.createElement("div", { className: "draft-footer" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(ShieldCheck, { size: 13 }), " Published content is searchable by version."), /* @__PURE__ */ React.createElement("button", { className: "button-primary", disabled: busy }, /* @__PURE__ */ React.createElement(Check, { size: 15 }), " Publish article"))), /* @__PURE__ */ React.createElement("aside", { className: "published-panel" }, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "LIVE KNOWLEDGE BASE"), /* @__PURE__ */ React.createElement("h2", null, articles.length, " published articles"), /* @__PURE__ */ React.createElement("p", null, "Published help is visible to every customer and can be cited by the support assistant."), articles.map((article) => /* @__PURE__ */ React.createElement("div", { className: "published-item", key: article.id }, /* @__PURE__ */ React.createElement("span", { className: "published-icon" }, /* @__PURE__ */ React.createElement(BookOpen, { size: 14 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, article.title), /* @__PURE__ */ React.createElement("small", null, article.productVersion, " \xB7 v", article.version)), /* @__PURE__ */ React.createElement(CheckCircle2, { size: 14 }))))));
}
function initials(name = "NS") {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
function roleLabel(role = "") {
  return role.split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}
function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
const DEMO_EMAIL = "maya@acme.example";
var App_default = App;
export {
  App_default as default
};
