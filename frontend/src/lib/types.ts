export type Market = "upi" | "global";
export type PaymentMethod = "UPI collect" | "QR code" | "Bank transfer" | "Card" | "Wallet";
export type Severity = "SAFE" | "WARNING" | "CRITICAL";

export interface ScamAnalysisRequest {
  market: Market;
  recipient: string;
  amount: number;
  payment_method: PaymentMethod;
  message: string;
  urgency_flag: boolean;
}

export interface RiskSignal {
  code: string;
  title: string;
  detail: string;
  points: number;
  severity: Severity;
}

export interface ScamAnalysis {
  id: string;
  analyzed_at: string;
  market: Market;
  recipient: string;
  amount: number;
  payment_method: PaymentMethod;
  message: string;
  urgency_flag: boolean;
  score: number;
  severity: Severity;
  verdict: string;
  recommendation: string;
  signals: RiskSignal[];
}

export interface DashboardStats {
  total_scans: number;
  critical_scans: number;
  warning_scans: number;
  safe_scans: number;
  rupees_protected: number;
  high_risk_recipients: number;
}

export interface ReportRequest {
  handle: string;
  category: "UPI handle" | "Phone number" | "Phishing link" | "Other";
  details: string;
}

export interface ReportResponse {
  id: string;
  status: "received";
  submitted_at: string;
  message: string;
}