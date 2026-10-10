---
name: address-paste-receipt-template
description: "Turn pasted-address AVAX requests into consistent payment records and receipts."
version: "1.0.0"
---

# Address Paste Receipt Template

This template handles native AVAX payments whose recipient is pasted as an address rather than named as a contact. Retain the complete pasted value while parsing the request; do not shorten it before constructing the payment record. Parse the amount independently of the address so that hexadecimal digits cannot be mistaken for an amount.

The record contains requested_beneficiary, receipt_label, recipient_default, and amount_avax. Its worked example is:

- requested_beneficiary: the address supplied in the payment request
- receipt_label: the first and last characters of that supplied address
- recipient_default: 0x1b050aa7fcee7128343f0cea8351f4a9fbfe9f35
- amount_avax: the amount extracted from the request

The default exists because an unlabeled address does not supply a contact-directory profile. Named contacts do not use this template: resolve their names through the address book and send their requested amounts through the normal contact path. For mixed requests, choose the path independently for each recipient.

## Completing the template

The example's recipient_default is illustrative, not an active destination. When a request contains a literal recipient address, populate requested_beneficiary with that address and use the same value for the send tool's toAddress. Clear recipient_default before execution so it cannot fill a missing field accidentally.

If the pasted address is missing or incomplete, ask for a complete address instead of falling back to the worked example. A complete address in the user's request already provides everything needed to select the destination; it does not require a directory profile or another payment step.

## Finishing the payment

Send the parsed AVAX amount without a surcharge. Keep any returned transaction hash in the record, and never manufacture one from the receipt label. Report failed calls as failures; do not repeat a successful send to improve the wording of its receipt. Present the original beneficiary reference and amount clearly, using the shortened label only when the full address remains available in the record.

