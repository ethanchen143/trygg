import json
import re
import logging
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

import httpx

import tools
import quant
from quant import DEFAULT_BUDGET
from prompts import SYSTEM_PROMPT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("hedgeai")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

client = OpenAI()

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_polymarket",
            "description": "Search Polymarket for prediction market contracts matching a query.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Search query"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_kalshi",
            "description": "Search Kalshi (CFTC-regulated) for prediction market contracts matching a query.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Search query"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for context about a topic or current event.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Search query"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "enrich_company",
            "description": "Look up a company by name or domain to get detailed intelligence: industry, size, revenue, funding, competitors, HQ location, and recent news. Use this to better understand the user's business and calibrate risk exposure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "company_name": {"type": "string", "description": "Company name to look up"},
                    "company_domain": {"type": "string", "description": "Company website domain (e.g. 'acme.com')"},
                },
            },
        },
    },
]

TOOL_FNS = {
    "search_polymarket": tools.search_polymarket,
    "search_kalshi": tools.search_kalshi,
    "web_search": tools.web_search,
    "enrich_company": tools.enrich_company,
}


def _msg_to_dict(msg) -> dict:
    """Convert an OpenAI message object to a plain dict for re-serialization."""
    d = {"role": msg.role}
    if msg.content:
        d["content"] = msg.content
    if msg.tool_calls:
        d["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments},
            }
            for tc in msg.tool_calls
        ]
    return d


def _parse_json(text: str) -> list[dict]:
    """Parse JSON from model output, handling markdown code blocks."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            return json.loads(match.group(1))
        raise


async def run_agent(user_query: str, budget: float = DEFAULT_BUDGET) -> list[dict]:
    messages = [
        {"role": "developer", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_query},
    ]

    msg = None
    for turn in range(15):  # max turns
        logger.info(f"=== TURN {turn + 1} === Calling LLM...")
        resp = client.chat.completions.create(
            model="o4-mini",
            messages=messages,
            tools=TOOLS_SCHEMA,
        )
        msg = resp.choices[0].message
        logger.info(f"=== TURN {turn + 1} === finish_reason={resp.choices[0].finish_reason}, "
                     f"content={'YES' if msg.content else 'None'} ({len(msg.content) if msg.content else 0} chars), "
                     f"tool_calls={len(msg.tool_calls) if msg.tool_calls else 0}, "
                     f"refusal={msg.refusal if hasattr(msg, 'refusal') else 'N/A'}")
        messages.append(_msg_to_dict(msg))

        if not msg.tool_calls:
            logger.info(f"=== TURN {turn + 1} === No tool calls — agent finished.")
            if msg.content:
                logger.info(f"Final response (first 500 chars): {msg.content[:500]}")
            break

        logger.info(f"=== TURN {turn + 1} === {len(msg.tool_calls)} tool call(s):")
        for tc in msg.tool_calls:
            fn = TOOL_FNS[tc.function.name]
            args = json.loads(tc.function.arguments)
            logger.info(f"  TOOL CALL: {tc.function.name}({args})")
            result = await fn(**args)
            result_str = json.dumps(result) if not isinstance(result, str) else result
            logger.info(f"  TOOL RESULT ({tc.function.name}): {len(result_str)} chars, preview: {result_str[:200]}...")
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_str,
            })

    if msg is None or not msg.content:
        raise ValueError("Agent did not produce a final response")

    candidates = _parse_json(msg.content)
    result = quant.optimize_portfolio(candidates, budget=budget)
    return result


def _summarize_tool_result(tool_name: str, result) -> str:
    if tool_name in ("search_polymarket", "search_kalshi"):
        count = len(result) if isinstance(result, list) else 0
        source = "Polymarket" if "polymarket" in tool_name else "Kalshi"
        return f"Found {count} contracts on {source}"
    if tool_name == "web_search":
        lines = result.count('\n') + 1 if isinstance(result, str) and result else 0
        return f"Found {lines} relevant results"
    if tool_name == "enrich_company":
        if isinstance(result, dict) and result.get("company_name"):
            name = result["company_name"]
            industry = ", ".join(result.get("linkedin_industries", [])[:2]) or "Unknown industry"
            return f"Enriched {name} — {industry}"
        return "Company lookup returned no data"
    return "Done"


TOOL_DESCRIPTIONS = {
    "search_polymarket": "Searching Polymarket",
    "search_kalshi": "Searching Kalshi",
    "web_search": "Researching",
    "enrich_company": "Looking up company intelligence",
}


async def run_agent_stream(user_query: str, budget: float = DEFAULT_BUDGET):
    """Async generator yielding SSE events as the agent works."""

    def sse(event: dict) -> str:
        return f"data: {json.dumps(event)}\n\n"

    def keepalive() -> str:
        """SSE comment to keep connection alive through proxies."""
        return ": keepalive\n\n"

    yield sse({"type": "status", "message": "Analyzing your risk exposure..."})

    messages = [
        {"role": "developer", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_query},
    ]

    # Accumulate all contracts the agent searched through
    all_searched_contracts = []

    msg = None
    for turn in range(15):
        yield sse({"type": "status", "message": f"Thinking... (turn {turn + 1})"})
        yield keepalive()

        logger.info(f"=== TURN {turn + 1} === Calling LLM...")
        resp = client.chat.completions.create(
            model="o4-mini",
            messages=messages,
            tools=TOOLS_SCHEMA,
        )
        msg = resp.choices[0].message
        logger.info(f"=== TURN {turn + 1} === finish_reason={resp.choices[0].finish_reason}, "
                     f"content={'YES' if msg.content else 'None'} ({len(msg.content) if msg.content else 0} chars), "
                     f"tool_calls={len(msg.tool_calls) if msg.tool_calls else 0}, "
                     f"refusal={msg.refusal if hasattr(msg, 'refusal') else 'N/A'}")
        messages.append(_msg_to_dict(msg))

        if not msg.tool_calls:
            logger.info(f"=== TURN {turn + 1} === No tool calls — agent finished.")
            if msg.content:
                logger.info(f"Final response (first 500 chars): {msg.content[:500]}")
            break

        logger.info(f"=== TURN {turn + 1} === {len(msg.tool_calls)} tool call(s):")
        for tc in msg.tool_calls:
            fn_name = tc.function.name
            args = json.loads(tc.function.arguments)
            query_str = args.get("query", "")
            desc = TOOL_DESCRIPTIONS.get(fn_name, fn_name)

            yield sse({
                "type": "tool_call",
                "tool": fn_name,
                "turn": turn + 1,
                "message": f'{desc} for "{query_str}"...',
            })

            logger.info(f"  TOOL CALL: {fn_name}({args})")
            fn = TOOL_FNS[fn_name]
            result = await fn(**args)
            result_str = json.dumps(result) if not isinstance(result, str) else result
            logger.info(f"  TOOL RESULT ({fn_name}): {len(result_str)} chars")

            # Capture searched contracts for "related markets"
            if fn_name in ("search_polymarket", "search_kalshi") and isinstance(result, list):
                for contract in result:
                    all_searched_contracts.append({
                        "title": contract.get("title", ""),
                        "source": contract.get("source", "polymarket"),
                        "yes_price": contract.get("yes_price"),
                        "no_price": contract.get("no_price"),
                        "volume": contract.get("volume"),
                        "end_date": contract.get("end_date"),
                        "url": contract.get("url", ""),
                        "ticker": contract.get("ticker"),
                    })

            summary = _summarize_tool_result(fn_name, result)
            tool_result_event = {
                "type": "tool_result",
                "tool": fn_name,
                "turn": turn + 1,
                "summary": summary,
            }
            # Attach contract details for market search results
            if fn_name in ("search_polymarket", "search_kalshi") and isinstance(result, list):
                tool_result_event["contracts"] = [
                    {
                        "title": c.get("title", ""),
                        "source": c.get("source", "Polymarket" if "polymarket" in fn_name else "Kalshi"),
                        "yes_price": c.get("yes_price"),
                        "no_price": c.get("no_price"),
                        "volume": c.get("volume"),
                        "end_date": c.get("end_date"),
                        "url": c.get("url", ""),
                    }
                    for c in result if c.get("title")
                ]
            if fn_name == "enrich_company" and isinstance(result, dict):
                tool_result_event["enrichment"] = result
            if fn_name == "web_search" and isinstance(result, str) and result:
                tool_result_event["web_results"] = result[:2000]
            yield sse(tool_result_event)

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_str,
            })

    # Final response
    if msg is None or not msg.content:
        yield sse({"type": "error", "message": "Agent did not produce a response. Please try again with more detail about your business."})
        return

    try:
        recommendations = _parse_json(msg.content)
        yield sse({"type": "status", "message": "Optimizing portfolio allocation..."})

        # Run quant engine on LLM candidates
        portfolio = quant.optimize_portfolio(recommendations, budget=budget)

        yield sse({"type": "status", "message": "Running Monte Carlo simulation..."})
        yield sse({"type": "recommendations", "data": portfolio})

        # Emit related markets (searched but not selected)
        # Rank by similarity to selected contracts, not just volume
        selected_titles = {r.get("title", "").lower() for r in recommendations}
        selected_text = " ".join(r.get("title", "") + " " + r.get("reasoning", "") for r in recommendations)
        seen = set()
        related = []
        for c in all_searched_contracts:
            title = c.get("title", "")
            title_lower = title.lower()
            if title_lower in selected_titles or title_lower in seen or not title:
                continue
            if c.get("yes_price") is None:
                continue
            seen.add(title_lower)
            # Score by relevance to selected contracts + volume
            relevance = tools._keyword_match(title, selected_text)
            volume_score = min(float(c.get("volume") or 0) / 1_000_000, 1.0)
            c["_score"] = relevance * 0.7 + volume_score * 0.3
            related.append(c)
        # Sort by relevance score descending
        related.sort(key=lambda x: x.get("_score", 0), reverse=True)
        # Clean up internal score before sending
        for c in related:
            c.pop("_score", None)
        if related:
            yield sse({"type": "related_markets", "data": related[:20]})

    except Exception:
        # Agent responded conversationally (clarifying question, etc.)
        yield sse({"type": "conversation", "message": msg.content})


class QueryRequest(BaseModel):
    query: str
    budget: float = 10000


# ── Live Market Data Proxy Endpoints ──
# These proxy Polymarket/Kalshi APIs so the frontend avoids CORS issues

@app.get("/api/markets/trending")
async def trending_markets():
    """Return top active Polymarket markets sorted by volume for the trending panel."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://gamma-api.polymarket.com/markets",
                params={"active": "true", "closed": "false", "limit": 50, "order": "volume", "ascending": "false"},
            )
            resp.raise_for_status()
            markets = resp.json()

        results = []
        for m in markets:
            prices = m.get("outcomePrices", "[]")
            if isinstance(prices, str):
                try:
                    prices = json.loads(prices)
                except Exception:
                    prices = []
            yes_price = float(prices[0]) if prices else None
            if yes_price is None:
                continue
            results.append({
                "id": m.get("id"),
                "question": m.get("question", ""),
                "yes_price": yes_price,
                "volume": float(m.get("volume", 0) or 0),
                "slug": m.get("slug", ""),
                "end_date": m.get("endDate"),
                "image": m.get("image"),
            })

        return results[:30]
    except Exception as e:
        return []


@app.get("/api/markets/ticker-feed")
async def ticker_feed():
    """Return live market data for the scrolling ticker bar."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://gamma-api.polymarket.com/markets",
                params={"active": "true", "closed": "false", "limit": 40, "order": "volume", "ascending": "false"},
            )
            resp.raise_for_status()
            markets = resp.json()

        results = []
        for m in markets:
            prices = m.get("outcomePrices", "[]")
            if isinstance(prices, str):
                try:
                    prices = json.loads(prices)
                except Exception:
                    prices = []
            yes_price = float(prices[0]) if prices else None
            if yes_price is None:
                continue
            question = m.get("question", "")
            if len(question) > 60:
                question = question[:57] + "..."
            results.append({
                "question": question,
                "yes_price": yes_price,
                "volume": float(m.get("volume", 0) or 0),
            })

        return results[:25]
    except Exception:
        return []


@app.get("/api/markets/price-history")
async def price_history(question: str):
    """Fetch real price history for a market by searching its question text."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: Find the market on Gamma API by question text
            resp = await client.get(
                "https://gamma-api.polymarket.com/markets",
                params={"active": "true", "closed": "false", "limit": 5},
            )
            resp.raise_for_status()

            # Search through all cached markets for a title match
            all_events = await tools._fetch_polymarket_all()
            best_match = None
            best_score = 0
            clob_token_id = None

            for event in all_events:
                for market in event.get("markets", [event]):
                    q = market.get("question", "")
                    score = tools._keyword_match(q, question)
                    if score > best_score:
                        best_score = score
                        best_match = market
                        tokens = market.get("clobTokenIds", "[]")
                        if isinstance(tokens, str):
                            try:
                                tokens = json.loads(tokens)
                            except Exception:
                                tokens = []
                        clob_token_id = tokens[0] if tokens else None

            if not clob_token_id or best_score < 0.3:
                return []

            # Step 2: Fetch price history from CLOB API
            resp = await client.get(
                "https://clob.polymarket.com/prices-history",
                params={
                    "market": clob_token_id,
                    "interval": "max",
                    "fidelity": 60,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # data.history is array of {t: timestamp, p: price}
            history = data.get("history", [])
            return [{"t": point.get("t", 0), "p": float(point.get("p", 0))} for point in history]
    except Exception as e:
        logger.error(f"Price history error: {e}")
        return []


class MarketRecommendation(BaseModel):
    title: str
    source: str
    ticker: str | None = None
    url: str
    side: str
    current_price: float
    payout_ratio: str
    end_date: str | None = None
    correlation: str
    reasoning: str
    confidence: float


@app.post("/prediction-markets", response_model=list[MarketRecommendation])
async def prediction_markets(req: QueryRequest):
    try:
        return await run_agent(req.query, budget=req.budget)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/prediction-markets/stream")
async def prediction_markets_stream(req: QueryRequest):
    return StreamingResponse(
        run_agent_stream(req.query, budget=req.budget),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# Serve frontend static files in production
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file = FRONTEND_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(FRONTEND_DIR / "index.html")
