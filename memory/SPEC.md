# AI Scam Shield living spec

## Product
Pre-transaction scam prevention dashboard for Indian UPI and global payment contexts. It accepts a payment request, runs an explainable rule-based demo analysis, shows a score and reasons, stores the scan, teaches safety patterns, and accepts suspicious-request reports.

## Data model
- `ScamAnalysisRequest`: market, recipient, amount, payment_method, message, urgency_flag.
- `ScamAnalysis`: request fields plus id, analyzed_at, score, severity, verdict, recommendation, and risk signals.
- `DashboardStats`: scan counts, rupees protected, and high-risk recipient count.
- `ReportRequest` / `ReportResponse`: handle, category, details, and received status.

## Key flows
1. Select a preset or enter a request, then POST `/api/scams/analyze`.
2. Refresh `/api/scams` and `/api/scams/stats` to render the protection ledger.
3. Explore local What-if Safety Lab lessons.
4. Submit a report to POST `/api/scams/reports`.
5. Download generated full, frontend-only, or backend-only ZIP archives.

## Auth and roles
No authentication in the hackathon prototype. No payment or credential access is implemented.

## Demo mode
Analysis is MOCKED as a transparent rule-based simulation. It is not financial advice and does not connect to any bank, UPI rail, LLM provider, or live threat-intelligence feed.