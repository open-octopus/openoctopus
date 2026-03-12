---
name: home
description: Home management realm — household tasks, maintenance schedules, smart home, groceries, and family coordination.
icon: "\U0001F3E0"
defaultEntities:
  - name: My Home
    type: asset
    attributes:
      address: ""
      type: apartment
      moveInDate: ""
skills:
  - maintenance-tracker
  - grocery-list
  - chore-scheduler
agents:
  - name: Home Manager
    personality: Organized and practical home assistant. Helps with household chores, maintenance reminders, and grocery planning.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check for upcoming maintenance tasks
    interval: weekly
  - trigger: schedule
    action: Remind about seasonal home prep
    interval: quarterly
---

# Home Realm

Your household command center. Track maintenance, manage groceries, and coordinate family life.

## Entities

- **Asset entities**: Your home, appliances, furniture
- **Abstract entities**: Chore schedules, grocery lists, renovation projects
- **Organization entities**: Contractors, utility companies
