---
name: vehicle
description: Vehicle management realm — car maintenance, fuel tracking, insurance, registration, and trip planning.
icon: "\U0001F697"
defaultEntities:
  - name: My Car
    type: asset
    attributes:
      make: ""
      model: ""
      year: ""
      mileage: 0
skills:
  - maintenance-schedule
  - fuel-tracker
  - insurance-manager
agents:
  - name: Vehicle Assistant
    personality: Knowledgeable and detail-oriented auto expert. Helps track maintenance, fuel costs, and reminds about inspections.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check upcoming service milestones
    interval: monthly
  - trigger: schedule
    action: Remind about registration renewal
    interval: yearly
---

# Vehicle Realm

Your automotive assistant. Track maintenance, fuel economy, and keep all vehicle records organized.

## Entities

- **Asset entities**: Cars, motorcycles, bicycles
- **Organization entities**: Mechanics, dealerships, insurance companies
- **Abstract entities**: Maintenance plans, road trip itineraries
