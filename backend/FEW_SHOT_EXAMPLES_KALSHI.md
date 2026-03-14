# HedgeAI — Few-Shot Expert Reasoning Examples (Kalshi Markets Only)

These examples capture the full reasoning process of a human expert constructing hedge portfolios on Kalshi (CFTC-regulated, legal for US users). Feed these into the agent's system prompt as few-shot examples so it learns to reason like a human analyst, not just do keyword matching.

IMPORTANT CONTEXT FOR THE AGENT: These examples were constructed on March 14, 2026. Many Kalshi markets in the economic/geopolitical category currently have low volume and liquidity (often $0 reported). This is a known limitation. The agent should:
1. Still recommend positions based on the contract's relevance and price
2. Always flag liquidity concerns when volume/liquidity is low
3. Suggest the user place limit orders rather than market orders on thin markets
4. Consider that Kalshi liquidity reporting via API may undercount actual book depth (check the Kalshi UI for real-time orderbook)

---

## EXAMPLE 1: Electronics Component Importer — Tariff Risk

### User Input
"I run a small business importing electronic components from Shenzhen, China and selling to PCB manufacturers in the Midwest. Annual revenue is about $3.2M with 12% margins (~$384K annual profit). About 80% of our inventory comes from China ($2.56M in imports), with the rest from Taiwan and Vietnam. I'm terrified of new tariffs — the current ones already eat into our margins, and if they go to 60% like some politicians are proposing, we're done. We also have about $400K in inventory in transit at any given time. Our customers are starting to ask for price locks which we can't give them because we don't know what tariffs will look like next quarter. Budget: $10,000."

### Risk Extraction
| Risk | Category | Exposure | Timeframe | Confidence |
|------|----------|----------|-----------|------------|
| US tariffs on Chinese electronics increase to 25%+ | tariff | $640,000 (25% of $2.56M import value) | 3-12 months | high |
| US tariffs on Chinese goods increase to 60% | tariff | $1,536,000 (60% of import value, exceeds total profit) | 6-18 months | medium |
| Broad US tariff revenue surge indicating aggressive trade posture | trade_policy | $300,000 (indirect — signals sustained tariff environment) | 12 months | medium |
| US-China trade deal collapses / no free trade agreement | trade_policy | $200,000 (prolonged uncertainty kills customer orders) | 12-36 months | medium |
| Recession reduces customer demand for electronics manufacturing | macro | $480,000 (15% revenue decline) | 6-12 months | medium |
| Inflation spike increases operating costs alongside tariffs | macro | $160,000 (5% cost increase across operations) | 6-12 months | low |
| Commerce Secretary turnover signals trade policy instability | regulatory | $100,000 (indirect — policy chaos) | 3-9 months | low |

### Available Kalshi Contracts (filtered for relevance, 3-12 month window)

**Direct tariff contracts:**
- KXTARIFFREVENUE-26DEC31-T250: "US tariff revenue 2026 above $250B?" — YES $0.39, closes Jun 2027
- KXTARIFFREVENUE-26DEC31-T200: "US tariff revenue 2026 above $200B?" — YES $0.63, closes Jun 2027
- KXTARIFFREVENUE-26DEC31-T150: "US tariff revenue 2026 above $150B?" — YES $0.80, closes Jun 2027

**Trade policy contracts:**
- KXFTAPRC-29: "Trump free trade agreement with China before Jan 2029?" — YES $0.41, closes Jan 2029
- KXFTA-29: "Trump free trade agreement with any country before Jan 2029?" — YES $0.60, closes Jan 2029
- KXTRADEDEFICIT-27FEB28-T170: "US trade deficit 2026 above $170B?" — YES $0.96, closes Feb 2027

**Macro contracts:**
- KXRECSSNBER-26: "Recession in 2026?" — YES $0.35, closes Jan 2027
- KXGDP-26APR30-T1.0: "Real GDP increase >1.0% Q1 2026?" — YES $0.84, closes Apr 2026
- KXGDP-26APR30-T2.0: "Real GDP increase >2.0% Q1 2026?" — YES $0.66, closes Apr 2026
- KXGDPYEAR-26-T0.1: "GDP growth 2026 above 0.1%?" — YES $0.08, closes Feb 2027 (near-zero growth)
- KXLCPIMAXYOY-27-P5: "Inflation hits 5%+ in 2026?" — YES $0.18, closes Feb 2027
- KXLCPIMAXYOY-27-P4: "Inflation hits 4%+ in 2026?" — YES $0.35, closes Feb 2027

**Political/regulatory:**
- KXLUTNICKOUT-26SEP01: "Lutnick out as Commerce Secretary before Sep?" — YES $0.29, closes Sep 2026
- KXDEFGDP-26OCT20-T5: "Federal deficit-to-GDP below 5% FY2026?" — YES $0.18, closes Oct 2026

### Expert Reasoning

**Step 1 — Identify the primary hedge.**
The user's biggest risk is tariff escalation on Chinese goods. The most direct Kalshi contract is tariff revenue. If US tariff revenue exceeds $250B in 2026, that means tariffs are significantly higher than historical norms (2024 tariff revenue was ~$80B). A jump to $250B+ almost certainly means China tariffs have increased substantially.

KXTARIFFREVENUE-26DEC31-T250 at $0.39 is the primary hedge. Buy YES. If tariff revenue surges past $250B, this business is getting crushed by higher import costs — but the prediction market payout offsets some of that pain. Payout ratio: $1.00/$0.39 = 2.56x. Duration: resolves Jun 2027 (covers full year of 2026 data). Correlation: STRONG — tariff revenue directly reflects the tariff environment this business operates in.

**Step 2 — Consider what the $250B threshold actually means.**
The market prices $250B+ at only 39%. The $200B+ threshold is at 63%. This tells me the market thinks there's a ~24% chance tariff revenue lands between $200B-$250B, and a 39% chance it goes above $250B. For my business, even $200B of tariff revenue would be painful. Should I also buy the $200B threshold?

At $0.63, the $200B contract only pays 1.59x. That's poor cost efficiency. The $250B contract at $0.39 gives much better leverage. I'll concentrate on $250B and accept that I'm unhedged in the $150B-$250B range.

**Step 3 — Add the trade policy layer.**
KXFTAPRC-29 at $0.41: "Will Trump make a free trade agreement with China?" Buy NO at $0.59. If no deal happens (which means the current tariff regime persists or worsens), I get paid $1.00 per share. Payout ratio: 1.69x. Duration: closes Jan 2029 — very long-dated, which is good for this business's ongoing risk. Correlation: MODERATE — no deal doesn't guarantee tariff increases, but it confirms the hostile trade environment continues.

Wait — $0.59 for NO is expensive. Let me reconsider. Actually, the value here is the DURATION. This contract runs through Jan 2029. That's 3 years of ongoing hedge coverage for a single position. Even at 1.69x, the annualized cost of this hedge is quite low. Include it.

**Step 4 — Add the macro tail risk hedge.**
KXRECSSNBER-26 at $0.35: "Recession in 2026?" Buy YES. If recession hits, this importer loses on two fronts: their customers cut orders AND the recession likely correlates with trade policy disruption (tariffs often increase during economic nationalism periods). Payout ratio: 2.86x. Duration: resolves Jan 2027. Correlation: MODERATE — recession hurts this business through demand channel, not directly through tariffs.

**Step 5 — Consider the inflation hedge.**
KXLCPIMAXYOY-27-P5 at $0.18: "Inflation hits 5%+ in 2026?" Buy YES. If inflation spikes above 5%, this business faces higher operating costs AND tariffs are likely a contributing factor (tariffs are inflationary). At $0.18, this is a cheap tail risk position — 5.56x payout. Correlation: MODERATE — inflation spike is partially caused by tariffs, so this is a downstream signal of the same risk.

**Step 6 — Consider the Commerce Secretary contract.**
KXLUTNICKOUT-26SEP01 at $0.29: If Lutnick leaves as Commerce Secretary, trade policy becomes even more unpredictable. Buy YES as a chaos hedge? At 3.45x payout, it's decent. But the correlation is WEAK — a new Commerce Secretary could be more or less hawkish on tariffs. Skip this. Not worth the allocation when I have better direct hedges.

**Step 7 — Construct the portfolio.**


| Contract | Side | Price | Allocation | Shares | Payout if hit | Return | Duration |
|----------|------|-------|------------|--------|---------------|--------|----------|
| Tariff revenue >$250B | YES | $0.39 | $3,500 | 8,974 | $8,974 | 2.56x | Jun 2027 |
| No China free trade deal | NO | $0.59 | $2,500 | 4,237 | $4,237 | 1.69x | Jan 2029 |
| Recession in 2026 | YES | $0.35 | $2,000 | 5,714 | $5,714 | 2.86x | Jan 2027 |
| Inflation >5% in 2026 | YES | $0.18 | $1,000 | 5,556 | $5,556 | 5.56x | Feb 2027 |
| Inflation >4% in 2026 | YES | $0.35 | $1,000 | 2,857 | $2,857 | 2.86x | Feb 2027 |

Total cost: $10,000
Max payout (tariff surge + recession + inflation spike + no China deal): $27,338 (2.73x)
Most likely partial payout: tariff revenue contract alone = $8,974
Worst case (tariffs stay low, economy fine, China deal happens): lose $10,000 premium
All positions: 9-36 month duration

### Self-Critique (Evaluator Model Would Flag)
1. "Liquidity concern: all these Kalshi markets show $0 volume/liquidity via API. Actual orderbook depth may differ — check Kalshi UI. Recommend limit orders only."
2. "The tariff revenue contract is an indirect proxy. It measures total US tariff revenue, not specifically China tariffs. Revenue could hit $250B from tariffs on other countries while China tariffs stay flat. Basis risk exists."
3. "No China-specific tariff rate contract exists on Kalshi. This is a gap. The closest proxy is tariff revenue, which is imperfect."
4. "The trade deal NO position at $0.59 is expensive for a 1.69x return. But the 3-year duration justifies the cost — it's effectively $0.20/year of coverage."
5. "Consider adding: KXGDP Q1 contracts. If Q1 GDP comes in weak, that's an early signal of tariff-driven economic damage. KXGDP-26APR30-T2.0 at YES $0.66 would pay if GDP stays above 2% (not useful). Buy NO on KXGDP-26APR30-T2.5 — if GDP drops below 2.5%, signals economic weakness consistent with tariff damage."

---

## EXAMPLE 2: Gulf Region Shipping Company — Iran/Geopolitical + Oil Risk

### User Input
"I run a freight forwarding business based in Houston specializing in shipping industrial equipment to UAE, Saudi Arabia, Qatar, and Oman. $4.5M annual revenue, 18% margins (~$810K annual profit). About 30% of our cargo transits through or near the Strait of Hormuz. We have contracts with two oil field service companies operating in the Gulf — together worth about $800K/year. Since the US-Iran strikes in February, our shipping insurance premiums have doubled and two clients have frozen new orders pending 'security assessment.' If conflict escalates further: estimated $600K exposure. If Hormuz is disrupted: $1.2M+ exposure (routes shut down, insurance becomes prohibitive, clients pull out). Budget: $15,000."

### Risk Extraction
| Risk | Category | Exposure | Timeframe | Confidence |
|------|----------|----------|-----------|------------|
| US-Iran conflict escalation (further strikes, ground invasion) | geopolitical | $600,000 | 3-12 months | high |
| Strait of Hormuz disruption/closure | geopolitical | $1,200,000 | 3-18 months | high |
| Oil price spike above $120 (correlates with Gulf disruption) | commodity | $400,000 (clients slow orders, costs spike) | 3-6 months | medium |
| Recession reduces demand for Gulf industrial equipment | macro | $450,000 (10% revenue drop) | 6-12 months | medium |
| Iran becomes democratic / regime change chaos | geopolitical | $300,000 (transition chaos disrupts regional stability) | 6-18 months | low |
| US sanctions tighten, freezing business with Iranian-adjacent partners | regulatory | $200,000 | 3-12 months | medium |

### Available Kalshi Contracts

**Iran/geopolitical:**
- KXIRANDEMOCRACY-27MAR01-T6: "Iran Democracy Index score ≥6 in 2026?" — YES $0.13, closes Mar 2027
- KXIRANIMPORTS-27FEB01-T5000000: "US imports from Iran >$5M in 2026?" — YES $0.25, closes Feb 2027

**Macro/economic:**
- KXRECSSNBER-26: "Recession in 2026?" — YES $0.35, closes Jan 2027
- KXGDP-26APR30-T2.0: "Real GDP >2.0% Q1 2026?" — YES $0.66, closes Apr 2026
- KXLCPIMAXYOY-27-P5: "Inflation >5% in 2026?" — YES $0.18, closes Feb 2027

**Oil:**
- KXWTI-26MAR17-T99.99: "WTI oil >$100 on Mar 17?" — YES $0.96, closes Mar 17 (TOO SHORT)
- KXWTI-26MAR17-T105.99: "WTI oil >$106 on Mar 17?" — YES $0.97, closes Mar 17 (TOO SHORT)
- KXOILRIGS-26-*: Oil rig count contracts — mostly priced at $0.99 (useless for hedging)

**Trade/tariff (secondary relevance):**
- KXTARIFFREVENUE-26DEC31-T250: "Tariff revenue >$250B?" — YES $0.39, closes Jun 2027
- KXDEFGDP-26OCT20-T5: "Deficit-to-GDP below 5%?" — YES $0.18, closes Oct 2026

**Political:**
- KXLUTNICKOUT-26SEP01: "Lutnick out before Sep?" — YES $0.29, closes Sep 2026

### Expert Reasoning

**Step 1 — Acknowledge the problem.**
Kalshi has very limited Iran-specific contracts compared to Polymarket. The two Iran contracts available are:
- Iran Democracy Index ≥6: This is actually interesting. A democracy score of 6 means a "flawed democracy" — a massive shift from Iran's current ~1.4 score. This would only happen through regime change or revolution. At $0.13 (7.7x payout), it's a cheap bet on maximum chaos. If Iran undergoes democratic transition, the regional instability during that transition period would be devastating for Gulf shipping. Correlation: MODERATE-STRONG for the chaos scenario.
- US imports from Iran >$5M: This is an INVERSE signal. If the US starts importing from Iran again, it means sanctions are relaxed, which means de-escalation. That's GOOD for this business. So I'd buy NO — betting that imports stay below $5M (sanctions remain tight, conflict continues). NO at $0.75 gives only 1.33x return. Not great, but it's direct duration coverage through Feb 2027.

**Step 2 — The oil problem.**
Kalshi's WTI oil contracts are all short-dated (Mar 17, 2026 — 3 days away). Completely useless for hedging. There are no longer-dated oil price contracts on Kalshi that I can find. This is a major gap. The agent should flag this: "No medium or long-dated oil price contracts available on Kalshi. If oil exposure is critical, consider Polymarket's crude oil contracts as a supplement (note: Polymarket is not regulated in the US)."

**Step 3 — Build with what we have.**
Since Iran-specific and oil contracts are limited, I need to use macro proxies.

Recession (KXRECSSNBER-26 at $0.35): If recession hits, Gulf capex drops, this business's clients reduce equipment orders. Also, recession + Middle East conflict = compounding pain. Buy YES. 2.86x return. MODERATE correlation.

Inflation >5% (KXLCPIMAXYOY-27-P5 at $0.18): Oil price spikes drive inflation. If inflation hits 5%+, it's likely because energy prices are elevated, which correlates with Gulf disruption. Buy YES. 5.56x return. MODERATE correlation — inflation is a downstream signal of the oil/conflict scenario.

Tariff revenue >$250B (KXTARIFFREVENUE-26DEC31-T250 at $0.39): Why tariff revenue for a shipping company? Because if tariff revenue surges, it means the US is in aggressive protectionist mode, which correlates with broader geopolitical confrontation including in the Middle East. Tariff wars and military conflicts often coincide. WEAK correlation, but the contract is well-priced and liquid-ish. Small position.

Federal deficit >5% GDP (KXDEFGDP-26OCT20-T5 — NO at $0.82): If deficit exceeds 5% of GDP, it signals massive government spending, likely including military spending on the Iran conflict. Buy NO (deficit WILL exceed 5%). 1.22x return. WEAK correlation but adds diversification.

**Step 4 — Portfolio construction.**

| Contract | Side | Price | Allocation | Shares | Payout | Return | Duration | Correlation |
|----------|------|-------|------------|--------|--------|--------|----------|-------------|
| Iran Democracy ≥6 in 2026 | YES | $0.13 | $3,000 (20%) | 23,077 | $23,077 | 7.69x | Mar 2027 | MODERATE |
| US imports from Iran <$5M | NO | $0.75 | $2,500 (17%) | 3,333 | $3,333 | 1.33x | Feb 2027 | MODERATE |
| Recession in 2026 | YES | $0.35 | $3,000 (20%) | 8,571 | $8,571 | 2.86x | Jan 2027 | MODERATE |
| Inflation >5% 2026 | YES | $0.18 | $2,500 (17%) | 13,889 | $13,889 | 5.56x | Feb 2027 | MODERATE |
| Inflation >4% 2026 | YES | $0.35 | $2,000 (13%) | 5,714 | $5,714 | 2.86x | Feb 2027 | MODERATE |
| Tariff revenue >$250B | YES | $0.39 | $2,000 (13%) | 5,128 | $5,128 | 2.56x | Jun 2027 | WEAK |

Total cost: $15,000
Max payout (regime change + sanctions hold + recession + inflation spike + tariff surge): $59,712 (3.98x)
Most likely partial payout: recession + inflation contracts = $14,285
Worst case: lose $15,000 premium
All positions: 9-15 month duration

### Self-Critique
1. "CRITICAL GAP: No direct Iran conflict escalation contract on Kalshi. No Hormuz closure contract. No oil price contracts beyond 3 days out. The user's PRIMARY risk ($1.2M Hormuz exposure) is not directly hedgeable on Kalshi. All positions are proxies. The agent MUST disclose this clearly."
2. "The Iran Democracy contract at $0.13 is the best risk/reward but has essentially zero liquidity. The user may not be able to fill 23,077 shares at this price. Recommend entering with small limit orders over multiple days."
3. "Portfolio is over-indexed on macro proxies (recession, inflation) because direct geopolitical contracts are unavailable. If the Iran conflict resolves quickly but a recession still hits, the user gets paid on the macro hedges but their Gulf business is actually fine — over-hedging scenario."
4. "Missing: Fed rate contracts. If Iran conflict + recession hits, the Fed likely cuts rates aggressively. KXFED contracts for late 2026 / early 2027 could add another hedge dimension — buy YES on 'rates above 4%' (betting rates DON'T get cut, which would mean economy is stronger than expected and no need for the hedge... wait, that's wrong). Actually: buy NO on 'rates above 3.5%' — betting that rates WILL be cut below 3.5%, which signals economic distress. Need to think through this more carefully."

---

## EXAMPLE 3: US Restaurant Chain Sourcing from Mexico/Europe — Inflation + Recession + Trade Policy

### User Input
"I own a chain of 6 upscale restaurants in the NYC metro area. Total revenue around $9M, margins around 10% (~$900K profit). About 40% of our food costs come from imports — beef from Argentina, seafood from Norway and Chile, specialty produce from Mexico, wine and cheese from France/Italy. Our food cost is about $3M/year, so imported ingredients are about $1.2M. If tariffs hit food imports, our costs spike and we can't easily raise menu prices without losing customers. We're also worried about a recession killing the high-end dining market — our customers are the first to cut back on $200 dinners. Inflation is already squeezing us. And the EU trade situation worries me — retaliatory tariffs on US goods could trigger EU counter-tariffs on our imports. Budget: $12,000."

### Risk Extraction
| Risk | Category | Exposure | Timeframe | Confidence |
|------|----------|----------|-----------|------------|
| Tariffs on food imports from Mexico/EU/South America | tariff | $360,000 (30% cost increase on $1.2M imports) | 3-12 months | high |
| Recession kills high-end dining demand | macro | $1,350,000 (15% revenue drop) | 6-18 months | high |
| Inflation above 4% continues squeezing margins | macro | $270,000 (3% additional cost pressure) | 6-12 months | high |
| EU retaliatory tariffs disrupt wine/cheese supply chain | trade_policy | $180,000 (specific to European imports) | 6-12 months | medium |
| US tariff revenue surge indicates broad protectionism | trade_policy | $200,000 (signals sustained hostile trade environment) | 12 months | medium |
| GDP contraction reduces consumer spending on dining | macro | $900,000 (10% revenue drop in contraction) | 6-12 months | medium |

### Available Kalshi Contracts

**Macro (these are the strongest hedges for this persona):**
- KXRECSSNBER-26: "Recession in 2026?" — YES $0.35, closes Jan 2027
- KXGDP-26APR30-T2.5: "Real GDP >2.5% Q1 2026?" — YES $0.54, closes Apr 2026
- KXGDP-26APR30-T2.0: "Real GDP >2.0% Q1 2026?" — YES $0.66, closes Apr 2026
- KXGDP-26APR30-T1.5: "Real GDP >1.5% Q1 2026?" — YES $0.72, closes Apr 2026
- KXGDPYEAR-26-T0.1: "GDP growth 2026 >0.1%?" — YES $0.08, closes Feb 2027

**Inflation:**
- KXLCPIMAXYOY-27-P5: "Inflation >5% 2026?" — YES $0.18, closes Feb 2027
- KXLCPIMAXYOY-27-P4.5: "Inflation >4.5% 2026?" — YES $0.26, closes Feb 2027
- KXLCPIMAXYOY-27-P4: "Inflation >4% 2026?" — YES $0.35, closes Feb 2027
- KXLCPIMAXYOY-27-P3.5: "Inflation >3.5% 2026?" — YES $0.61, closes Feb 2027
- KXCPI-26MAR-T0.8: "CPI rise >0.8% in March 2026?" — YES $0.35, closes Apr 2026
- KXCPI-26NOV-T0.3: "CPI rise >0.3% in Nov 2026?" — YES $0.42, closes Dec 2026

**Tariff/trade:**
- KXTARIFFREVENUE-26DEC31-T250: "Tariff revenue >$250B?" — YES $0.39, closes Jun 2027
- KXTARIFFREVENUE-26DEC31-T200: "Tariff revenue >$200B?" — YES $0.63, closes Jun 2027
- KXFTAPRC-29: "Trump-China free trade deal?" — YES $0.41, closes Jan 2029
- KXFTA-29: "Trump free trade deal (any country)?" — YES $0.60, closes Jan 2029
- KXTRADEDEFICIT-27FEB28-T170: "Trade deficit >$170B?" — YES $0.96, closes Feb 2027

**Fed rate (relevant because rate changes affect consumer spending):**
- KXFED-27JAN-T3.00: "Fed rate >3.00% after Jan 2027?" — YES $0.52, closes Jan 2027
- KXFED-27JAN-T3.50: "Fed rate >3.50% after Jan 2027?" — YES $0.26, closes Jan 2027
- KXFED-27JAN-T4.00: "Fed rate >4.00% after Jan 2027?" — YES $0.12, closes Jan 2027

### Expert Reasoning

**Step 1 — Identify the dominant risk.**
This business has THREE compounding risks: tariffs, recession, and inflation. They all hit simultaneously and reinforce each other — tariffs cause inflation, inflation kills consumer spending, consumer spending collapse causes recession, recession kills the restaurant business. This is a correlated risk cluster, which means the downside scenario is really bad but also means multiple contracts pay out at once in that scenario.

**Step 2 — Recession is the existential risk.**
For a high-end restaurant chain, recession is the #1 killer. A 15% revenue drop on 10% margins means they're losing money. Recession should get the largest allocation.

KXRECSSNBER-26 at $0.35: Direct recession hedge. 2.86x return. Closes Jan 2027. STRONG correlation — if NBER calls a recession, high-end dining is guaranteed to suffer.

But I also want a MORE GRANULAR GDP hedge. The recession contract is binary — either NBER declares one or not. GDP contracts let me hedge the severity.

KXGDP-26APR30-T2.0 — buy NO at $0.34: If Q1 GDP growth falls below 2%, I get paid. This is an early warning signal. 2.94x return. Closes Apr 2026 (very near-term but gives early signal).

KXGDPYEAR-26-T0.1 — buy NO at $0.92: If annual GDP growth drops below 0.1% (near-zero or negative). Very expensive at $0.92 — only 1.09x. Skip. Not worth it.

**Step 3 — Inflation is the margin killer.**
KXLCPIMAXYOY-27-P4 at $0.35: "Inflation hits 4%+ in 2026?" This is the sweet spot. 4% inflation would be painful for this restaurant chain — food costs spike, labor costs spike, but they can't raise prices because customers are already feeling the pinch. 2.86x return. Closes Feb 2027. STRONG correlation.

KXLCPIMAXYOY-27-P5 at $0.18: The tail risk version. 5%+ inflation would be devastating. At $0.18, it's cheap. 5.56x return. MODERATE-STRONG correlation. Include as a smaller position.

**Step 4 — Tariff layer.**
KXTARIFFREVENUE-26DEC31-T250 at $0.39: Tariff revenue exceeding $250B means aggressive protectionism is hitting food imports. This is the best tariff proxy available on Kalshi. 2.56x return. MODERATE correlation — tariff revenue is broad, not specific to food imports.

No EU-specific tariff contracts exist on Kalshi. This is a gap. The agent should note: "No contract available for EU retaliatory tariffs specifically. Tariff revenue is a broad proxy."

**Step 5 — Fed rate as consumer spending signal.**
KXFED-27JAN-T4.00 at $0.12: "Fed rate still above 4% in Jan 2027?" Buy YES. If rates are STILL above 4% in Jan 2027, it means the Fed hasn't cut aggressively, which means either inflation is persistent (bad for this business) or the economy hasn't weakened enough for emergency cuts (mixed signal). At $0.12, this is a cheap position. 8.33x return. But the correlation is COMPLEX — high rates are bad for consumer spending (good hedge), but high rates also mean the Fed doesn't think recession is imminent (bad hedge). Correlation: WEAK-MODERATE. Small position only.

Actually, let me rethink. If I'm hedging against recession, I should buy NO on high rates — betting that the Fed WILL cut. If they cut to 3% or below, it means the economy is in trouble, which aligns with my recession exposure. But NO on KXFED-27JAN-T3.00 is $0.48. That's expensive at 2.08x. And it overlaps with the recession contract. Skip the Fed contracts — they're redundant with the recession bet.

**Step 6 — Final portfolio.**

| Contract | Side | Price | Allocation | Shares | Payout | Return | Duration | Correlation |
|----------|------|-------|------------|--------|--------|--------|----------|-------------|
| Recession in 2026 | YES | $0.35 | $3,500 (29%) | 10,000 | $10,000 | 2.86x | Jan 2027 | STRONG |
| Q1 GDP <2.0% | NO on T2.0 | $0.34 | $2,000 (17%) | 5,882 | $5,882 | 2.94x | Apr 2026 | STRONG |
| Inflation >4% 2026 | YES | $0.35 | $2,500 (21%) | 7,143 | $7,143 | 2.86x | Feb 2027 | STRONG |
| Inflation >5% 2026 | YES | $0.18 | $1,500 (13%) | 8,333 | $8,333 | 5.56x | Feb 2027 | MODERATE |
| Tariff revenue >$250B | YES | $0.39 | $2,000 (17%) | 5,128 | $5,128 | 2.56x | Jun 2027 | MODERATE |
| CPI >0.8% March 2026 | YES | $0.35 | $500 (4%) | 1,429 | $1,429 | 2.86x | Apr 2026 | MODERATE |

Total cost: $12,000
Max payout (recession + inflation spike + tariff surge): $37,915 (3.16x)
Most likely partial payout: recession + 4% inflation = $17,143
Worst case: economy fine, inflation moderate, tariffs stable — lose $12,000 premium
Duration: 1-15 months, weighted toward 9-12 month contracts

### Self-Critique
1. "Strong portfolio for macro risk. The recession + inflation + tariff combination captures the correlated risk cluster well."
2. "GDP Q1 contract closes in April 2026 — very near-term. Good as an early signal but only provides 6 weeks of coverage. The recession contract provides the longer-term coverage."
3. "No food-specific or EU-specific tariff contracts exist on Kalshi. The tariff revenue contract is a broad proxy. If the user's main concern is specifically French wine tariffs, this hedge may not correlate well."
4. "The CPI March contract ($500 allocation) is a small near-term position. Consider dropping it and reallocating to the recession or inflation contracts for cleaner portfolio."
5. "Liquidity warning: all Kalshi economic contracts currently show low reported volume. Place limit orders. The recession contract (KXRECSSNBER-26) is likely the most liquid based on topic relevance."
6. "Missing consideration: the user has 6 restaurant locations. If recession + inflation hit, some locations may need to close. The hedge payout ($38K max) covers only ~4% of their total exposure ($1.35M recession risk). The user should understand this is partial protection, not full insurance."

---

## INSTRUCTIONS FOR THE RECURSIVE AGENT

When generating a hedge portfolio, follow this reasoning chain:

1. **Extract risks** — identify all risks from the user's description. Assign dollar exposures, categories, timeframes, and confidence levels. Think about second-order and correlated risks.

2. **Search contracts** — for each risk, generate multiple search queries (direct terms + synonyms + proxy terms). Scan the full Kalshi catalog. Don't just match the obvious keyword.

3. **Evaluate each contract** by asking:
   - Is this a DIRECT hedge (contract resolves on the exact event) or a PROXY hedge (contract correlates with the event)?
   - Which SIDE should I buy? Think carefully about directionality. If the bad event happening = I need money, which side pays out when the bad event happens?
   - What's the PAYOUT RATIO? Prefer cheap contracts with high asymmetry (5x+) over expensive contracts with low asymmetry (<2x). A $0.15 contract that pays 6.7x is almost always better than a $0.70 contract that pays 1.4x.
   - What's the DURATION? Match to the user's risk horizon. Penalize contracts expiring in <30 days for ongoing business risks. Prefer 6-12 month duration.
   - What's the LIQUIDITY? Flag contracts with very low volume/open interest. Recommend limit orders.
   - What's the CORRELATION STRENGTH? Be honest: strong, moderate, or weak.

4. **Construct portfolio** — allocate budget using the scoring function:
   ```
   score = correlation × payout_ratio × urgency × liquidity
   allocation = (score / total_scores) × budget
   ```
   Where payout_ratio = (1 - price) / price, and urgency = how likely the event is AND how near-term the risk is.

5. **Self-critique** — before presenting, ask:
   - Are any positions redundant (paying on the same underlying event)?
   - Are there obvious gaps (major risks with no hedge)?
   - Is duration matched to risk horizon?
   - Are liquidity warnings needed?
   - What's the realistic coverage ratio (max payout / total exposure)?
   - Would a human expert add or remove anything?

6. **Revise** based on critique, then present the final portfolio with full transparency about limitations.
