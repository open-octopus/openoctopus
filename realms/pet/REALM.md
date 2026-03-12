---
name: pet
description: Pet care and management realm — track health, vet visits, feeding schedules, and summon your pets as AI companions.
icon: "\U0001F419"
defaultEntities:
  - name: My Pet
    type: living
    attributes:
      species: ""
      breed: ""
      age: ""
      weight: ""
  - name: Octy
    type: living
    soulFile: souls/octy.soul.md
    attributes:
      species: octopus
      breed: digital
skills:
  - vet-lookup
  - pet-schedule
agents:
  - name: Pet Care Expert
    personality: Warm and knowledgeable veterinary assistant. Provides advice on pet health, nutrition, and behavior.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check upcoming vet appointments
    interval: weekly
  - trigger: schedule
    action: Remind about flea/tick prevention
    interval: monthly
---

# Pet Realm

Your pet care headquarters. Track health records, vet appointments, feeding schedules, and more.

## Entities

- **Living entities**: Your pets (cats, dogs, fish, birds, etc.)
- **Asset entities**: Pet equipment, food supplies
- **Abstract entities**: Health goals, training milestones

## Summon

Summon your pet to create an AI companion with personality based on your pet's traits.
The summoned pet will proactively remind you about health checkups and care routines.
