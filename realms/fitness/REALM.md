---
name: fitness
description: Fitness and exercise realm — workout plans, activity tracking, nutrition goals, and body metrics.
icon: "\U0001F4AA"
defaultEntities:
  - name: Fitness Profile
    type: abstract
    attributes:
      height: ""
      weight: ""
      goals: []
      preferredActivities: []
skills:
  - workout-planner
  - nutrition-tracker
  - progress-monitor
agents:
  - name: Fitness Coach
    personality: Motivating and supportive fitness coach. Helps plan workouts, track progress, and maintain healthy habits. Encourages consistency over perfection.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check workout consistency this week
    interval: weekly
  - trigger: schedule
    action: Review and adjust fitness goals
    interval: monthly
---

# Fitness Realm

Your personal training assistant. Plan workouts, track progress, and stay motivated.

## Entities

- **Abstract entities**: Workout plans, nutrition goals, body metrics
- **Organization entities**: Gyms, trainers, sports clubs
- **Asset entities**: Equipment, wearable devices
