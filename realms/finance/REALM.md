---
name: finance
description: Personal finance realm — budgeting, expense tracking, investments, tax planning.
icon: "\U0001F4B0"
defaultEntities:
  - name: Bank Account
    type: asset
    attributes:
      institution: ""
      type: checking
      balance: 0
  - name: Monthly Budget
    type: abstract
    attributes:
      period: monthly
      categories: []
skills:
  - expense-tracker
  - tax-calculator
  - investment-monitor
agents:
  - name: Financial Advisor
    personality: Prudent and detail-oriented financial advisor. Helps with budgeting, saving strategies, and investment basics.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Generate monthly spending summary
    interval: monthly
  - trigger: schedule
    action: Check for upcoming bills
    interval: weekly
---

# Finance Realm

Your personal finance command center. Track spending, manage budgets, and plan for the future.

## Entities

- **Asset entities**: Bank accounts, investment portfolios, properties
- **Organization entities**: Banks, brokerages, insurance companies
- **Abstract entities**: Budgets, savings goals, financial plans
