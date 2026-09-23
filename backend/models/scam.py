from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, Field


Market = Literal["upi", "global"]
PaymentMethod = Literal["UPI collect", "QR code", "Bank transfer", "Card", "Wallet"]
Severity = Literal["SAFE", "WARNING", "CRITICAL"]


class ScamAnalysisRequest(BaseModel):
    market: Market = "upi"
    recipient: str = Field(min_length=2, max_length=120)
    amount: float = Field(ge=0, le=100000000)
    payment_method: PaymentMethod = "UPI collect"
    message: str = Field(min_length=3, max_length=2000)
    urgency_flag: bool = False


class RiskSignal(BaseModel):
    code: str
    title: str
    detail: str
    points: int
    severity: Severity


class ScamAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    analyzed_at: datetime
    market: Market
    recipient: str
    amount: float
    payment_method: PaymentMethod
    message: str
    urgency_flag: bool
    score: int = Field(ge=0, le=100)
    severity: Severity
    verdict: str
    recommendation: str
    signals: list[RiskSignal]


class DashboardStats(BaseModel):
    total_scans: int
    critical_scans: int
    warning_scans: int
    safe_scans: int
    rupees_protected: float
    high_risk_recipients: int


class ReportRequest(BaseModel):
    handle: str = Field(min_length=2, max_length=160)
    category: Literal["UPI handle", "Phone number", "Phishing link", "Other"] = "UPI handle"
    details: str = Field(min_length=10, max_length=2000)


class ReportResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: Literal["received"] = "received"
    submitted_at: datetime
    message: str