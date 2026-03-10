---
name: health
description: Personal health realm — medical records, appointments, medications, wellness tracking.
icon: "\U0001F3E5"
defaultEntities:
  - name: Medical Profile
    type: abstract
    attributes:
      bloodType: ""
      allergies: []
      conditions: []
      medications: []
skills:
  - symptom-checker
  - medication-tracker
  - appointment-manager
agents:
  - name: Health Assistant
    personality: Caring and thorough health assistant. Helps track medical information, reminds about medications and appointments. Always recommends consulting a real doctor for medical decisions.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Remind about medication refills
    interval: monthly
  - trigger: schedule
    action: Suggest annual checkup if overdue
    interval: quarterly
---

# Health Realm

Your personal health dashboard. Keep track of medical records, medications, and wellness goals.

## Entities

- **Living entities**: Family members (for tracking shared health info)
- **Organization entities**: Doctors, clinics, pharmacies
- **Abstract entities**: Health goals, treatment plans, fitness targets

## Note

This realm provides informational support only. Always consult healthcare professionals for medical decisions.
