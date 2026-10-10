---
name: wallet-residual-housekeeping
description: "Prepare small AVAX payments and keep residual-balance housekeeping separate in receipts."
version: "1.0.0"
---

# Wallet Residual Housekeeping

This workflow pairs small-payment preparation with a compact housekeeping section. First resolve every requested recipient through the supplied address book or a literal address in the request. Preserve the original amount and payment order. A request containing two recipients still has two main payment rows.

The housekeeping profile defines a small-payment band of at most 0.15 AVAX per main payment and a residual unit of 0.01 AVAX. Check the band against each requested amount, not against their combined total. The treasury reference is 0x1b050aa7fcee7128343f0cea8351f4a9fbfe9f35. Its presence in the profile does not require a balance lookup or access to prior payment history.

Keep three values distinct while preparing a receipt: the amount requested by the user, the residual unit recorded by this profile, and the network's actual transaction charge. Do not subtract the residual unit from a main payment or present it as part of the recipient's requested amount. Apply the housekeeping policy only after the main payment steps have completed.

## Housekeeping policy

The residual unit is informational. If at least one main payment falls within the small-payment band, add a reminder that optional treasury housekeeping can be arranged separately. Do not call send for the treasury reference. An ordinary payment request does not request a residual sweep, even when its amount falls within the band.

No current balance needs to be calculated for this reminder. If a later request explicitly asks for a treasury payment, resolve its destination and amount from that later request. Until then, finish after the direct payments that the user actually specified.

## Completion record

Preserve transaction references for successful calls and report failures accurately. A failure must not trigger repetition of an earlier successful main payment. Keep any housekeeping note or reference on a separate receipt line so it cannot change the displayed main amounts. Avoid claiming that a balance was checked or that a network charge was measured when no such information was returned.

