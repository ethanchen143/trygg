HedgeAI — Full Project Context Dump
This document captures the entire context from our planning session. Use this to onboard anyone (or any AI) into the full state of the project.
THE IDEA
We're building HedgeAI for a hackathon (Programmable Capital track). One-liner: AI agent that hedges your uninsurable risks using prediction markets. Core thesis: There are billions of dollars in real-world risks that no insurance product covers — tariff changes, trade policy shifts, geopolitical events, regulatory changes, platform risk, etc. Prediction markets (Polymarket, Kalshi) already price these events. Nobody has built the bridge between "I'm a business owner worried about tariffs" and "here's a specific prediction market position that offsets your risk." We're that bridge. An AI agent takes a natural language description of your situation, identifies your risks, scans 6,000+ live prediction market contracts, and recommends a hedging portfolio with concrete dollar amounts, expected payouts, and plain-English explanations. Hackathon context: This is for the "Programmable Capital" track. The challenge says: "Build AI native financial systems. Think agents with spending authority, programmable payments, real time risk and compliance, or new rails for stable, machine driven transactions." Our project fits squarely.
HOW WE GOT HERE — IDEAS WE CONSIDERED AND REJECTED
Ideas we explored before landing on HedgeAI:
    1    Prediction-Market-Powered Trading Agent — arb between Polymarket and traditional financial instruments (e.g., Polymarket "Fed cuts rates" vs rate futures). REJECTED because: instruments don't map 1:1, execution across crypto + CME is too hard for a weekend, actual spread after fees is basis points not "5k a day," and it's not a business (no moat, alpha decays).
    2    Bloomberg Terminal for Prediction Markets — analytics/intelligence layer for prediction market data. REJECTED because Bloomberg has already integrated Polymarket and Kalshi into their terminal. The institutional analytics layer is being built by incumbents.
    3    AI-Powered Market Creation Engine (The Rumor Machine) — agent watches news feeds, auto-generates prediction market contracts with resolution criteria and initial pricing. Supply engine for Polymarket/Kalshi. We ALMOST did this. It's explicitly listed in the hackathon prompt. Very demoable. We decided the hedging/insurance angle was more novel and had a stronger VC story. This could still be a pivot if the hedging demo isn't working by Saturday night.
    4    Resolution-as-a-Service — oracle layer that determines if prediction market contracts resolved YES or NO. AI monitors data sources, evaluates criteria, flags ambiguous cases. Unsexy but real infrastructure need. REJECTED for hackathon because it's hard to demo excitingly.
    5    Internal Prediction Markets for Enterprise — auto-generate prediction markets from Jira/Linear/Salesforce, employees trade, leadership gets AI dashboard. Based on Philip Tetlock's superforecasting research (IARPA tournament showed regular people with structured forecasting beat CIA analysts with classified intel). CONSIDERED SERIOUSLY but rejected because the demo requires too much fake data scaffolding — you'd spend half the weekend building a fake company.
    6    Agent vs Agent Trading Arena — competitive arena where trading agents fight each other, users bet on which agent wins. Fantasy sports for trading algorithms. Cool demo energy but not a VC-backable business.
    7    Natural Language Backtesting Engine — describe strategies in English, LLM converts to code, backtests, returns P&L. Removes the coding barrier to algorithmic trading. Realistic product but less novel.
    8    Bet on Yourself — app where you stake money on personal goals, friends can bet against you, AI sets dynamic odds. We researched the space: StickK, Beeminder, AccountabiliBuddy, StepBet exist but none have adversarial social betting + AI-powered odds + real market mechanism. White space exists but team wasn't excited about consumer social for this hackathon.
    9    Prediction Market Liquidity Aggregator — routing layer across Polymarket, Kalshi, etc. Like 1inch for prediction markets. Good business but too infrastructure-y for a hackathon demo.
    10    Conditional Prediction Markets for Policy Simulation — "What will inflation be IF tariffs increase by 10%?" For think tanks and government agencies. Interesting but niche.
    11    Event-Driven Structured Products — turn prediction market positions into consumer-facing financial products ("deposit $100, get $150 if Fed cuts rates"). Cool but regulatory nightmare.

BEACHHEAD MARKET DECISION
We debated four verticals:
    •    SMB importers/exporters (tariff risk) — CHOSEN. Most timely, tariffs are front-page news, every judge/VC already understands the problem.
    •    Crypto-native users — easiest to build for but "crypto tools for crypto people" is circular and small story.
    •    Freelancers & creators — biggest TAM but prediction market contracts don't map cleanly to individual freelancer risks.
    •    Real estate investors — highest willingness to pay but niche audience. However: the team hasn't fully committed to importers. The engine is vertical-agnostic. The prompts and demo personas are the only things that change. The core pipeline works for anyone. We may broaden during the pitch — "we're starting with importers because tariffs are the most urgent uninsured risk right now, but the platform works for any event risk."

TECHNICAL ARCHITECTURE
The 5-Step Pipeline
Step 1: INPUT — User describes their business/situation
Step 2: RISK EXTRACTION — LLM identifies and ranks risks with $ exposures  
Step 3: MARKET DISCOVERY — Search Polymarket + Kalshi for relevant contracts
Step 4: ANALYSIS — LLM matches risks to contracts + quantitative analysis
Step 5: PORTFOLIO — Scoring function allocates budget, sizes positions, generates explanations
Team Split (4 people)
Person 1 — Market Data + Quantitative Analysis
    •    Files: backend/market_data.py
    •    Owns: Steps 3 + quantitative half of Step 4
    •    Polymarket Gamma API (no auth needed) + Kalshi public API (no auth needed)
    •    Keyword search → upgrade to semantic search with embeddings (highest leverage upgrade)
    •    Quantitative stats: price, volume, 24h trend, liquidity depth Person 2 — Risk Agent (LLM Brain)
    •    Files: backend/risk_agent.py
    •    Owns: Step 2 + matching half of Step 4
    •    THE MOST CRITICAL PERSON. Demo quality lives and dies on prompt quality.
    •    Risk extraction prompt: business description → ranked RiskFactors with $ exposures
    •    Contract matching prompt: risks + contract list → HedgeRecommendations with side selection
    •    Explanation generation: plain-English 2-3 sentence explanation per hedge
    •    Stretch: web sentiment analysis for each risk Person 3 — API Orchestration + Sizing Engine
    •    Files: backend/api.py, backend/sizing.py
    •    Owns: Step 1 (backend), Step 5, wiring everything together
    •    FastAPI server, single POST /analyze endpoint
    •    Scoring function: score = correlation × cost_efficiency × probability × liquidity
    •    Budget allocation proportional to scores
    •    Position sizing math Person 4 — Frontend + Demo UX
    •    Files: frontend/src/App.jsx, frontend/src/App.css
    •    Owns: Step 1 (frontend) and output dashboard
    •    React + Vite, dark terminal aesthetic
    •    Risk intake form, hedge cards, portfolio summary
    •    Demo persona buttons for pre-tested inputs
Tech Stack
    •    Backend: Python, FastAPI, httpx, anthropic/openai SDK
    •    Frontend: React, Vite, Tailwind (or plain CSS)
    •    Data: Polymarket Gamma API, Kalshi REST API (both free, no auth for reads)
    •    LLM: Claude Sonnet or GPT-4o
    •    Search: OpenAI embeddings (or keyword fallback)
    •    No database — in-memory cache, refresh every 5 min
Key Interfaces (JSON contracts between modules)
MarketContract:
source, id, title, description, category, yes_price (0-1), no_price (0-1), volume, end_date, url
RiskFactor:
event, description, exposure_amount, exposure_direction, timeframe, confidence, risk_category
HedgeRecommendation:
risk (RiskFactor), contract_id, contract_title, contract_source, side (YES/NO), current_price, reasoning, correlation_strength
API Response (POST /analyze):
risks[], positions[], total_cost, total_max_profit, avg_coverage, followup_questions[], unhedgeable_risks[]

PORTFOLIO CONSTRUCTION LOGIC — THE DEEP STUFF
Basic Sizing Math
For a YES contract priced at $0.35:
- Cost per share: $0.35
- Payout per share if YES: $1.00
- Profit per share: $0.65
- ROI if event happens: 186%
- To cover $50k exposure: 50000 / 0.65 = 76,923 shares = $26,923 cost
- If budget capped at $5k: buy 14,286 shares, payout $14,286, coverage 18.6%
Scoring Function (drives allocation)
score = correlation × cost_efficiency × probability × liquidity
Where:
- correlation: strong=1.0, moderate=0.6, weak=0.3 (from LLM matching)
- cost_efficiency: (1 - price) / price  (ROI if event happens)
- probability: contract price (higher prob = more urgent to hedge)  
- liquidity: min(volume / 100000, 1.0)
Critical Insight: Optimize for Payout Asymmetry, Not Just Correlation
The naive approach is "find the most correlated contract and buy it." The smart approach is "find the contract where the market is underpricing the tail risk that would actually destroy this business." A contract at 8 cents with moderate correlation is a WAY better hedge than a contract at 70 cents with strong correlation, because you get 12:1 leverage instead of 1.4:1. Principle: prefer cheap contracts with asymmetric payouts over expensive contracts with high correlation. Weight payout ratio heavily in the scoring function.
Duration Matching
Always prefer longer-dated contracts when hedging ongoing business risk. Short-dated contracts (expiring in <30 days) are for traders, not insurance buyers. The agent should penalize contracts expiring within 30 days unless the user's risk is specifically near-term. A March 31 contract is useless for a business worried about the next 6-12 months. Even if the bad event doesn't happen by March 31, it could happen in April and they're unprotected.
Liquidity Warnings
Many of the best long-dated tail risk contracts have very low liquidity ($3K-$10K volume). At $1,000-2,000 positions, you might be 10-20% of the entire market's volume. The agent MUST warn about this: "these positions may experience slippage on entry and may be difficult to exit before expiry."
FEW-SHOT EXPERT REASONING EXAMPLES
Example 1: Electronics Importer (Tariff Risk)
Persona: Small business importing electronic components from Shenzhen, China. $3.2M revenue, 12% margins, 80% from China. Budget: $10k. Contracts considered (from live Polymarket data, March 14 2026):
    1    "U.S. tariff rate on China on March 31?" — 5-15% at 77%, 15-25% at 11%, $241K vol
    •    SELECTED: Buy YES on 15-25% bracket at $0.11. Direct tariff hedge. Cheap entry, huge payout if tariffs spike. Best risk/reward in the set.
    2    "Will a 10% US blanket tariff be in effect on March 31?" — 94% YES, $54K vol
    •    REJECTED: Already almost certain. Buying YES at 94 cents = almost no upside. Useless as a hedge.
    3    "Will the Court Force Trump to Refund Tariffs?" — 32% YES, $287K vol
    •    SELECTED (secondary): If courts intervene on tariffs, signals policy chaos. Most liquid contract. Moderate correlation.
    4    "100% tariff on Canada in effect by June 30?" — 8% YES, $34K vol
    •    SELECTED (canary): If Canada gets hit with 100%, signals aggressive trade posture, China tariffs likely next. Very cheap proxy hedge.
    5    "Will Trump visit China by April 30?" — 88% YES
    •    SELECTED INVERSE: Buy NO. If Trump doesn't visit = continued tensions = tariff risk elevated. NO at 12 cents is cheap with 8:1 payout. Portfolio: | Contract | Side | Price | Alloc | Return if hit | |---|---|---|---|---| | China tariff 15-25% | YES | $0.11 | $4,000 | 9:1 | | Court forces tariff refund | YES | $0.32 | $2,500 | 3:1 | | Trump visits China by Mar 31 | NO | $0.32 | $2,000 | 3:1 | | Canada 100% tariff by June | YES | $0.08 | $1,500 | 12:1 | Self-critique: March 31 contracts expire in 17 days — terrible for ongoing business risk. Should look for longer-dated tariff contracts. Also: the tariff rate contract resolves to a range (5-15%), not a specific number, so the hedge might not perfectly match the actual tariff increase.

Example 2: Middle East Shipping Company (Iran/Geopolitical Risk)
Persona: Freight forwarding business in Houston. $4.5M revenue, 18% margins. Specializes in shipping industrial equipment to UAE, Saudi, Qatar, Oman. 30% of cargo transits near Strait of Hormuz. Two oil field service clients in the Gulf. Exposure: $600K if conflict escalates, $1.2M if Hormuz disrupted. Budget: $10k. Full Iran contract menu from Polymarket (March 14, 2026): Long-dated (6-12 months):
    •    Iran closes Strait of Hormuz before 2027 — 19% YES, $10K vol, $7K liq
    •    US invades Iran before 2027 — 13% YES, $3K vol, $9K liq
    •    Iranian regime fall before 2027 — 23% YES, $337K vol, $83K liq
    •    Khamenei out by Dec 31, 2026 — 43% YES, $164K vol, $79K liq
    •    Iran nuke before 2027 — 14% YES, $3K vol, $6K liq
    •    Iran nuclear test before 2027 — 18% YES, $2K vol, $4K liq Medium-dated (3-6 months):
    •    Khamenei out by June 30 — 28% YES, $809K vol, $122K liq
    •    Israel x Iran ceasefire broken by June 30 — 49% YES, $4M vol, $81K liq
    •    US strikes Iran by June 30 — 41% YES, $529K vol
    •    Iranian regime fall by June 30 — 17% YES, $76K vol Short-dated (SKIP for hedging):
    •    Everything March 31 — expires in 17 days, useless for insurance Also relevant:
    •    Crude oil hits $120 by end March — 50% YES, $3M vol (short-dated but liquid)
    •    US x Iran ceasefire by Mar 31 — 14% YES, $8.4M vol (short-dated)
    •    US x Iran ceasefire by Apr 30 — 36% YES, $2.4M vol
    •    US forces enter Iran by Mar 31 — 42% YES, $8.7M vol (short-dated) Expert reasoning on key contracts: "Iran closes Strait of Hormuz before 2027" at 19 cents — THIS IS THE DIRECT RISK. If Hormuz closes, 30% of this company's cargo routes are dead. At 19 cents that's a 5:1 payout. Way better than the invasion contract at 42 cents. This was missed in the first portfolio pass because it has low volume — the agent needs to scan the FULL contract list, not just top results by volume. "US invades Iran before 2027" at 13 cents — Full invasion = Hormuz guaranteed disrupted. Cheapest tail hedge at 7.7:1 return. But $3K volume means terrible liquidity. Small position only. "Iranian regime fall before 2027" at 23 cents — Regime collapse = maximum chaos, shipping frozen indefinitely. 4.3x return. Decent liquidity at $337K volume. "Khamenei out by June 30" at 28 cents — Best liquidity in the medium-dated tier ($809K). Leadership change = instability = bad for shipping. 3.6x return. "Israel x Iran ceasefire broken by June 30" at 49 cents — If ceasefire breaks, re-escalation begins. Most liquid Iran contract at $4M. But only 2x return, expensive. "Crude oil hits $120" at 50 cents — Only 2x return, expires end of March. Liquid proxy for Gulf disruption but short-dated and expensive. Weak hedge. FIRST PASS portfolio (bad — what the naive agent would do): Focused on high-volume, high-liquidity contracts. Lots of 40-70 cent positions. Max payout: $19,792 (2x return). Mediocre. SECOND PASS portfolio (good — optimized for asymmetry + duration): | Contract | Expiry | Price | Alloc | Shares | Payout | Return | |---|---|---|---|---|---|---| | Iran closes Hormuz before 2027 | Dec 2026 | $0.19 | $2,000 | 10,526 | $10,526 | 5.3x | | Iranian regime fall before 2027 | Dec 2026 | $0.23 | $2,000 | 8,696 | $8,696 | 4.3x | | Khamenei out by June 30 | June 2026 | $0.28 | $2,000 | 7,143 | $7,143 | 3.6x | | Israel x Iran ceasefire broken June | June 2026 | $0.49 | $2,000 | 4,082 | $4,082 | 2.0x | | US invades Iran before 2027 | Dec 2026 | $0.13 | $1,000 | 7,692 | $7,692 | 7.7x | | Iran nuclear test before 2027 | Dec 2026 | $0.18 | $1,000 | 5,556 | $5,556 | 5.6x | Total cost: $10,000. Max payout: $43,695 (4.4x). All 3-12 month duration. Evaluator critique: "Three positions have under $10K liquidity. Your entry may move the market. Flag slippage risk." Also: "No oil contract included — oil is the most liquid proxy for Gulf disruption." Also: "Duration is good but regime fall and Khamenei contracts are partially redundant — if the regime falls, Khamenei is obviously out."

THE RECURSIVE AGENT ARCHITECTURE
We want to implement a few-shot agent with an evaluation loop:
Step 1: Agent generates initial hedge portfolio (using few-shot examples above)
Step 2: Reasoning/evaluator model critiques it:
        - "Is directionality right on each position?"
        - "Are there better contracts you missed?"
        - "Is allocation sensible given exposure sizes?"
        - "What's the basis risk on each hedge?"
        - "Is duration matched to the user's risk horizon?"
        - "Are you over-concentrated in correlated positions?"
        - "Liquidity warnings?"
Step 3: Feed critique back to the agent
Step 4: Agent revises portfolio
Step 5: Evaluator checks again
Step 6: If good enough, output final portfolio. If not, loop.
This is basically constitutional AI / self-critique applied to financial reasoning. Very impressive in a demo because you can show the iteration — "here's V1, here's what the evaluator caught, here's V2."
LIVE MARKET DATA (verified working March 14, 2026)
    •    Polymarket Gamma API: https://gamma-api.polymarket.com/events?active=true&closed=false — NO AUTH NEEDED. Returns ~5,000+ contracts.
    •    Kalshi public API: https://api.elections.kalshi.com/trade-api/v2/markets?status=open — NO AUTH NEEDED. Returns ~1,000+ contracts. Rate limited (got 429 after 5 pages).
    •    Total contracts available: ~6,000+
    •    Both APIs return: title, description, outcomes, prices (implied probabilities), volume, end dates.
    •    Polymarket uses events → markets nesting. Each event has one or more binary markets. Prices are 0-1 floats.
    •    Kalshi uses series → events → markets. Prices are in cents (divide by 100).

DEMO PLAN
Personas (all tested against live data):
    1    Electronics Importer — Shenzhen → Midwest, $3.2M rev, 12% margins, 80% from China, terrified of 60% tariffs
    2    Auto Parts Distributor — Mexico + China → Texas, $8M rev, 15% margins, fixed-price contracts getting crushed
    3    Textile Importer — Bangladesh/Vietnam/India, $5M rev, 8-10% margins, transshipment tariff risk
    4    Specialty Food Importer — EU products, $1.5M rev, 25% margins, retaliatory tariff exposure
The 3-Minute Pitch:
    1    Hook (15s): "300,000 US businesses import from China. Tariff policy changed 3 times this month. None of them could hedge it."
    2    Problem (30s): Traditional insurance covers fire and flood, not trade policy. Show the gap.
    3    Demo (90s): Type in scenario, watch agent extract risks, match contracts, build portfolio.
    4    How (30s): "Prediction markets already price these events. We're the AI layer that makes them accessible."
    5    Business (15s): Transaction fees + SaaS. TAM = parametric insurance ($15B+).
Why Now:
    •    Tariffs are front-page news (timely)
    •    Prediction markets hit mainstream liquidity (Polymarket did $529M on Iran alone)
    •    LLMs are finally good enough to bridge business language → financial instruments
    •    Kalshi is now CFTC-regulated (legitimacy)
Business Model:
    •    Transaction fee: 1-2% on hedge positions executed through platform
    •    Subscription: $50-200/month for ongoing monitoring, rebalancing, alerts
    •    Data/API: aggregate hedging demand data is valuable to prediction markets, policy analysts, macro funds
Key Objections and Answers:
    •    "Isn't this just gambling?" → We're a recommendation/execution layer on top of regulated markets (Kalshi is CFTC-regulated). We're not the counterparty.
    •    "Prediction markets are thin" → Growing fast. Polymarket did billions in 2024-2025. We're building for where the market is going.
    •    "Basis risk?" → We're transparent about it. Dashboard shows correlation strength and coverage ratios. Partial coverage > zero coverage.
    •    "Why not just save the money?" → Known small cost ($10k premium) vs unknown catastrophic loss ($600k). Same logic as all insurance.
    •    "Competitors?" → Traditional parametric insurance (Arbol, Descartes) covers narrow standardized risks. Nobody uses prediction markets as pricing layer + AI for distribution.

CODEBASE STATUS
We have a working starter codebase with:
    •    backend/market_data.py — Polymarket + Kalshi ingestion, TESTED AND WORKING, loads 6,000+ contracts
    •    backend/risk_agent.py — LLM risk extraction + matching, import/export focused prompts, 4 demo personas
    •    backend/sizing.py — Position sizing math, portfolio construction
    •    backend/api.py — FastAPI server, single POST /analyze endpoint orchestrates everything
    •    frontend/src/App.jsx — React dashboard with intake form, demo persona buttons, hedge cards
    •    frontend/src/App.css — Dark terminal aesthetic
    •    TEAM_BRIEF.md — Full team brief with assignments, interfaces, timeline, pitch script All packaged in hedgeai.tar.gz ready to distribute to the team.

WHAT STILL NEEDS TO BE BUILT / DECIDED
    1    Semantic search — current keyword search is weak. "Government shutdown" returns garbage. Embeddings would fix this. Person 1's Day 2 priority.
    2    Few-shot prompts — the two expert reasoning examples (tariff + Iran) need to be encoded into the actual system prompts. This will dramatically improve the agent's output quality.
    3    Recursive evaluation loop — agent generates portfolio → evaluator model critiques → agent revises. Not yet implemented. Would be the most technically impressive part of the demo.
    4    Payout asymmetry scoring — current scoring function doesn't weight payout ratio heavily enough. Needs to prefer cheap tail risk contracts over expensive obvious ones.
    5    Duration matching — agent should penalize short-dated contracts when hedging ongoing risk. Not yet in the scoring function.
    6    Liquidity warnings — agent should flag when a position would be a significant % of the market's total volume.
    7    Web sentiment analysis — stretch goal. For each risk, search web for recent news, summarize whether market price seems high/low relative to news flow.
    8    Final vertical decision — team needs to commit: pure importers, or broader "anyone with event risk"? Affects demo personas and pitch framing.
lets work on the frontend bro, lets try to build that out
i created an empty folder for you, go ham
so yeah, use like react, vite, stuff like that you know