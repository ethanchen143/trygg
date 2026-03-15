"""
Quantitative portfolio optimization engine for prediction market hedges.

Takes the LLM's candidate contracts and produces an optimized portfolio using:
- Kelly Criterion for position sizing
- Mean-variance optimization for binary payouts (scipy)
- Correlation-adjusted diversification
- Monte Carlo simulation (10k runs) for payout distribution
"""

import logging
import numpy as np
from scipy.optimize import minimize

logger = logging.getLogger("hedgeai.quant")

# --- Constants ---

CORRELATION_MAP = {"STRONG": 0.8, "MODERATE": 0.5, "WEAK": 0.2}
DEFAULT_BUDGET = 10_000
MIN_POSITION_PCT = 0.05   # minimum 5% of budget per position
MAX_POSITION_PCT = 0.50   # maximum 50% of budget per position — allow conviction bets
MC_SIMULATIONS = 10_000


def _to_float(val, default=0.0) -> float:
    """Safely convert any value (including numpy types) to native Python float."""
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _parse_price(contract: dict) -> float:
    """Extract the contract price, clamped to [0.01, 0.99]."""
    price = _to_float(contract.get("current_price"), 0.5)
    return max(0.01, min(0.99, price))


def _parse_correlation(contract: dict) -> float:
    raw = contract.get("correlation", "MODERATE")
    if isinstance(raw, (int, float)):
        return max(0.0, min(1.0, float(raw)))
    return CORRELATION_MAP.get(str(raw).upper(), 0.5)


def _parse_confidence(contract: dict) -> float:
    return max(0.1, min(1.0, _to_float(contract.get("confidence"), 0.5)))


# --- Kelly Criterion ---

def kelly_fraction(price: float, estimated_prob: float) -> float:
    """
    Kelly criterion for a binary bet.
    f* = (p * b - q) / b
    where b = net odds = (1/price - 1), p = estimated probability, q = 1 - p.
    """
    if price <= 0 or price >= 1:
        return 0.0
    b = (1.0 / price) - 1.0  # net odds received
    if b <= 0:
        return 0.0
    q = 1.0 - estimated_prob
    f = (estimated_prob * b - q) / b
    return max(0.0, min(1.0, f))


# --- Correlation Matrix ---

def build_correlation_matrix(contracts: list[dict]) -> np.ndarray:
    """
    Build an approximate correlation matrix from LLM correlation ratings.
    Contracts hedging the same risk cluster get higher cross-correlation.
    """
    n = len(contracts)
    corr = np.eye(n)

    for i in range(n):
        for j in range(i + 1, n):
            ci = _parse_correlation(contracts[i])
            cj = _parse_correlation(contracts[j])
            cross = ci * cj
            corr[i, j] = cross
            corr[j, i] = cross

    return corr


# --- Mean-Variance Optimization ---

def optimize_allocation(
    contracts: list[dict],
    budget: float = DEFAULT_BUDGET,
) -> list[float]:
    """
    Optimize portfolio weights to maximize risk-adjusted expected return.
    Returns plain Python list of floats (weights summing to 1.0).
    """
    n = len(contracts)
    if n == 0:
        return []
    if n == 1:
        return [1.0]

    prices = np.array([_parse_price(c) for c in contracts])
    confidences = np.array([_parse_confidence(c) for c in contracts])

    # Estimated true probability: blend market price with LLM confidence
    # Higher confidence → agent thinks event is more likely than market implies
    # 0.5 multiplier = aggressive: trust the LLM's edge estimate more
    est_probs = np.clip(prices + confidences * (1 - prices) * 0.5, 0.01, 0.99)

    # Expected return per dollar invested: E[payout]/cost - 1
    expected_returns = est_probs / prices - 1.0

    # Variance per dollar invested (binary payout)
    variances = est_probs * (1 - est_probs) / (prices ** 2)

    # Covariance matrix
    corr_matrix = build_correlation_matrix(contracts)
    std_devs = np.sqrt(variances)
    cov_matrix = np.outer(std_devs, std_devs) * corr_matrix

    # Kelly fractions as initial guess + fallback
    kelly_fracs = np.array([
        kelly_fraction(float(prices[i]), float(est_probs[i])) for i in range(n)
    ])
    kelly_fracs = np.clip(kelly_fracs, MIN_POSITION_PCT, MAX_POSITION_PCT)
    if kelly_fracs.sum() > 0:
        kelly_fracs = kelly_fracs / kelly_fracs.sum()
    else:
        kelly_fracs = np.ones(n) / n

    # Objective: maximize (expected_return - lambda * variance) → minimize negative
    # Lower = more aggressive (favors high-return contracts over stability)
    risk_aversion = 0.2

    def neg_utility(weights):
        port_return = weights @ expected_returns
        port_var = weights @ cov_matrix @ weights
        return -(port_return - risk_aversion * port_var)

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
    bounds = [(MIN_POSITION_PCT, MAX_POSITION_PCT)] * n

    try:
        result = minimize(
            neg_utility,
            kelly_fracs,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"maxiter": 200},
        )
        weights = result.x if result.success else kelly_fracs
    except Exception as e:
        logger.warning(f"Optimizer failed, using Kelly fallback: {e}")
        weights = kelly_fracs

    # Normalize
    weights = np.clip(weights, MIN_POSITION_PCT, MAX_POSITION_PCT)
    weights = weights / weights.sum()

    # Convert to native Python floats
    return [float(w) for w in weights]


# --- Monte Carlo Simulation ---

def run_monte_carlo(
    contracts: list[dict],
    allocations: list[float],
) -> dict:
    """
    Simulate portfolio outcomes. Each contract is binary: pays $1/share or $0.
    Returns distribution statistics as native Python types.
    """
    n = len(contracts)
    if n == 0:
        return _empty_simulation()

    prices = [_parse_price(c) for c in contracts]
    total_cost = sum(allocations)
    if total_cost <= 0:
        return _empty_simulation()

    # Simulate
    rng = np.random.default_rng(42)
    payouts = np.zeros(MC_SIMULATIONS)

    for i in range(n):
        price = prices[i]
        alloc = allocations[i]
        shares = alloc / price if price > 0 else 0
        # Each contract resolves YES with probability = market price
        outcomes = rng.random(MC_SIMULATIONS) < price
        payouts += outcomes * shares  # $1 per share if YES

    profits = payouts - total_cost

    return {
        "total_cost": float(round(total_cost, 2)),
        "p10": float(round(float(np.percentile(profits, 10)), 2)),
        "p25": float(round(float(np.percentile(profits, 25)), 2)),
        "p50": float(round(float(np.percentile(profits, 50)), 2)),
        "p75": float(round(float(np.percentile(profits, 75)), 2)),
        "p90": float(round(float(np.percentile(profits, 90)), 2)),
        "mean": float(round(float(np.mean(profits)), 2)),
        "max": float(round(float(np.max(profits)), 2)),
        "prob_profit": float(round(float(np.mean(profits > 0)) * 100, 1)),
        "expected_payout": float(round(float(np.mean(payouts)), 2)),
        "histogram": _build_histogram(profits),
    }


def _empty_simulation() -> dict:
    return {
        "total_cost": 0, "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0,
        "mean": 0, "max": 0, "prob_profit": 0, "expected_payout": 0, "histogram": [],
    }


def _build_histogram(profits: np.ndarray, bins: int = 20) -> list[dict]:
    """Build histogram data for the frontend payout distribution chart."""
    counts, edges = np.histogram(profits, bins=bins)
    total = len(profits)
    return [
        {
            "min": float(round(float(edges[i]), 0)),
            "max": float(round(float(edges[i + 1]), 0)),
            "count": int(counts[i]),
            "pct": float(round(float(counts[i] / total * 100), 1)),
        }
        for i in range(len(counts))
    ]


# --- Risk Metrics ---

def compute_risk_metrics(
    contracts: list[dict],
    allocations: list[float],
    budget: float,
    total_exposure: float = 0,
) -> dict:
    """Compute portfolio-level risk metrics. All values are native Python types."""
    n = len(contracts)
    total_cost = sum(allocations)

    prices = [_parse_price(c) for c in contracts]
    confidences = [_parse_confidence(c) for c in contracts]

    max_payout = sum(alloc / price for alloc, price in zip(allocations, prices) if price > 0)

    # Expected value using confidence-adjusted probability (not market price)
    # If we just use market price, EV is always 0 by definition
    # The LLM's confidence rating implies the event is more likely than market thinks
    expected_value = 0.0
    for i in range(n):
        price = prices[i]
        conf = confidences[i]
        alloc = allocations[i]
        if price <= 0:
            continue
        shares = alloc / price
        # Estimated true probability (same formula as optimizer)
        est_prob = min(0.99, price + conf * (1 - price) * 0.5)
        expected_value += est_prob * shares - alloc  # E[payout] - cost

    # Coverage ratio
    coverage_ratio = max_payout / total_cost if total_cost > 0 else 0

    # Diversification score (1 - Herfindahl)
    if total_cost > 0 and n > 0:
        weights = [alloc / total_cost for alloc in allocations]
        herfindahl = sum(w ** 2 for w in weights)
        diversification = 1.0 - herfindahl
    else:
        diversification = 0.0

    budget_util = total_cost / budget if budget > 0 else 0

    return {
        "total_cost": float(round(total_cost, 2)),
        "max_payout": float(round(max_payout, 2)),
        "expected_value": float(round(expected_value, 2)),
        "coverage_ratio": float(round(coverage_ratio, 2)),
        "diversification_score": float(round(diversification, 3)),
        "budget_utilization": float(round(budget_util * 100, 1)),
        "num_positions": n,
        "exposure_coverage_pct": float(round(max_payout / total_exposure * 100, 1)) if total_exposure > 0 else None,
    }


# --- Main Entry Point ---

def optimize_portfolio(
    candidates: list[dict],
    budget: float = DEFAULT_BUDGET,
    total_exposure: float = 0,
) -> dict:
    """
    Main entry point. Takes LLM candidate contracts, returns optimized portfolio.
    All output values are native Python types (no numpy).
    """
    if not candidates:
        return {
            "positions": [],
            "portfolio_metrics": compute_risk_metrics([], [], budget, total_exposure),
            "simulation": _empty_simulation(),
        }

    logger.info(f"Optimizing portfolio: {len(candidates)} candidates, ${budget} budget")

    # Step 1: Optimize weights (returns plain Python floats)
    weights = optimize_allocation(candidates, budget)
    logger.info(f"Optimized weights: {weights}")

    # Step 2: Convert weights to dollar allocations
    allocations = [round(w * budget, 2) for w in weights]
    logger.info(f"Allocations: {allocations}")

    # Step 3: Run Monte Carlo
    simulation = run_monte_carlo(candidates, allocations)

    # Step 4: Compute risk metrics
    metrics = compute_risk_metrics(candidates, allocations, budget, total_exposure)

    # Step 5: Build enriched positions
    positions = []
    for i, contract in enumerate(candidates):
        price = _parse_price(contract)
        conf = _parse_confidence(contract)
        alloc = allocations[i]
        shares = alloc / price if price > 0 else 0.0
        payout = shares  # $1 per share
        est_prob = min(0.99, price + conf * (1 - price) * 0.5)
        kelly_f = kelly_fraction(price, est_prob)
        ev = est_prob * shares - alloc

        positions.append({
            **contract,
            "allocation": float(round(alloc, 2)),
            "shares": float(round(shares, 0)),
            "max_payout": float(round(payout, 2)),
            "return_multiple": float(round(payout / alloc, 2)) if alloc > 0 else 0.0,
            "portfolio_weight_pct": float(round(weights[i] * 100, 1)),
            "kelly_fraction": float(round(kelly_f, 4)),
            "expected_value": float(round(ev, 2)),
        })

    logger.info(f"Portfolio: cost=${metrics['total_cost']}, max_payout=${metrics['max_payout']}, "
                f"EV=${metrics['expected_value']}, diversification={metrics['diversification_score']}")

    return {
        "positions": positions,
        "portfolio_metrics": metrics,
        "simulation": simulation,
    }
