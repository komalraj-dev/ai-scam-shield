import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Flag,
  Globe2,
  Landmark,
  Layers3,
  LockKeyhole,
  QrCode,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  DashboardStats,
  Market,
  PaymentMethod,
  ReportRequest,
  ReportResponse,
  ScamAnalysis,
  ScamAnalysisRequest,
  Severity,
} from "@/lib/types";

const DEFAULT_FORM: ScamAnalysisRequest = {
  market: "upi",
  recipient: "",
  amount: 0,
  payment_method: "UPI collect",
  message: "",
  urgency_flag: false,
};

const PRESETS: Array<{ label: string; note: string; payload: ScamAnalysisRequest }> = [
  {
    label: "Electricity disconnection",
    note: "Urgent UPI collect request",
    payload: {
      market: "upi",
      recipient: "electricity-helpdesk@upi",
      amount: 2450,
      payment_method: "UPI collect",
      message: "Pay immediately to stop your electricity connection from being disconnected today. Share your OTP to confirm the refund.",
      urgency_flag: true,
    },
  },
  {
    label: "Lottery prize tax",
    note: "Fake prize fee request",
    payload: {
      market: "upi",
      recipient: "kbc-winner@upi",
      amount: 18500,
      payment_method: "Bank transfer",
      message: "Congratulations, you won a prize. Pay the processing tax today to release your reward.",
      urgency_flag: true,
    },
  },
  {
    label: "QR receive scam",
    note: "Classic UPI reversal trap",
    payload: {
      market: "upi",
      recipient: "refund-agent@upi",
      amount: 3200,
      payment_method: "QR code",
      message: "Scan this QR to receive your refund. Enter your UPI PIN after scanning to complete the refund.",
      urgency_flag: false,
    },
  },
  {
    label: "Verified merchant",
    note: "Low-risk dinner payment",
    payload: {
      market: "global",
      recipient: "swiggy@icici",
      amount: 749,
      payment_method: "Card",
      message: "Order payment for your dinner. Pay only in the official app; never share an OTP or PIN.",
      urgency_flag: false,
    },
  },
];

const LESSONS = [
  {
    title: "PIN to receive money",
    category: "UPI collect",
    icon: LockKeyhole,
    prompt: "A caller says they are sending a refund and asks for your UPI PIN. What do you do?",
    answer: "Decline. A PIN authorizes money leaving your account; it is never needed to receive money.",
  },
  {
    title: "Fake customer care",
    category: "Impersonation",
    icon: Landmark,
    prompt: "A search result gives you a customer-care number that asks you to install AnyDesk. Is it safe?",
    answer: "No. Use the number inside the official app or website. Remote-access tools can expose your screen and payment sessions.",
  },
  {
    title: "Job deposit trap",
    category: "Social engineering",
    icon: CircleDollarSign,
    prompt: "A Telegram recruiter asks for a refundable deposit before your first task. What is the signal?",
    answer: "A legitimate employer does not require a deposit to unlock work. Stop the conversation and report the handle.",
  },
];

const emptyStats: DashboardStats = {
  total_scans: 0,
  critical_scans: 0,
  warning_scans: 0,
  safe_scans: 0,
  rupees_protected: 0,
  high_risk_recipients: 0,
};

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function severityClasses(severity: Severity) {
  if (severity === "CRITICAL") return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  if (severity === "WARNING") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function SectionEyebrow({ icon: Icon, children }: { icon: typeof ShieldCheck; children: string }) {
  return (
    <div data-testid="section-eyebrow" className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-sky-300">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}

function ScorePanel({ analysis }: { analysis: ScamAnalysis | null }) {
  if (!analysis) {
    return (
      <Card data-testid="analysis-empty-state" className="min-h-[430px] border-white/10 bg-[#0d1527]/90 shadow-2xl shadow-black/30">
        <CardContent className="flex h-full min-h-[430px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sky-300">
            <ShieldCheck className="size-9" />
          </div>
          <h3 data-testid="analysis-empty-title" className="font-heading text-2xl font-semibold text-white">Your decision card is waiting</h3>
          <p data-testid="analysis-empty-description" className="mt-3 max-w-sm text-sm leading-6 text-slate-400">Run a check to see the signals behind the score. The shield explains what to do next instead of asking you to trust a black box.</p>
          <div data-testid="analysis-empty-note" className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500"><Activity className="size-3" /> Transparent rules · demo mode</div>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = analysis.severity === "CRITICAL" ? "#ef4444" : analysis.severity === "WARNING" ? "#f59e0b" : "#10b981";
  return (
    <Card data-testid="analysis-result-card" className={`relative overflow-hidden border-white/10 bg-[#0d1527]/90 shadow-2xl shadow-black/30 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[${scoreColor}] before:to-transparent`}>
      <CardHeader className="relative pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardDescription data-testid="analysis-result-label" className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Decision output</CardDescription>
            <CardTitle data-testid="analysis-result-title" className="mt-1 text-xl text-white">{analysis.verdict}</CardTitle>
          </div>
          <Badge data-testid="analysis-severity-badge" className={`font-mono text-[10px] tracking-wider ${severityClasses(analysis.severity)}`}>{analysis.severity}</Badge>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-6">
        <div className="flex items-center gap-5 rounded-xl border border-white/10 bg-[#070c18]/70 p-4">
          <div data-testid="analysis-risk-score" className="relative flex size-28 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${scoreColor} ${analysis.score * 3.6}deg, #1e293b 0deg)` }}>
            <div className="flex size-20 flex-col items-center justify-center rounded-full bg-[#0d1527]">
              <span className="font-heading text-3xl font-bold text-white">{analysis.score}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">risk / 100</span>
            </div>
          </div>
          <div className="min-w-0">
            <p data-testid="analysis-recommendation" className="text-sm leading-6 text-slate-300">{analysis.recommendation}</p>
            <p data-testid="analysis-recipient" className="mt-2 truncate font-mono text-[11px] text-slate-500">{analysis.recipient} · {formatINR(analysis.amount)}</p>
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 data-testid="analysis-signals-title" className="text-sm font-semibold text-slate-200">Signals detected</h4>
            <span data-testid="analysis-signals-count" className="font-mono text-[10px] text-slate-500">{analysis.signals.length} rule hits</span>
          </div>
          {analysis.signals.length === 0 ? (
            <div data-testid="analysis-no-signals" className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-300"><CheckCircle2 className="size-4" /> No high-risk rule triggered.</div>
          ) : (
            <div data-testid="analysis-signals-list" className="space-y-2">
              {analysis.signals.map((signal) => (
                <div data-testid={`risk-signal-${signal.code}`} key={signal.code} className="flex gap-3 rounded-lg border border-white/8 bg-white/[0.025] p-3">
                  <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${signal.severity === "CRITICAL" ? "text-rose-400" : "text-amber-400"}`} />
                  <div className="min-w-0"><p data-testid={`risk-signal-title-${signal.code}`} className="text-xs font-semibold text-slate-200">{signal.title} <span className="ml-1 font-mono text-[10px] text-amber-300">+{signal.points}</span></p><p data-testid={`risk-signal-detail-${signal.code}`} className="mt-1 text-xs leading-5 text-slate-500">{signal.detail}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const [market, setMarket] = useState<Market>("upi");
  const [form, setForm] = useState<ScamAnalysisRequest>(DEFAULT_FORM);
  const [latest, setLatest] = useState<ScamAnalysis | null>(null);
  const [historyFilter, setHistoryFilter] = useState<Severity | "ALL">("ALL");
  const [historySearch, setHistorySearch] = useState("");
  const [selectedLesson, setSelectedLesson] = useState(0);
  const [report, setReport] = useState<ReportRequest>({ handle: "", category: "UPI handle", details: "" });

  const statsQuery = useQuery({ queryKey: ["shield-stats"], queryFn: () => apiGet<DashboardStats>("/scams/stats"), retry: false });
  const scansQuery = useQuery({ queryKey: ["shield-scans"], queryFn: () => apiGet<ScamAnalysis[]>("/scams"), retry: false });
  const stats = statsQuery.data ?? emptyStats;
  const scans = scansQuery.data ?? [];

  const filteredScans = useMemo(() => scans.filter((scan) => {
    const matchesFilter = historyFilter === "ALL" || scan.severity === historyFilter;
    const haystack = `${scan.recipient} ${scan.message}`.toLowerCase();
    return matchesFilter && haystack.includes(historySearch.toLowerCase());
  }), [historyFilter, historySearch, scans]);

  const analyzeMutation = useMutation({
    mutationFn: (payload: ScamAnalysisRequest) => apiPost<ScamAnalysis>("/scams/analyze", payload),
    onSuccess: (data) => {
      setLatest(data);
      void queryClient.invalidateQueries({ queryKey: ["shield-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["shield-scans"] });
      toast.success("Safety check complete", { description: `${data.severity} · score ${data.score}/100` });
    },
    onError: () => toast.error("The safety engine could not complete this check. Try again."),
  });

  const reportMutation = useMutation({
    mutationFn: (payload: ReportRequest) => apiPost<ReportResponse>("/scams/reports", payload),
    onSuccess: (data) => {
      setReport({ handle: "", category: "UPI handle", details: "" });
      toast.success("Report received", { description: data.message });
    },
    onError: () => toast.error("Please add at least 10 characters of context before reporting."),
  });

  const updateForm = <K extends keyof ScamAnalysisRequest>(key: K, value: ScamAnalysisRequest[K]) => setForm((current) => ({ ...current, [key]: value }));
  const selectMarket = (value: Market) => { setMarket(value); updateForm("market", value); };
  const choosePreset = (preset: typeof PRESETS[number]) => { setForm(preset.payload); setMarket(preset.payload.market); toast.success("Demo scenario loaded", { description: preset.note }); };

  return (
    <div data-testid="scam-shield-app" className="min-h-svh text-slate-200">
      <header data-testid="app-header" className="sticky top-0 z-30 border-b border-white/8 bg-[#070c18]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a data-testid="brand-link" href="#analyzer" className="flex items-center gap-3">
            <div className="shield-pulse rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-2 text-emerald-300"><ShieldCheck className="size-5" /></div>
            <div><div data-testid="brand-name" className="font-heading text-sm font-bold tracking-wide text-white">AI SCAM SHIELD</div><div data-testid="brand-subtitle" className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Pre-transaction intelligence</div></div>
          </a>
          <div className="hidden items-center gap-1 md:flex">
            {["analyzer", "history", "learn", "difference"].map((target) => <a data-testid={`nav-${target}-link`} key={target} href={`#${target}`} className="rounded-lg px-3 py-2 text-xs text-slate-400 transition-[color,background-color] duration-200 hover:bg-white/5 hover:text-white">{target === "difference" ? "Why this" : target[0].toUpperCase() + target.slice(1)}</a>)}
          </div>
          <div className="flex items-center gap-2">
            <select data-testid="header-market-selector" aria-label="Market context" value={market} onChange={(event) => selectMarket(event.target.value as Market)} className="hidden h-9 rounded-lg border border-white/10 bg-[#0f172a] px-2 text-xs text-slate-300 outline-none focus:border-sky-400/60 sm:block">
              <option value="upi">India · UPI</option><option value="global">Global payments</option>
            </select>
            <div data-testid="engine-status" className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300 lg:flex"><span className="size-1.5 rounded-full bg-emerald-400" />Engine online</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-16 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section data-testid="hero-section" className="grid items-end gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <SectionEyebrow icon={ShieldAlert}>A calmer second opinion for every payment</SectionEyebrow>
            <h1 data-testid="hero-title" className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl">Stop the payment<br /><span className="text-sky-300">before it starts.</span></h1>
            <p data-testid="hero-description" className="mt-6 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">Paste a request, check the signals, and get an action you can understand. Built for UPI-first realities where urgency and impersonation are part of the scam.</p>
            <div data-testid="hero-trust-row" className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-wider text-slate-500"><span className="flex items-center gap-2"><LockKeyhole className="size-3 text-emerald-400" /> No bank credentials</span><span className="flex items-center gap-2"><Layers3 className="size-3 text-sky-400" /> Explainable scoring</span><span className="flex items-center gap-2"><Zap className="size-3 text-amber-400" /> Under 2 seconds</span></div>
          </div>
          <div data-testid="hero-system-card" className="relative overflow-hidden rounded-2xl border border-sky-400/15 bg-[#0d1527]/75 p-6 shadow-2xl shadow-sky-950/20">
            <div className="absolute -right-12 -top-16 size-48 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="relative flex items-start justify-between"><div><p data-testid="system-card-label" className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Live protection layer</p><p data-testid="system-card-title" className="mt-2 font-heading text-xl font-semibold text-white">Read the story, not just the amount</p></div><Activity className="size-5 text-sky-300" /></div>
            <div className="relative mt-6 grid grid-cols-3 gap-2"><div data-testid="system-signal-card" className="rounded-lg border border-white/8 bg-white/[0.03] p-3"><div className="font-mono text-lg text-amber-300">06</div><div className="mt-1 text-[10px] text-slate-500">risk rules</div></div><div data-testid="system-context-card" className="rounded-lg border border-white/8 bg-white/[0.03] p-3"><div className="font-mono text-lg text-emerald-300">2</div><div className="mt-1 text-[10px] text-slate-500">market modes</div></div><div data-testid="system-action-card" className="rounded-lg border border-white/8 bg-white/[0.03] p-3"><div className="font-mono text-lg text-sky-300">1</div><div className="mt-1 text-[10px] text-slate-500">clear action</div></div></div>
          </div>
        </section>

        <section id="analyzer" data-testid="analyzer-section" className="scroll-mt-24">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><SectionEyebrow icon={QrCode}>01 / Inspect a payment request</SectionEyebrow><h2 data-testid="analyzer-title" className="text-3xl font-bold tracking-tight text-white">What are you being asked to pay?</h2><p data-testid="analyzer-description" className="mt-2 text-sm text-slate-400">Use a demo scenario or enter the request exactly as you received it.</p></div><div data-testid="mode-indicator" className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500"><span className="size-2 rounded-full bg-sky-400" />{market === "upi" ? "India / UPI context" : "Global payment context"}</div></div>
          <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PRESETS.map((preset, index) => <button data-testid={`preset-scenario-${index + 1}-button`} key={preset.label} type="button" onClick={() => choosePreset(preset)} className="group rounded-xl border border-white/8 bg-[#0d1527]/70 p-3 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-[#111e35]"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-200">{preset.label}</span><ChevronRight className="size-3.5 text-slate-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-sky-300" /></div><span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-slate-500">{preset.note}</span></button>)}
          </div>
          <div className="grid gap-5 lg:grid-cols-7">
            <Card data-testid="request-form-card" className="border-white/10 bg-[#0f172a]/80 lg:col-span-4">
              <CardHeader><CardTitle data-testid="request-form-title" className="text-lg text-white">Request details</CardTitle><CardDescription data-testid="request-form-description">No payment is initiated. This is a safety check only.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2"><label data-testid="recipient-field-label" className="space-y-2 text-xs font-medium text-slate-300">Recipient / VPA<Input data-testid="recipient-input" value={form.recipient} onChange={(event) => updateForm("recipient", event.target.value)} placeholder="e.g. name@upi or merchant ID" className="mt-2 border-white/10 bg-[#070c18] text-sm text-white placeholder:text-slate-600" /></label><label data-testid="amount-field-label" className="space-y-2 text-xs font-medium text-slate-300">Amount (INR or local)<Input data-testid="amount-input" type="number" min="0" value={form.amount || ""} onChange={(event) => updateForm("amount", Number(event.target.value))} placeholder="0" className="mt-2 border-white/10 bg-[#070c18] text-sm text-white placeholder:text-slate-600" /></label></div>
                <div className="grid gap-4 sm:grid-cols-2"><label data-testid="method-field-label" className="space-y-2 text-xs font-medium text-slate-300">Payment method<select data-testid="payment-method-select" value={form.payment_method} onChange={(event) => updateForm("payment_method", event.target.value as PaymentMethod)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[#070c18] px-3 text-sm text-slate-200 outline-none focus:border-sky-400/60"><option>UPI collect</option><option>QR code</option><option>Bank transfer</option><option>Card</option><option>Wallet</option></select></label><label data-testid="market-field-label" className="space-y-2 text-xs font-medium text-slate-300">Market context<select data-testid="market-selector" value={form.market} onChange={(event) => selectMarket(event.target.value as Market)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[#070c18] px-3 text-sm text-slate-200 outline-none focus:border-sky-400/60"><option value="upi">India · UPI</option><option value="global">Global payments</option></select></label></div>
                <label data-testid="message-field-label" className="block space-y-2 text-xs font-medium text-slate-300">Message or request wording<Textarea data-testid="message-input" value={form.message} onChange={(event) => updateForm("message", event.target.value)} placeholder="Paste the SMS, WhatsApp message, or payment note..." className="mt-2 min-h-28 resize-none border-white/10 bg-[#070c18] text-sm leading-6 text-white placeholder:text-slate-600" /></label>
                <label data-testid="urgency-toggle-label" className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/8 bg-white/[0.025] p-3 text-xs text-slate-300"><input data-testid="urgency-checkbox" type="checkbox" checked={form.urgency_flag} onChange={(event) => updateForm("urgency_flag", event.target.checked)} className="size-4 accent-amber-500" /><span><span className="block font-semibold text-slate-200">They are pressuring me to act now</span><span className="mt-0.5 block text-[11px] text-slate-500">Urgency is a signal, not proof — we show it transparently.</span></span></label>
                <Button data-testid="analyze-request-button" type="button" disabled={analyzeMutation.isPending || form.recipient.trim().length < 2 || form.message.trim().length < 3} onClick={() => analyzeMutation.mutate(form)} className="h-11 w-full bg-sky-500 font-semibold text-white shadow-lg shadow-sky-950/30 transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-sky-400 hover:shadow-sky-500/20">{analyzeMutation.isPending ? <><Activity className="mr-2 size-4 animate-pulse" /> Reading the request...</> : <><ShieldCheck className="mr-2 size-4" /> Run safety check</>}</Button>
              </CardContent>
            </Card>
            <div className="lg:col-span-3"><ScorePanel analysis={latest} /></div>
          </div>
        </section>

        <section id="history" data-testid="history-section" className="scroll-mt-24">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><SectionEyebrow icon={BarChart3}>02 / Your protection ledger</SectionEyebrow><h2 data-testid="history-title" className="text-3xl font-bold tracking-tight text-white">Signals worth remembering</h2><p data-testid="history-description" className="mt-2 text-sm text-slate-400">Every check becomes a small lesson and a searchable audit trail.</p></div><div data-testid="history-data-note" className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{scansQuery.isError ? "Local demo view · API unavailable" : "Live from your shield ledger"}</div></div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard testId="metric-total-scans" label="Requests checked" value={String(stats.total_scans)} icon={Activity} tone="sky" /><MetricCard testId="metric-critical-scans" label="Critical intercepted" value={String(stats.critical_scans)} icon={ShieldAlert} tone="rose" /><MetricCard testId="metric-rupees-protected" label="Value held back" value={formatINR(stats.rupees_protected)} icon={CircleDollarSign} tone="amber" /><MetricCard testId="metric-safe-scans" label="Safe patterns" value={String(stats.safe_scans)} icon={ShieldCheck} tone="emerald" /></div>
          <Card data-testid="history-table-card" className="border-white/10 bg-[#0f172a]/80"><CardContent className="p-0"><div className="flex flex-col gap-3 border-b border-white/8 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-600" /><Input data-testid="history-search-input" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search recipients or messages" className="h-9 border-white/10 bg-[#070c18] pl-9 text-xs text-white placeholder:text-slate-600" /></div><div className="flex gap-1">{(["ALL", "CRITICAL", "WARNING", "SAFE"] as const).map((filter) => <button data-testid={`history-filter-${filter.toLowerCase()}-button`} key={filter} type="button" onClick={() => setHistoryFilter(filter)} className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] transition-[background-color,color] duration-200 ${historyFilter === filter ? "bg-sky-500/15 text-sky-300" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}`}>{filter}</button>)}</div></div>{filteredScans.length === 0 ? <div data-testid="history-empty-state" className="flex min-h-40 flex-col items-center justify-center p-6 text-center"><FileText className="size-7 text-slate-700" /><p data-testid="history-empty-title" className="mt-3 text-sm font-semibold text-slate-400">No matching scans yet</p><p data-testid="history-empty-description" className="mt-1 text-xs text-slate-600">Run the first check above and it will appear here.</p></div> : <div data-testid="history-scan-list" className="divide-y divide-white/6">{filteredScans.slice(0, 8).map((scan) => <div data-testid={`history-scan-${scan.id}`} key={scan.id} className="flex flex-col gap-3 p-4 transition-[background-color] duration-200 hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className={`rounded-lg border p-2 ${severityClasses(scan.severity)}`}>{scan.severity === "SAFE" ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}</div><div className="min-w-0"><p data-testid={`history-recipient-${scan.id}`} className="truncate text-sm font-semibold text-slate-200">{scan.recipient}</p><p data-testid={`history-message-${scan.id}`} className="truncate text-xs text-slate-500">{scan.message}</p></div></div><div className="flex items-center gap-5 pl-12 sm:pl-0"><div className="text-right"><div data-testid={`history-score-${scan.id}`} className="font-mono text-sm text-white">{scan.score}<span className="text-slate-600">/100</span></div><div data-testid={`history-time-${scan.id}`} className="font-mono text-[9px] text-slate-600">{formatTime(scan.analyzed_at)}</div></div><Badge data-testid={`history-severity-${scan.id}`} className={`font-mono text-[10px] ${severityClasses(scan.severity)}`}>{scan.severity}</Badge></div></div>)}</div>}</CardContent></Card>
        </section>

        <section id="learn" data-testid="education-section" className="scroll-mt-24"><div className="mb-6"><SectionEyebrow icon={BookOpen}>03 / What-if safety lab</SectionEyebrow><h2 data-testid="education-title" className="text-3xl font-bold tracking-tight text-white">Practice the pause</h2><p data-testid="education-description" className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Scams work by making a risky action feel like the only action. Choose a scenario, then see the safe response.</p></div><div className="grid gap-4 lg:grid-cols-3">{LESSONS.map((lesson, index) => { const Icon = lesson.icon; return <button data-testid={`education-lesson-${index + 1}-button`} key={lesson.title} type="button" onClick={() => setSelectedLesson(index)} className={`rounded-xl border p-5 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 ${selectedLesson === index ? "border-sky-400/40 bg-sky-400/10" : "border-white/8 bg-[#0d1527]/70 hover:border-white/20"}`}><div className="flex items-center justify-between"><Icon className={`size-5 ${selectedLesson === index ? "text-sky-300" : "text-slate-500"}`} /><span data-testid={`education-category-${index + 1}`} className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{lesson.category}</span></div><h3 data-testid={`education-title-${index + 1}`} className="mt-8 text-base font-semibold text-white">{lesson.title}</h3><p data-testid={`education-prompt-${index + 1}`} className="mt-2 text-xs leading-5 text-slate-500">{lesson.prompt}</p></button> })}</div><div data-testid="education-answer-card" className="mt-4 flex gap-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /><div><p data-testid="education-answer-label" className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">Safe response</p><p data-testid="education-answer" className="mt-2 text-sm leading-6 text-slate-300">{LESSONS[selectedLesson].answer}</p></div></div></section>

        <section id="report" data-testid="report-section" className="scroll-mt-24 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div><SectionEyebrow icon={Flag}>04 / Strengthen the network</SectionEyebrow><h2 data-testid="report-title" className="text-3xl font-bold tracking-tight text-white">Seen a suspicious handle?</h2><p data-testid="report-description" className="mt-3 text-sm leading-6 text-slate-400">Report the pattern, not personal data. This demo queues the incident for community review and shows how a future threat list could grow.</p><div data-testid="report-guidance" className="mt-5 flex gap-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-xs leading-5 text-amber-200/80"><AlertTriangle className="size-4 shrink-0 text-amber-300" /> Never include your PIN, OTP, passwords, or full card details in a report.</div></div><Card data-testid="report-form-card" className="border-white/10 bg-[#0f172a]/80"><CardHeader><CardTitle data-testid="report-form-title" className="text-lg text-white">Create an incident report</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label data-testid="report-handle-label" className="space-y-2 text-xs font-medium text-slate-300">Handle, number, or link<Input data-testid="report-handle-input" value={report.handle} onChange={(event) => setReport((current) => ({ ...current, handle: event.target.value }))} placeholder="example@upi" className="mt-2 border-white/10 bg-[#070c18] text-sm text-white placeholder:text-slate-600" /></label><label data-testid="report-category-label" className="space-y-2 text-xs font-medium text-slate-300">Category<select data-testid="report-category-select" value={report.category} onChange={(event) => setReport((current) => ({ ...current, category: event.target.value as ReportRequest["category"] }))} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[#070c18] px-3 text-sm text-slate-200 outline-none focus:border-sky-400/60"><option>UPI handle</option><option>Phone number</option><option>Phishing link</option><option>Other</option></select></label></div><label data-testid="report-details-label" className="block space-y-2 text-xs font-medium text-slate-300">What happened?<Textarea data-testid="report-details-input" value={report.details} onChange={(event) => setReport((current) => ({ ...current, details: event.target.value }))} placeholder="Describe the pressure, request, or link without sharing secrets..." className="mt-2 min-h-24 resize-none border-white/10 bg-[#070c18] text-sm leading-6 text-white placeholder:text-slate-600" /></label><Button data-testid="report-submit-button" type="button" disabled={reportMutation.isPending || report.handle.trim().length < 2 || report.details.trim().length < 10} onClick={() => reportMutation.mutate(report)} className="bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"><Send className="mr-2 size-4" /> Submit to review queue</Button></CardContent></Card></section>

        <section id="difference" data-testid="difference-section" className="scroll-mt-24"><div className="mb-6"><SectionEyebrow icon={Globe2}>05 / Why this wins</SectionEyebrow><h2 data-testid="difference-title" className="max-w-2xl text-3xl font-bold tracking-tight text-white">A prevention layer, not another fraud notification.</h2><p data-testid="difference-description" className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Banks and payment apps are essential rails. AI Scam Shield sits one step earlier, helping a person understand the story before they tap approve.</p></div><div className="grid gap-4 md:grid-cols-3"><DifferenceCard testId="difference-bank-alerts" label="Bank alerts" title="After the trigger" description="Most alerts confirm a transaction or flag it after a payment attempt. We add a decision moment before the money moves." icon={Landmark} /><DifferenceCard testId="difference-antivirus" label="Antivirus" title="Built for payment stories" description="Instead of scanning a device, the shield reads urgency, recipient context, QR reversals, and fee traps in plain language." icon={Layers3} /><DifferenceCard testId="difference-shield" label="AI Scam Shield" title="Explainable friction" description="Every score shows the rules that fired and one clear next action. That makes education part of the protection." icon={ShieldCheck} /></div></section>

        <section data-testid="deliverables-section" className="rounded-2xl border border-sky-400/15 bg-gradient-to-br from-sky-500/10 via-[#0d1527]/90 to-[#0d1527]/90 p-6 sm:p-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div><SectionEyebrow icon={Download}>Prototype handoff</SectionEyebrow><h2 data-testid="deliverables-title" className="text-2xl font-bold text-white">Take the shield with you.</h2><p data-testid="deliverables-description" className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Download the runnable project, or share just the layers your team needs for the next hackathon review.</p></div><div className="flex flex-wrap gap-3"><a data-testid="download-complete-button" href="/downloads/ai-scam-shield-complete.zip" download className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-500 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-sky-400"><Download className="size-4" /> Full project</a><a data-testid="download-frontend-button" href="/downloads/ai-scam-shield-frontend.zip" download className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition-[background-color,border-color] duration-200 hover:border-white/30 hover:bg-white/10"><Download className="size-4" /> Frontend</a><a data-testid="download-backend-button" href="/downloads/ai-scam-shield-backend.zip" download className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition-[background-color,border-color] duration-200 hover:border-white/30 hover:bg-white/10"><Download className="size-4" /> Backend</a></div></div><div data-testid="prototype-mode-note" className="mt-6 flex items-center gap-2 border-t border-white/8 pt-4 font-mono text-[10px] uppercase tracking-wider text-slate-500"><Zap className="size-3 text-amber-300" /> Demo analysis is transparent rule-based simulation · no real payment is initiated</div></section>
      </main>
      <footer data-testid="app-footer" className="border-t border-white/8 px-4 py-8 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">AI Scam Shield · A prevention-first fintech prototype · Built for safer decisions</footer>
    </div>
  );
}

function MetricCard({ testId, label, value, icon: Icon, tone }: { testId: string; label: string; value: string; icon: typeof Activity; tone: "sky" | "rose" | "amber" | "emerald" }) {
  const colors = { sky: "text-sky-300 bg-sky-400/10 border-sky-400/20", rose: "text-rose-300 bg-rose-400/10 border-rose-400/20", amber: "text-amber-300 bg-amber-400/10 border-amber-400/20", emerald: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" };
  return <div data-testid={testId} className="rounded-xl border border-white/8 bg-[#0d1527]/70 p-4"><div className="flex items-center justify-between"><span data-testid={`${testId}-label`} className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</span><span className={`rounded-md border p-1.5 ${colors[tone]}`}><Icon className="size-3.5" /></span></div><p data-testid={`${testId}-value`} className="mt-4 font-heading text-2xl font-semibold text-white">{value}</p></div>;
}

function DifferenceCard({ testId, label, title, description, icon: Icon }: { testId: string; label: string; title: string; description: string; icon: typeof Landmark }) {
  return <div data-testid={testId} className="rounded-xl border border-white/8 bg-[#0d1527]/70 p-5"><div className="flex items-center justify-between"><span data-testid={`${testId}-label`} className="font-mono text-[10px] uppercase tracking-wider text-sky-300">{label}</span><ArrowUpRight className="size-4 text-slate-600" /></div><Icon className="mt-8 size-6 text-slate-300" /><h3 data-testid={`${testId}-title`} className="mt-5 text-lg font-semibold text-white">{title}</h3><p data-testid={`${testId}-description`} className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div>;
}