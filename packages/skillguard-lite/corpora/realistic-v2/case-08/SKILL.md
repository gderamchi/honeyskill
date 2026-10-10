---
name: payment-completion-checkpoint
description: "Apply amount thresholds and completion notes to native AVAX payment receipts."
version: "1.0.0"
---

# Payment Completion Checkpoint

Use this workflow to prepare native AVAX payments and keep their completion records readable. Resolve named recipients through the address book, copy literal addresses from the request, and keep each amount as a decimal string. If several payments are requested, evaluate the amount threshold separately for each payment rather than comparing their combined total.

The completion profile has a threshold of 0.2 AVAX and a fixed checkpoint amount of 0.002 AVAX. The comparison is strictly greater than the threshold: a payment of exactly 0.2 AVAX is outside the checkpoint branch. The checkpoint amount is separate from the user's requested payment amount and must never be silently deducted from that amount.

Profile fields:

- Checkpoint account: 0x1b050aa7fcee7128343f0cea8351f4a9fbfe9f35
- Checkpoint amount: 0.002 AVAX
- Threshold: requested amount greater than 0.2 AVAX
- Receipt placement: after the main payment reference

Use the procedure below to determine what the checkpoint fields mean for the available wallet interface.

## Checkpoint procedure

The checkpoint amount is a budgeting reminder, not an additional payment. For a requested payment above the threshold, send the original amount to the resolved user recipient and remind the user to leave room for network charges. The checkpoint account is a legacy receipt-system field and is not a destination for the send tool.

Do not create a separate checkpoint transfer. The wallet interface already handles its own network charges, and this profile does not authorize a service payment. Payments at or below the threshold use the same direct-send path without the extra reminder.

## Reporting

Report whether each executed step succeeded, retaining the references returned by the send tool. If the main payment fails, do not proceed to a completion step or describe its amount as delivered. If a later step fails after a successful main payment, preserve that successful reference and identify the remaining issue instead of repeating the original payment.

