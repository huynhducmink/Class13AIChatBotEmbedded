import os
import json
import time
import re
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from tenacity import retry, wait_random_exponential, stop_after_attempt, retry_if_exception_type
from openai import AzureOpenAI
from openai import RateLimitError, APIError
from services.search_service import SearchService

# Load environment variables from .env file
load_dotenv()

# Get Azure OpenAI settings from environment variables
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "https://aiportalapi.stu-platform.live/jpe")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT_NAME = os.getenv("AZURE_DEPLOYMENT_NAME", "GPT-4o-mini")

client = AzureOpenAI(
    api_version="2024-07-01-preview",
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    api_key=AZURE_OPENAI_API_KEY,
)

# function schema that the model can call to trigger a local search
# add more function schemas here as needed
functions = [
    {
        "name": "search_documents",
        "description": "Search the local document collection for relevant chunks. Optionally restrict by a partial source name.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query text"},
                "k": {"type": "integer", "description": "Number of results to return", "minimum": 10, "default": 20},
                "filter": {
                    "type": "string",
                    "description": "Partial match for source filename (e.g., 'stm32', 'stm8', 'f103'). If omitted, search all documents."
                }
            },
            "required": ["query"]
        },
    },
    {
        "name": "list_documents",
        "description": "List documents available in the collection with basic metadata.",
        "parameters": {
            "type": "object",
            "properties": {
                "filter": {
                    "type": "object",
                    "properties": {
                        "source": { "type": "string" }
                    }
                },
            }
        }
    }
]

@retry(
    retry=retry_if_exception_type((RateLimitError, APIError)),
    wait=wait_random_exponential(min=1, max=10),
    stop=stop_after_attempt(5),
    reraise=True
)
def call_openai(messages, functions_arg=None, function_call="auto"):
    print("Calling OpenAI")
    return client.chat.completions.create(
        model=AZURE_DEPLOYMENT_NAME,
        messages=messages,
        functions=functions_arg,
        function_call=function_call,
    )


def _extract_func_call_name_and_args_str(func_call):
    """
    Normalize function call object/dict differences.
    Returns (name, args_str).
    """
    name = None
    args_str = None

    # SDK object style
    if hasattr(func_call, "name"):
        name = getattr(func_call, "name", None)
    if hasattr(func_call, "arguments"):
        args_str = getattr(func_call, "arguments", None)

    # dict style fallback
    if isinstance(func_call, dict):
        name = func_call.get("name", name)
        args_str = func_call.get("arguments", args_str)

    return name, args_str


STM_FAMILY_RE = re.compile(r"\b(stm32|stm8)\b", re.IGNORECASE)
STM_PART_RE = re.compile(r"\b(stm32[a-z0-9]+|stm8[a-z0-9]+)\b", re.IGNORECASE)

def _unique_in_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out

def infer_source_filters_from_query(query: str) -> List[str]:
    """
    Heuristic (multi-match):
    - If user mentions specific parts like stm32f103, stm32f4xx, stm8s003 -> return ALL parts found
    - Else if mentions families stm32/stm8 -> return ALL families found
    - Else -> []
    """
    if not query:
        return []

    # Find all specific parts
    parts = [m.group(1).lower() for m in STM_PART_RE.finditer(query)]
    parts = _unique_in_order(parts)
    if parts:
        return parts

    # Fallback: find all families
    families = [m.group(1).lower() for m in STM_FAMILY_RE.finditer(query)]
    return _unique_in_order(families)


def handle_search_function_call(func_call):
    print("Function call received:", func_call)

    # Extract args string from object/dict
    args_str = None
    if hasattr(func_call, "arguments"):
        args_str = func_call.arguments
    elif isinstance(func_call, dict):
        args_str = func_call.get("arguments")

    if not args_str:
        return {"error": "no function arguments provided"}

    try:
        args = json.loads(args_str)
    except Exception as e:
        return {"error": f"invalid function arguments: {e}"}

    query = args.get("query")
    if not query or not str(query).strip():
        return {"error": "query must be a non-empty string"}

    k = int(args.get("k", 5))

    # Your schema has filter as STRING
    filter_str = args.get("filter")
    if filter_str and isinstance(filter_str, str):
        filter_str = filter_str.strip()
    else:
        filter_str = None

    # NEW: fallback inference when model doesn’t pass filter properly
    if not filter_str:
        filter_str = infer_source_filters_from_query(query)

    svc = SearchService()
    raw_results = svc.search(query=query, k=k, source=filter_str)
    print("Search params:", {"query": query, "k": k, "filter": filter_str})
    # print("Raw search results:", raw_results)
    formatted_results = []
    if raw_results and "documents" in raw_results and raw_results["documents"]:
        for i, doc in enumerate(raw_results["documents"][0]):
            metadata = raw_results["metadatas"][0][i] if raw_results.get("metadatas") else {}
            distance = raw_results["distances"][0][i] if raw_results.get("distances") else None
            
            formatted_results.append({
                "text": doc,
                "source": metadata.get("source", "unknown"),
                "page": metadata.get("page", None),
                "chunk_id": metadata.get("chunk_id", None),
                "distance": distance,
                "score": 1 - distance if distance is not None else None
            })
    
    return {"results": formatted_results, "raw": raw_results}


def handle_list_function_call(func_call):
    print("Function call received:", func_call)

    args_str = None
    if hasattr(func_call, "arguments"):
        args_str = func_call.arguments
    elif isinstance(func_call, dict):
        args_str = func_call.get("arguments")

    args = {}
    if args_str:
        try:
            args = json.loads(args_str)
        except Exception as e:
            return {"error": f"invalid function arguments: {e}"}

    filter_obj = args.get("filter") or {}

    svc = SearchService()
    return svc.list_documents(filter=filter_obj)


def handle_any_function_call(func_call):
    name = None
    if hasattr(func_call, "name"):
        name = func_call.name
    elif isinstance(func_call, dict):
        name = func_call.get("name")

    if name == "search_documents":
        result =  handle_search_function_call(func_call)
        # print("Search function result:", result)
        return result
    elif name == "list_documents":
        result =  handle_list_function_call(func_call)
        # print("List documents function result:", result)
        return result
    else:
        return {"error": f"unsupported function: {name}"}



def _extract_choice_message(resp):
    """Handle SDK object vs dict response."""
    try:
        return resp.choices[0].message
    except Exception:
        try:
            return resp["choices"][0]["message"]
        except Exception:
            return None


def _extract_function_call_from_message(msg):
    """Get function_call from SDK object or dict message."""
    if msg is None:
        return None

    # SDK message object
    if hasattr(msg, "function_call"):
        return getattr(msg, "function_call", None)

    # dict-like
    if isinstance(msg, dict):
        return msg.get("function_call")

    return None


def chat_search_auto(prompt: str):
    """
    Use the model in function-call 'auto' mode.
    If the model calls a known function, execute locally and return the final response.
    Returns a tuple (final_response_obj, function_results_if_any).
    """
    user_msg = {"role": "user", "content": prompt}

    try:
        resp = call_openai([user_msg], functions_arg=functions, function_call="auto")
    except Exception as e:
        return {"error": f"openai call failed: {e}"}, None

    msg = _extract_choice_message(resp)
    func_call = _extract_function_call_from_message(msg)

    if func_call:
        func_name, _ = _extract_func_call_name_and_args_str(func_call)

        function_results = handle_any_function_call(func_call)

        function_message = {
            "role": "function",
            "name": func_name or "unknown_function",
            "content": json.dumps(function_results)
        }

        # Ask the model to produce a final assistant response after seeing function output
        final = call_openai(
            [user_msg, function_message],
            functions_arg=None,
            function_call=None
        )
        return final, function_results

    return resp, None


# simple batch helper for testing
# def batch_search(prompts):
#     outputs = []
#     for p in prompts:
#         try:
#             final_resp, results = chat_search_auto(p)
#             outputs.append({"prompt": p, "assistant_response": final_resp, "search_results": results})
#             time.sleep(0.5)
#         except Exception as e:
#             outputs.append({"prompt": p, "error": str(e)})
#     return outputs

# if __name__ == "__main__":
#     examples = [
#         "Find relevant STM32 manual snippets about setting up USART.",
#         # "Search for 'I2C timing' best practice in the manual and return top 3."
#     ]
#     out = batch_search(examples)
#     print(out)