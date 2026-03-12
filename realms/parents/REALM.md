---
name: parents
description: Family elder care realm — health tracking, appointments, medication management, and staying connected with parents.
icon: "\U0001F46A"
defaultEntities:
  - name: Dad
    type: living
    attributes:
      relationship: father
      birthday: ""
  - name: Mom
    type: living
    attributes:
      relationship: mother
      birthday: ""
skills:
  - health-monitor
  - medication-reminder
  - call-scheduler
agents:
  - name: Family Care Advisor
    personality: Warm, empathetic, and thorough family care assistant. Helps manage parent health info, appointments, and encourages regular check-ins.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Suggest calling parents
    interval: weekly
  - trigger: schedule
    action: Review parent health check-ups
    interval: monthly
---

# Parents Realm

Stay connected and caring. Track health info, medication schedules, and never miss important dates.

## Entities

- **Living entities**: Parents, grandparents, in-laws
- **Organization entities**: Doctors, pharmacies, care facilities
- **Abstract entities**: Care plans, health goals
