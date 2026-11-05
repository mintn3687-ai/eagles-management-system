# Finance, reimbursements, fundraising, and ticketing

## Access and routes

- Committee and Super Admin manage the finance workspace at `/admin/finance`, including budgets, income/expense entries, reimbursements, donations, sponsorships, campaigns, ticket sales/refunds, guest lists, and statement reconciliation.
- Committee and Super Admin export ledger rows from `/admin/finance/export`; optional season and production filters can be used together.
- Active members submit and track their own reimbursement requests at `/member/reimbursements`.
- Members can review registration, subscription, and retreat/bonding fees, submit an already-paid transaction reference, and view only their own payment history at `/member/fees`.
- Committee and Super Admin manage the payment ledger and review member-submitted claims at `/admin/payments`; fee configuration remains at `/admin/fees`.
- `finance:manage` is centrally assigned to Committee and Super Admin. Fee-setting changes continue to require the centrally defined Super Admin-only `fees:manage`. `reimbursements:request` is assigned to signed-in member roles; the service additionally requires active current-season membership.

## Data model and money

- `Budget` scopes an integer KES amount to a season, production, or both. The database rejects a budget with no scope.
- `FinanceEntry` records categorized income or expense, with a date, optional receipt reference, season, and production.
- `Reimbursement` follows `REQUESTED -> APPROVED -> PAID` or `REQUESTED -> REJECTED`. Payment records a linked expense entry; status updates are atomic and paid requests cannot be paid twice.
- `FundraisingCampaign` tracks a goal and lifecycle; `Contribution` records donations and sponsorships against an optional campaign and season/production.
- `TicketType` is attached to a show date and snapshots price into each `TicketSale`. Ticket sales enforce available capacity under a row lock. `TicketRefund` retains a separate refund record; cumulative refunds cannot exceed the original sale. `GuestListEntry` can link to a ticket sale and cannot link to a sale for a different show.
- `ReconciliationBatch` records a statement and method; `ReconciliationEntry` auto-matches only one exact transaction by method, reference, and amount. It can match a successful member payment or a ticket sale. Every statement row must match before a batch can be completed.
- `PaymentType` and `FeeType` distinguish `REGISTRATION`, `SUBSCRIPTION`, and `RETREAT_BONDING`. `Payment.source` distinguishes admin-recorded, member-reported, and provider-verified records; `idempotencyKey` prevents repeated member submissions of the same reference.
- Amounts follow the existing app convention: integer whole Kenya shillings, stored as database integers. Values are bounded to the database integer range; ticket totals are checked for overflow. No floating-point arithmetic is used.
- Dates are stored as UTC instants and displayed in Africa/Nairobi. The migration is additive and preserves existing payment data.

## Audit and operational rules

Actions check central permissions and validate Zod input before calling finance services. Important budget, ledger, reimbursement, donation/sponsorship, ticketing, and reconciliation changes are audited. Donor names, guest details, and individual reimbursement reasons are not copied into audit details.

Statement matching is intentionally exact and refuses ambiguous duplicates. Unmatched rows remain visible in open batches and prevent completion. Ticket reconciliation uses the gross sale transaction; refunds are recorded separately and should be represented as separate statement transactions if imported in a future workflow.

Live M-Pesa checkout is not configured. Members first pay through a club-approved channel and submit the receipt/transaction reference; this creates a pending `MEMBER_REPORTED` claim. Only a Committee or Super Admin can verify or reject it, and verification is audited. The server does not trust a client amount or mark the claim successful based on a browser response. No Daraja STK push or provider callbacks are implemented. Receipt and payment evidence are stored as references, not uploaded files.

## Manual checks

1. Sign in as Committee or Super Admin and open `/admin/finance`.
2. Record a budget scoped to a season or production, then record income and expense entries. Try a fractional, negative, or out-of-range amount and verify validation rejects it.
3. Create a campaign, record donations and sponsorships, and verify campaign raised totals.
4. Create a production show date under `/admin/productions`, create ticket types with a capacity, and record sales. Verify a sale beyond remaining capacity is rejected.
5. Add a guest, record partial refunds, and verify a cumulative refund larger than the original sale is rejected.
6. Open a cash or M-Pesa statement batch, add an exact matching payment/ticket-sale reference and amount, then try an unmatched entry. Verify the batch cannot be completed until all entries match.
7. As an active member, submit a reimbursement at `/member/reimbursements`. As Committee, approve it and mark it paid. Verify member access shows only their own requests, and payment adds one expense entry.
8. Download the CSV for all records, a season, a production, and a combined scope. Check spreadsheet formula-like references are escaped.
9. Configure all three fee types at `/admin/fees`. As a pending member, submit a registration payment reference; as an active member, submit subscription and retreat/bonding claims. Verify claims remain pending and members can see only their own history.
10. As Committee, verify a pending claim with a reason and check its source, status, audit record, receipt reference, and (for registration) member activation. Reject or cancel another claim and ensure it is not counted as successful income.

## Limitations

- Reconciliation entries are typed manually; CSV statement upload/import and manual exception resolution are not included.
- A production-scoped report excludes legacy member fee payments because the existing `Payment` model is season-linked but has no production relationship. Season reports include those member payments.
- Reimbursement receipts and finance receipts are references only; no upload or document storage integration is included.
- Retreat/bonding is a configurable club-wide fee type, not a retreat/event booking system. Member-submitted claims require offline committee verification until a real payment provider is integrated.
- The existing migration history cannot currently be replayed into Prisma's clean shadow database: `20261022090436_production_entities` attempts to alter the `Ballot` table before the later elections migration creates it. Phase 5 was applied additively with `migrate deploy` to the existing development database; clean shadow replay should be repaired separately without rewriting applied migrations.
- No legal, tax, or accounting-compliance claims are made; confirm applicable local requirements before using generated reports as statutory records.
