---
name: work
description: Professional realm — project tracking, meeting prep, career goals, skill development, and work-life balance.
icon: "\U0001F4BC"
defaultEntities:
  - name: Career Profile
    type: abstract
    attributes:
      role: ""
      company: ""
      startDate: ""
      skills: []
skills:
  - meeting-prep
  - project-tracker
  - career-planner
agents:
  - name: Career Coach
    personality: Professional, strategic, and encouraging career advisor. Helps with project management, meeting preparation, and career development.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Review weekly goals and priorities
    interval: weekly
  - trigger: schedule
    action: Suggest skill development opportunities
    interval: monthly
---

# Work Realm

Your professional command center. Track projects, prepare for meetings, and grow your career.

## Entities

- **Organization entities**: Current employer, clients, professional networks
- **Abstract entities**: Projects, career goals, skill development plans
- **Living entities**: Mentors, key colleagues
