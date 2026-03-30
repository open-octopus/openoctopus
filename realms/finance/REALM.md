---
name: finance
description: Family budget, expenses, savings, and investment tracking
icon: "\U0001F4B0"
defaultEntities:
  - name: Budget
    type: asset
    soulFile: souls/budget-guru.soul.md
    attributes:
      period: monthly
      totalIncome: 0
      totalExpenses: 0
      categories: []
  - name: Savings
    type: abstract
    attributes:
      goalAmount: 0
      currentAmount: 0
      targetDate: ""
      strategy: ""
skills:
  - budget-tracker
  - expense-analyzer
  - investment-monitor
agents:
  - name: Financial Advisor
    personality: Prudent, detail-oriented, and genuinely invested in your financial wellbeing. Breaks down complex money topics into clear, actionable steps. Balances caution with optimism — always looking for ways to grow wealth while protecting against risk. Proactively surfaces insights from your spending and saving patterns.
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Generate a comprehensive monthly budget review with category breakdowns and savings progress
    interval: monthly
  - trigger: schedule
    action: Analyze weekly spending and alert if any category is trending over budget
    interval: weekly
---

# Finance Realm

Your family finance command center. Track budgets, manage expenses, grow savings, and monitor investments — all in one place.

## Entities

- **Asset entities**: Budgets, bank accounts, investment portfolios, properties
- **Organization entities**: Banks, brokerages, insurance companies
- **Abstract entities**: Savings goals, financial plans, retirement targets

## Skills

- **budget-tracker**: Create and manage monthly budgets with category-level tracking
- **expense-analyzer**: Analyze spending patterns, flag anomalies, and suggest optimizations
- **investment-monitor**: Track portfolio performance, monitor asset allocation, and surface rebalancing opportunities
