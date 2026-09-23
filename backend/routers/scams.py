import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter

from lib.db import db
from models.scam import (
    DashboardStats,
    ReportRequest,
    ReportResponse,
    RiskSignal,
    ScamAnalysis,
    ScamAnalysisRequest,
)


router = APIRouter(prefix="/scams", tags=["scam-shield"])


def _signal(code: str, title: str, detail: str, points: int, severity: str) -> RiskSignal:
    return RiskSignal(code=code, title=title, detail=detail, points=points, severity=severity)  # type: ignore[arg-type]


def _build_analysis(payload: ScamAnalysisRequest) -> ScamAnalysis:
    text = f"{payload.message} {payload.recipient}".lower()
    signals: list[RiskSignal] = []

    if payload.urgency_flag or any(word in text for word in ("urgent", "immediately", "disconnect", "last chance", "today only")):
        signals.append(_signal("urgency", "Pressure to act now", "Urgent language reduces the time you have to verify the request independently.", 25, "WARNING"))

    if any(word in text for word in ("electricity", "gas bill", "connection", "disconnection")) and any(word in text for word in ("pay", "disconnect", "stop")):
        signals.append(_signal("authority-threat", "Impersonated service threat", "Fake utility or service-disconnection claims use fear to make a payment feel mandatory.", 20, "CRITICAL"))

    if any(word in text for word in ("otp", "one time password", "upi pin", "pin", "cvv", "password")):
        signals.append(_signal("secret", "Requests a secret", "Legitimate payment flows never need your UPI PIN, OTP, CVV, or password to receive money.", 30, "CRITICAL"))

    if any(word in text for word in ("lottery", "prize", "cashback", "reward", "tax", "processing fee", "refund fee")):
        signals.append(_signal("fee-trap", "Prize or refund fee", "Unexpected fees attached to a prize, refund, or cashback are a common advance-payment pattern.", 25, "WARNING"))

    if any(word in text for word in ("anydesk", "teamviewer", "remote access", "telegram job", "deposit", "investment")):
        signals.append(_signal("remote-or-deposit", "High-risk social engineering", "Remote access and job or investment deposits create an unsafe path to your account or money.", 25, "CRITICAL"))

    if payload.payment_method == "QR code" and any(word in text for word in ("receive", "get money", "collect", "refund")):
        signals.append(_signal("qr-reversal", "QR reversal trap", "Scanning a QR code is normally a payment action, not a way to receive money.", 25, "CRITICAL"))

    known_recipient = any(name in payload.recipient.lower() for name in ("swiggy", "zomato", "amazon", "flipkart", "irctc"))
    if payload.market == "upi" and not known_recipient and ("@" not in payload.recipient or re.search(r"@(gmail|yahoo|outlook)\.", payload.recipient.lower())):
        signals.append(_signal("recipient", "Recipient needs verification", "This handle does not look like a recognizable merchant identity. Verify it in your bank app before paying.", 20, "WARNING"))

    if payload.amount >= 50000:
        signals.append(_signal("amount", "Large amount", "Large-value requests deserve an independent callback or second-person review before approval.", 15, "WARNING"))
    elif payload.amount >= 10000:
        signals.append(_signal("amount", "Above usual amount", "A larger-than-usual payment increases the impact if the recipient is fraudulent.", 8, "WARNING"))

    score = min(100, sum(item.points for item in signals))
    if score >= 70:
        severity = "CRITICAL"
        verdict = "Pause — this request shows multiple scam signals"
        recommendation = "Do not pay or scan. Close the request, verify the recipient using a trusted channel, and report it if the story is unfamiliar."
    elif score >= 40:
        severity = "WARNING"
        verdict = "Verify before you proceed"
        recommendation = "Do not rush. Check the recipient name in your bank app and contact the person or business using a number you already trust."
    else:
        severity = "SAFE"
        verdict = "No high-risk pattern found"
        recommendation = "Still review the recipient and amount in your payment app. Never share a PIN or OTP, even when a request looks safe."

    return ScamAnalysis(
        analyzed_at=datetime.now(timezone.utc),
        market=payload.market,
        recipient=payload.recipient,
        amount=payload.amount,
        payment_method=payload.payment_method,
        message=payload.message,
        urgency_flag=payload.urgency_flag,
        score=score,
        severity=severity,  # type: ignore[arg-type]
        verdict=verdict,
        recommendation=recommendation,
        signals=signals,
    )


@router.post("/analyze", response_model=ScamAnalysis)
async def analyze_request(payload: ScamAnalysisRequest):
    analysis = _build_analysis(payload)
    await db.scans.insert_one(analysis.model_dump())
    return analysis


@router.get("", response_model=list[ScamAnalysis])
async def list_scans():
    documents = await db.scans.find().sort("analyzed_at", -1).to_list(100)
    return [ScamAnalysis(**document) for document in documents]


@router.get("/stats", response_model=DashboardStats)
async def get_stats():
    documents = await db.scans.find().to_list(1000)
    critical = [item for item in documents if item.get("severity") == "CRITICAL"]
    warning = [item for item in documents if item.get("severity") == "WARNING"]
    safe = [item for item in documents if item.get("severity") == "SAFE"]
    high_risk = {item.get("recipient") for item in critical + warning if item.get("recipient")}
    return DashboardStats(
        total_scans=len(documents),
        critical_scans=len(critical),
        warning_scans=len(warning),
        safe_scans=len(safe),
        rupees_protected=sum(float(item.get("amount", 0)) for item in critical + warning),
        high_risk_recipients=len(high_risk),
    )


@router.post("/reports", response_model=ReportResponse)
async def report_request(payload: ReportRequest):
    response = ReportResponse(
        submitted_at=datetime.now(timezone.utc),
        message="Report received. The handle has been queued for community review.",
    )
    await db.scam_reports.insert_one({**payload.model_dump(), **response.model_dump()})
    return response
