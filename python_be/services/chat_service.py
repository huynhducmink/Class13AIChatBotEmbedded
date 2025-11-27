import os
import json
import time
from tenacity import retry, wait_random_exponential, stop_after_attempt, retry_if_exception_type
from openai import AzureOpenAI
from openai import RateLimitError, APIError
from services.search_service import SearchService

AZURE_OPENAI_API_KEY = "SampleKey1234"  # Replace with your actual key

os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "https://aiportalapi.stu-platform.live/jpe")
os.environ.setdefault("AZURE_OPENAI_API_KEY", AZURE_OPENAI_API_KEY)
os.environ.setdefault("AZURE_DEPLOYMENT_NAME", "GPT-4o-mini")

client = AzureOpenAI(
    api_version="2024-07-01-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
)

# function schema that the model can call to trigger a local search
# add more function schemas here as needed
functions = [
    {
        "name": "search_documents",
        "description": "Search the local document collection for relevant chunks.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query text"},
                "k": {"type": "integer", "description": "Number of results to return", "minimum": 1}
            },
            "required": ["query"]
        },
    }
]

@retry(
    retry=retry_if_exception_type((RateLimitError, APIError)),
    wait=wait_random_exponential(min=1, max=10),
    stop=stop_after_attempt(5),
    reraise=True
)
def call_openai(messages, functions_arg=None, function_call="auto"):
    return client.chat.completions.create(
        model=os.getenv("AZURE_DEPLOYMENT_NAME"),
        messages=messages,
        functions=functions_arg,
        function_call=function_call,
    )

def handle_search_function_call(func_call):
    """Parse arguments and call the local SearchService."""
    print("Function call received:", func_call)
    # func_call may be an object or dict depending on SDK; normalize
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
    k = int(args.get("k", 5))
    svc = SearchService()
    return svc.search(query=query, k=k)

def chat_search_auto(prompt: str):
    """
    Use the model in function-call 'auto' mode. If the model calls 'search_documents',
    execute the search locally and return the final assistant response.
    Returns a tuple (final_response_obj, search_results_if_any).
    """
    user_msg = {"role": "user", "content": prompt}
    try:
        # initial request lets the model decide whether to call the function
        resp = call_openai([user_msg], functions_arg=functions, function_call="auto")
    except Exception as e:
        return {"error": f"openai call failed: {e}"}, None

    # extract possible function call
    choice = None
    try:
        choice = resp.choices[0]
    except Exception:
        # try dict-style
        try:
            choice = resp["choices"][0]
        except Exception:
            choice = None

    func_call = None
    if choice is not None:
        # try multiple access patterns for function_call
        if hasattr(choice, "message") and hasattr(choice.message, "function_call"):
            func_call = choice.message.function_call
        else:
            # dict-like
            msg = None
            try:
                msg = choice["message"]
            except Exception:
                pass
            if msg and isinstance(msg, dict):
                func_call = msg.get("function_call")

    # If model requested a function call, execute it and send back result as a function role
    if func_call:
        search_results = handle_search_function_call(func_call)
        function_message = {
            "role": "function",
            "name": "search_documents",
            "content": json.dumps(search_results)
        }
        # Ask the model to produce a final assistant response after seeing the function output
        final = call_openai([user_msg, function_message], functions_arg=None, function_call=None)
        return final, search_results

    # If no function call, return the model's original response
    return resp, None

# simple batch helper for testing
def batch_search(prompts):
    outputs = []
    for p in prompts:
        try:
            final_resp, results = chat_search_auto(p)
            outputs.append({"prompt": p, "assistant_response": final_resp, "search_results": results})
            time.sleep(0.5)
        except Exception as e:
            outputs.append({"prompt": p, "error": str(e)})
    return outputs

if __name__ == "__main__":
    examples = [
        "Find relevant STM32 manual snippets about setting up USART.",
        # "Search for 'I2C timing' best practice in the manual and return top 3."
    ]
    out = batch_search(examples)
    print(out)