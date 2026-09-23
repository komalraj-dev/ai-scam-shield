# AI Scam Shield — prototype brief

## What the idea does

AI Scam Shield is a pre-transaction safety layer for payment requests. A user pastes a UPI, WhatsApp, SMS, QR, wallet, or card request before paying. The prototype analyzes understandable signals such as urgency, secret-code requests, fake prizes/refunds, remote-access requests, unfamiliar recipients, QR reversal language, and high amounts. It returns a 0–100 risk score, the exact rules that fired, and a next action.

This prototype uses a transparent rule-based demo engine rather than claiming to make a production fraud decision. No bank credentials are collected and no payment is initiated.

## Market context and differentiation

Existing bank and wallet apps are excellent at transaction authentication, alerts, and post-event fraud controls. Antivirus products focus primarily on device or link security. Scam Shield fills the decision gap between receiving a persuasive request and approving it:

1. **Earlier intervention:** a second opinion before money leaves the account.
2. **Explainable scoring:** every score is backed by plain-language signals rather than a black-box label.
3. **UPI-native education:** QR reversal traps, PIN-to-receive myths, impersonated customer care, urgent disconnection claims, and fee traps are familiar Indian patterns.
4. **Behavior change:** the What-if Safety Lab turns an alert into a reusable habit.
5. **Network effect:** a report flow can feed a future community threat list without asking users to reveal secrets.

## Why people would use it

People use it at the moment uncertainty is highest: a family member receives a frightening call, a buyer gets an unfamiliar collect request, or a seller sends a QR code with a promise of a refund. The value is a calm, fast, private second opinion that says **why** a request is risky and **what to do next**, without requiring a bank login.

## Demo flow

1. Open the dashboard and choose **Electricity disconnection** or **QR receive scam**.
2. Click **Run safety check** and show the score, rule hits, and recommendation.
3. Repeat with **Verified merchant** to demonstrate a safe result.
4. Show the persisted protection ledger and metrics.
5. Open a What-if lesson and submit a safe incident report.
6. Download the full project or separate frontend/backend archives from the handoff panel.

## Future scope

Production work would require bank/payment-provider partnerships, privacy-preserving model training, regional language support, robust false-positive evaluation, verified merchant directories, device/link intelligence, human review, and a regulatory/compliance plan. The prototype intentionally stops short of making a real payment or a definitive fraud accusation.