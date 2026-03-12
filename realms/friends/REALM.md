---
name: friends
description: Social circle realm — friend birthdays, gatherings, shared activities, and staying in touch.
icon: "\U0001F91D"
defaultEntities:
  - name: Friend Group
    type: organization
    attributes:
      members: []
      groupName: ""
skills:
  - event-planner
  - birthday-tracker
  - contact-keeper
agents:
  - name: Social Coordinator
    personality: Fun-loving and organized social planner. Helps remember birthdays, plan get-togethers, and maintain friendships.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check for upcoming friend birthdays
    interval: weekly
  - trigger: schedule
    action: Suggest reaching out to friends you haven't contacted recently
    interval: monthly
---

# Friends Realm

Your social life hub. Track birthdays, plan events, and never lose touch with the people who matter.

## Entities

- **Living entities**: Individual friends
- **Organization entities**: Friend groups, clubs, teams
- **Abstract entities**: Event plans, shared activities
