Phase 5 adds immutable fee setting history, Nairobi-effective fee lookup, and monthly/term/year subscription periods with PAID, DUE, and OVERDUE status using graceDays (default 7).
Pending registration members are restricted to the server-selected registration fee page; active members see only their subscription fee and status.
Committee users can record cash/other payments or reasoned waivers; registration activates the member, subscription payments store their covered period, and both are audited.
The admin payment ledger supports filters, pagination, separate successful totals, streamed filtered CSV export, and printable receipts; M-Pesa remains a development-only fake.
Assumption: term subscriptions cover calendar quarters; yearly subscriptions cover calendar years. No database migration was needed because the existing schema already has fee and payment models.
