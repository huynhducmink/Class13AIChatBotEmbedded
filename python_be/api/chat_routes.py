from typing import Optional, Any, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json

from services.chat_service import chat_search_auto

chat_router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    prompt: str
    k: Optional[int] = 5

@chat_router.post("/chat")
async def chat_search(req: ChatRequest) -> Dict[str, Any]:
    """
    Accept a user prompt, invoke chat_search_auto (function-call auto mode),
    and return the assistant response plus any local search results.
    """
    try:
        final_resp, search_results = chat_search_auto(req.prompt, req.k or 5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Extract assistant message content
    assistant_message = None
    if final_resp:
        try:
            if hasattr(final_resp, "choices") and final_resp.choices:
                choice = final_resp.choices[0]
                if hasattr(choice, "message"):
                    assistant_message = choice.message.content
            elif isinstance(final_resp, dict) and "choices" in final_resp:
                assistant_message = final_resp["choices"][0]["message"]["content"]
        except Exception:
            assistant_message = str(final_resp)

    # Extract formatted search results
    sources = []
    if search_results and "results" in search_results:
        sources = search_results["results"]
    
    print(f"[DEBUG CHAT] Found {len(sources)} sources from search_results")
    if sources:
        print(f"[DEBUG CHAT] First source: {sources[0].get('source', 'unknown')}")

    return {
        "response": assistant_message or "No response generated",
        "sources": sources,
        "assistant_response": final_resp,
        "search_results": search_results,
    }