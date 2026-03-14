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

import tools
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
]

TOOL_FNS = {
    "search_polymarket": tools.search_polymarket,
    "search_kalshi": tools.search_kalshi,
    "web_search": tools.web_search,
}


def _parse_json(text: str) -> list[dict]:
    """Parse JSON from model output, handling markdown code blocks."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            return json.loads(match.group(1))
        raise


async def run_agent(user_query: str) -> list[dict]:
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
        messages.append(msg)

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

    return _parse_json(msg.content)


def _summarize_tool_result(tool_name: str, result) -> str:
    if tool_name in ("search_polymarket", "search_kalshi"):
        count = len(result) if isinstance(result, list) else 0
        source = "Polymarket" if "polymarket" in tool_name else "Kalshi"
        return f"Found {count} contracts on {source}"
    if tool_name == "web_search":
        lines = result.count('\n') + 1 if isinstance(result, str) and result else 0
        return f"Found {lines} relevant results"
    return "Done"


TOOL_DESCRIPTIONS = {
    "search_polymarket": "Searching Polymarket",
    "search_kalshi": "Searching Kalshi",
    "web_search": "Researching",
}


async def run_agent_stream(user_query: str):
    """Async generator yielding SSE events as the agent works."""

    def sse(event: dict) -> str:
        return f"data: {json.dumps(event)}\n\n"

    yield sse({"type": "status", "message": "Analyzing your risk exposure..."})

    messages = [
        {"role": "developer", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_query},
    ]

    msg = None
    for turn in range(15):
        yield sse({"type": "status", "message": f"Thinking... (turn {turn + 1})"})

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
        messages.append(msg)

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

            summary = _summarize_tool_result(fn_name, result)
            yield sse({
                "type": "tool_result",
                "tool": fn_name,
                "turn": turn + 1,
                "summary": summary,
            })

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
        yield sse({"type": "status", "message": "Finalizing your protection plan..."})
        # Serialize through pydantic for validation
        validated = [MarketRecommendation(**r).model_dump() for r in recommendations]
        yield sse({"type": "recommendations", "data": validated})
    except Exception:
        # Agent responded conversationally (clarifying question, etc.)
        yield sse({"type": "conversation", "message": msg.content})


class QueryRequest(BaseModel):
    query: str


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
        return await run_agent(req.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/prediction-markets/stream")
async def prediction_markets_stream(req: QueryRequest):
    return StreamingResponse(
        run_agent_stream(req.query),
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
