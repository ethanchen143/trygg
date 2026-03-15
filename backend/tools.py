import json
import os
import re
import time
import httpx

# Simple in-memory cache (5 min TTL)
_cache: dict = {}
CACHE_TTL = 300


async def _fetch_cached(key: str, url: str, params: dict) -> list | dict:
    if key in _cache and time.time() - _cache[key]["ts"] < CACHE_TTL:
        return _cache[key]["data"]
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    _cache[key] = {"data": data, "ts": time.time()}
    return data


STOP_WORDS = {
    "a", "an", "the", "is", "are", "in", "on", "at", "to", "for", "of",
    "by", "with", "and", "or", "us", "u.s.", "will", "be", "any", "this",
    "that", "it", "my", "i", "we", "our", "do", "does", "if", "what",
    "how", "when", "where", "which", "who", "from", "about", "into",
}


def _keyword_match(text: str, query: str) -> float:
    """Score how well text matches query. Returns 0-1."""
    text_lower = text.lower()
    keywords = [kw for kw in query.lower().split() if kw not in STOP_WORDS and len(kw) > 1]
    if not keywords:
        return 0.0
    matches = sum(1 for kw in keywords if kw in text_lower)
    return matches / len(keywords)


# --- Polymarket ---
# Known useful tag slugs for financial/geopolitical hedging
POLYMARKET_TAG_MAP = {
    "tariff": "tariffs", "tariffs": "tariffs", "trade": "trade-war",
    "trade war": "trade-war", "china": "china", "iran": "iran",
    "inflation": "inflation", "recession": "economics",
    "fed": "fed-rates", "rates": "fed-rates", "gdp": "gdp",
    "economy": "economy", "oil": "economics", "geopolitics": "geopolitics",
    "taiwan": "taiwan", "war": "geopolitics", "sanctions": "geopolitics",
    "nuclear": "nuclear",
}


async def _fetch_polymarket_all() -> list[dict]:
    """Fetch all active Polymarket events (paginated)."""
    cache_key = "polymarket_all"
    if cache_key in _cache and time.time() - _cache[cache_key]["ts"] < CACHE_TTL:
        return _cache[cache_key]["data"]

    all_events = []
    offset = 0
    limit = 500
    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            resp = await client.get(
                "https://gamma-api.polymarket.com/events",
                params={"active": "true", "closed": "false", "limit": limit, "offset": offset},
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            all_events.extend(batch)
            if len(batch) < limit:
                break
            offset += limit

    _cache[cache_key] = {"data": all_events, "ts": time.time()}
    return all_events


async def _fetch_polymarket_by_tag(tag_slug: str) -> list[dict]:
    """Fetch Polymarket events filtered by tag slug."""
    return await _fetch_cached(
        f"polymarket_tag_{tag_slug}",
        "https://gamma-api.polymarket.com/events",
        {"active": "true", "closed": "false", "limit": 100, "tag_slug": tag_slug},
    )


def _parse_polymarket_event(event: dict) -> list[dict]:
    """Extract market contracts from a Polymarket event."""
    results = []
    for market in event.get("markets", [event]):
        prices = market.get("outcomePrices", "[]")
        if isinstance(prices, str):
            try:
                prices = json.loads(prices)
            except Exception:
                prices = []
        yes_price = float(prices[0]) if prices else None
        no_price = float(prices[1]) if len(prices) > 1 else None
        results.append({
            "source": "polymarket",
            "title": market.get("question") or event.get("title", ""),
            "description": (market.get("description") or "")[:300],
            "yes_price": yes_price,
            "no_price": no_price,
            "volume": market.get("volume"),
            "end_date": market.get("endDate"),
            "url": f"https://polymarket.com/event/{event.get('slug', '')}",
        })
    return results


async def search_polymarket(query: str) -> list[dict]:
    """Search Polymarket using tag-based filtering + keyword matching."""
    results = []
    seen_titles = set()

    # Step 1: Try tag-based search for high-quality results
    query_lower = query.lower()
    matched_tags = set()
    for keyword, tag_slug in POLYMARKET_TAG_MAP.items():
        if keyword in query_lower:
            matched_tags.add(tag_slug)

    for tag_slug in matched_tags:
        events = await _fetch_polymarket_by_tag(tag_slug)
        for event in events:
            for contract in _parse_polymarket_event(event):
                if contract["title"] not in seen_titles:
                    seen_titles.add(contract["title"])
                    results.append(contract)

    # Step 2: Also keyword-search the full event list
    all_events = await _fetch_polymarket_all()
    scored = []
    for event in all_events:
        text = f"{event.get('title', '')} {event.get('description', '')}"
        score = _keyword_match(text, query)
        if score >= 0.5:
            scored.append((score, event))

    scored.sort(key=lambda x: -x[0])
    for _, event in scored[:20]:
        for contract in _parse_polymarket_event(event):
            if contract["title"] not in seen_titles:
                seen_titles.add(contract["title"])
                results.append(contract)

    return results[:25]


# --- Kalshi ---

async def _fetch_kalshi_events() -> list[dict]:
    """Fetch all open Kalshi events (paginated)."""
    cache_key = "kalshi_events"
    if cache_key in _cache and time.time() - _cache[cache_key]["ts"] < CACHE_TTL:
        return _cache[cache_key]["data"]

    all_events = []
    cursor = None
    async with httpx.AsyncClient(timeout=30.0) as client:
        for _ in range(5):  # max 5 pages to avoid rate limits
            params = {"status": "open", "limit": 200}
            if cursor:
                params["cursor"] = cursor
            resp = await client.get(
                "https://api.elections.kalshi.com/trade-api/v2/events",
                params=params,
            )
            if resp.status_code == 429:
                break
            resp.raise_for_status()
            data = resp.json()
            batch = data.get("events", [])
            all_events.extend(batch)
            cursor = data.get("cursor")
            if not cursor or not batch:
                break

    _cache[cache_key] = {"data": all_events, "ts": time.time()}
    return all_events


async def _fetch_kalshi_markets_for_event(event_ticker: str) -> list[dict]:
    """Fetch markets for a specific Kalshi event."""
    cache_key = f"kalshi_event_{event_ticker}"
    if cache_key in _cache and time.time() - _cache[cache_key]["ts"] < CACHE_TTL:
        return _cache[cache_key]["data"]
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.elections.kalshi.com/trade-api/v2/markets",
                params={"event_ticker": event_ticker, "limit": 50},
            )
            if resp.status_code == 429:
                return []
            resp.raise_for_status()
            data = resp.json()
        _cache[cache_key] = {"data": data, "ts": time.time()}
        return data
    except Exception:
        return []


async def search_kalshi(query: str) -> list[dict]:
    """Search Kalshi events, then fetch markets for matching events."""
    events = await _fetch_kalshi_events()

    # Score events by keyword match
    scored = []
    for event in events:
        text = f"{event.get('title', '')} {event.get('sub_title', '')} {event.get('category', '')}"
        score = _keyword_match(text, query)
        if score >= 0.4:
            scored.append((score, event))

    scored.sort(key=lambda x: -x[0])

    results = []
    for _, event in scored[:10]:
        raw = await _fetch_kalshi_markets_for_event(event["event_ticker"])
        markets = raw if isinstance(raw, list) else raw.get("markets", [])
        for m in markets:
            yes_price = float(m.get("yes_bid_dollars") or m.get("last_price_dollars") or 0)
            no_price = round(1 - yes_price, 2) if yes_price else 0
            results.append({
                "source": "kalshi",
                "title": m.get("title", ""),
                "ticker": m.get("ticker"),
                "yes_price": round(yes_price, 2),
                "no_price": no_price,
                "volume": m.get("volume_fp") or m.get("volume"),
                "end_date": m.get("close_time") or m.get("expiration_time"),
                "url": f"https://kalshi.com/markets/{m.get('ticker', '')}",
            })

    return results[:20]


# --- Web search ---

async def web_search(query: str) -> str:
    """Search DuckDuckGo for current info. Returns top results as text."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            resp.raise_for_status()
            html = resp.text

        snippets = re.findall(
            r'<a rel="nofollow" class="result__a" href="[^"]*">(.+?)</a>.*?'
            r'<a class="result__snippet"[^>]*>(.+?)</a>',
            html, re.DOTALL,
        )
        if not snippets:
            snippets_raw = re.findall(r'class="result__snippet"[^>]*>(.+?)</a>', html, re.DOTALL)
            text = "\n".join(re.sub(r"<[^>]+>", "", s).strip() for s in snippets_raw[:5])
            return text or f"No results found for: {query}"

        lines = []
        for title, snippet in snippets[:5]:
            title_clean = re.sub(r"<[^>]+>", "", title).strip()
            snippet_clean = re.sub(r"<[^>]+>", "", snippet).strip()
            lines.append(f"- {title_clean}: {snippet_clean}")
        return "\n".join(lines)
    except Exception:
        return f"Web search failed for: {query}"


# --- Crustdata Company Intelligence ---

CRUSTDATA_API_URL = "https://api.crustdata.com"
CRUSTDATA_TOKEN = os.environ.get("CRUSTDATA_API_KEY", "")


async def enrich_company(company_name: str = "", company_domain: str = "") -> dict:
    """Identify and enrich a company via Crustdata for risk-relevant intelligence."""
    if not CRUSTDATA_TOKEN:
        return {"error": "Crustdata API key not configured"}

    headers = {
        "Authorization": f"Token {CRUSTDATA_TOKEN}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Step 1: Identify the company
        identify_payload = {}
        if company_domain:
            identify_payload["query_company_website"] = company_domain
        elif company_name:
            identify_payload["query_company_name"] = company_name
        else:
            return {"error": "Provide company_name or company_domain"}

        identify_payload["count"] = 1

        try:
            resp = await client.post(
                f"{CRUSTDATA_API_URL}/screener/identify/",
                headers=headers,
                json=identify_payload,
            )
            resp.raise_for_status()
            matches = resp.json()
        except Exception as e:
            return {"error": f"Company identification failed: {str(e)}"}

        if not matches:
            return {"error": f"No company found for: {company_name or company_domain}"}

        company = matches[0] if isinstance(matches, list) else matches
        domain = company.get("company_website_domain") or company.get("primary_domain", "")

        if not domain:
            # Return what we got from identify
            return {
                "company_name": company.get("company_name", ""),
                "linkedin_url": company.get("linkedin_url", ""),
                "note": "No domain found — enrichment skipped",
            }

        # Step 2: Enrich with risk-relevant fields
        try:
            enrich_resp = await client.get(
                f"{CRUSTDATA_API_URL}/screener/company",
                headers=headers,
                params={
                    "company_domain": domain,
                    "fields": "headcount,funding_and_investment,competitors,news_articles,taxonomy",
                },
            )
            enrich_resp.raise_for_status()
            enriched = enrich_resp.json()
        except Exception as e:
            return {"error": f"Company enrichment failed: {str(e)}"}

        if not enriched:
            return {"error": "Enrichment returned no data"}

        profile = enriched[0] if isinstance(enriched, list) else enriched

        # Extract the fields most useful for hedging decisions
        result = {
            "company_name": profile.get("company_name", ""),
            "domain": profile.get("company_website_domain", ""),
            "hq_location": profile.get("hq_location", ""),
            "hq_country": profile.get("hq_country", ""),
            "year_founded": profile.get("year_founded"),
            "company_type": profile.get("company_type", ""),
            "linkedin_industries": profile.get("linkedin_industries", []),
            "crunchbase_categories": profile.get("crunchbase_categories", []),
            "employee_count": profile.get("employee_count_range", ""),
            "estimated_revenue_lower_usd": profile.get("estimated_revenue_lower_bound_usd"),
            "estimated_revenue_upper_usd": profile.get("estimated_revenue_higher_bound_usd"),
        }

        # Headcount details
        headcount = profile.get("headcount", {})
        if headcount:
            result["headcount_latest"] = headcount.get("latest_count")
            result["headcount_growth_6m_pct"] = headcount.get("growth_6m_percent")
            result["headcount_growth_12m_pct"] = headcount.get("growth_12m_percent")

        # Funding
        funding = profile.get("funding_and_investment", {})
        if funding:
            result["total_funding_usd"] = funding.get("crunchbase_total_investment_usd")
            result["last_funding_round"] = funding.get("last_funding_round_type")
            result["last_funding_date"] = funding.get("last_funding_date")

        # Competitors
        competitors = profile.get("competitors", {})
        if competitors:
            comp_list = competitors.get("competitor_names", [])
            result["competitors"] = comp_list[:10] if comp_list else []

        # Recent news (risk signals)
        news = profile.get("news_articles", [])
        if news:
            result["recent_news"] = [
                {"title": n.get("title", ""), "date": n.get("published_at", "")}
                for n in news[:5]
            ]

        # Taxonomy / markets
        taxonomy = profile.get("taxonomy", {})
        if taxonomy:
            result["markets"] = taxonomy.get("markets", [])

        return result
