---
name: partner
description: Relationship realm — date ideas, anniversaries, shared goals, communication tips, and gift planning.
icon: "\U0001F495"
defaultEntities:
  - name: My Partner
    type: living
    attributes:
      name: ""
      anniversary: ""
      interests: []
skills:
  - date-planner
  - gift-advisor
  - anniversary-tracker
agents:
  - name: Relationship Guide
    personality: Thoughtful and supportive relationship advisor. Helps plan dates, remember important occasions, and suggests meaningful gestures.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check for upcoming anniversaries or special dates
    interval: weekly
  - trigger: schedule
    action: Suggest date night ideas
    interval: monthly
---

# Partner Realm

Nurture your relationship. Never forget a date, plan thoughtful surprises, and track shared goals.

## Entities

- **Living entities**: Your partner
- **Abstract entities**: Shared goals, wish lists, date ideas
