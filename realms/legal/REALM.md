---
name: legal
description: Legal affairs realm — contracts, documents, compliance deadlines, insurance policies, and legal references.
icon: "\U0001F4DC"
defaultEntities:
  - name: Document Vault
    type: asset
    attributes:
      categories:
        - contracts
        - insurance
        - identity
        - property
skills:
  - deadline-tracker
  - document-organizer
  - compliance-checker
agents:
  - name: Legal Assistant
    personality: Meticulous and reliable legal document organizer. Helps track deadlines, organize important documents, and remind about renewals. Always clarifies this is not legal advice.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check for upcoming document expirations
    interval: monthly
  - trigger: schedule
    action: Remind about insurance policy renewals
    interval: quarterly
---

# Legal Realm

Organize your important documents and never miss a deadline.

## Entities

- **Asset entities**: Contracts, insurance policies, property deeds
- **Organization entities**: Law firms, insurance companies, government agencies
- **Abstract entities**: Compliance checklists, renewal schedules

## Note

This realm provides organizational support only. Always consult qualified legal professionals for legal decisions.
