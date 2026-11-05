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

Members may pay registration, subscription, and retreat/bonding fees through PayHero M-Pesa STK checkout when `PAYHERO_ENABLED=true` and its server-only credentials, M-Pesa channel ID, and public HTTPS callback URL are configured. The amount is loaded from the server fee settings; the member can provide their Kenyan mobile number. PayHero callbacks are only a notification: the server fetches the transaction status directly from PayHero and checks the external reference, amount, and M-Pesa receipt before recording success. Duplicate submissions are serialized per member and duplicate callbacks are idempotent. Do not mark a payment successful based on a browser response.

`PAYHERO_ACCOUNT_ID` is retained as a configuration reference but is not a substitute for the API's `PAYHERO_CHANNEL_ID`. Use the channel ID for the M-Pesa collection channel. `PAYHERO_BASIC_AUTH_TOKEN` can be a full `Basic ...` authorization value or the base64 token; otherwise the API username/password pair is used. Keep all PayHero credentials server-side, do not add `NEXT_PUBLIC_` prefixes, and configure the same values in the hosting provider's environment settings as the deployment that receives the callback. A local `localhost` callback cannot receive provider requests. Until PayHero has sent a real transaction callback and the payment is confirmed in the ledger, treat the integration as unverified. Cash and other member-reported payments continue to require committee review.

The `20261105162700_payhero_checkout` migration adds a payment-source value for pending PayHero checkouts. Apply it with `npm run db:migrate` before deploying this version.

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
10. As Committee, verify a pending member-reported claim with a reason and check its source, status, audit record, receipt reference, and (for registration) member activation. Reject or cancel another claim and ensure it is not counted as successful income.
11. With PayHero configured in a test deployment, initiate an STK prompt for each eligible fee type. Confirm the ledger remains pending before provider confirmation, duplicate submissions do not create a second prompt, and only PayHero-verified amount/reference/receipt data settles a payment.

## Limitations

- Reconciliation entries are typed manually; CSV statement upload/import and manual exception resolution are not included.
- A production-scoped report excludes legacy member fee payments because the existing `Payment` model is season-linked but has no production relationship. Season reports include those member payments.
- Reimbursement receipts and finance receipts are references only; no upload or document storage integration is included.
- Retreat/bonding is a configurable club-wide fee type, not a retreat/event booking system. PayHero must be configured and tested in each deployment before presenting live checkout as available.
- The existing migration history cannot currently be replayed into Prisma's clean shadow database: `20261022090436_production_entities` attempts to alter the `Ballot` table before the later elections migration creates it. Phase 5 was applied additively with `migrate deploy` to the existing development database; clean shadow replay should be repaired separately without rewriting applied migrations.
- No legal, tax, or accounting-compliance claims are made; confirm applicable local requirements before using generated reports as statutory records.
