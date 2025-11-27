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
        final_resp, search_results = chat_search_auto(req.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "assistant_response": final_resp,
        "search_results": search_results,
    }