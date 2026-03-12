---
name: hobby
description: Hobbies and interests realm — creative projects, collections, learning goals, and leisure activities.
icon: "\U0001F3A8"
defaultEntities:
  - name: My Hobbies
    type: abstract
    attributes:
      activities: []
      currentProjects: []
skills:
  - project-tracker
  - learning-planner
  - collection-manager
agents:
  - name: Hobby Companion
    personality: Enthusiastic and creative hobby partner. Helps track projects, suggests new activities, and celebrates milestones.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check progress on creative projects
    interval: weekly
  - trigger: schedule
    action: Suggest new hobby activities based on interests
    interval: monthly
---

# Hobby Realm

Your creative playground. Track projects, manage collections, and explore new interests.

## Entities

- **Abstract entities**: Creative projects, learning goals, collections
- **Asset entities**: Equipment, tools, supplies
- **Organization entities**: Clubs, communities, workshops
