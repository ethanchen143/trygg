import json
import re
import logging

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
