from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import search_router
from api.file_routes import file_router
from api.index_routes import index_router
from api.chat_routes import chat_router

app = FastAPI(
    title="STM32 Manual Search API",
    description="""
    ## FastAPI-based REST API for searching STM32 manual documentation
    
    This API uses vector embeddings and ChromaDB to provide semantic search capabilities 
    over STM32 technical documentation.
    
    ### Features
    * **Semantic Search**: Find relevant information using natural language queries
    * **Vector Embeddings**: Powered by sentence-transformers for accurate results
    * **Fast & Efficient**: ChromaDB for high-performance vector similarity search
    * **File Management**: Upload, list, and delete document files
    * **Index Building**: Build and rebuild search index from uploaded documents
    * **RESTful API**: Standard HTTP endpoints with JSON responses
    
    ### Getting Started
    1. Upload documents using the `/api/v1/files/upload` endpoint
    2. Build the index using the `/api/v1/index/build` endpoint
    3. Use the `/api/v1/search` endpoint to search documentation
    4. Check `/api/v1/collection/stats` for collection information
    5. Visit `/health` for API health status
    6. Chat with the model to ask for information about the documents using `/api/v1/chat/chat` endpoint
    """,
    version="1.0.0",
    contact={
        "name": "API Support",
        "url": "https://github.com/huynhducmink/Class13AIChatBotEmbedded",
    },
    license_info={
        "name": "MIT",
    },
    openapi_tags=[
        {
            "name": "search",
            "description": "Search operations for STM32 documentation",
        },
        {
            "name": "files",
            "description": "File management operations for document source files",
        },
        {
            "name": "index",
            "description": "Index building and management operations",
        },
        {
            "name": "system",
            "description": "System health and information endpoints",
        },
    ],
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(search_router, prefix="/api/v1", tags=["search"])
app.include_router(file_router, prefix="/api/v1", tags=["files"])
app.include_router(index_router, prefix="/api/v1", tags=["index"])
app.include_router(chat_router, prefix="/api/v1", tags=["chat"])

@app.get(
    "/",
    tags=["system"],
    summary="API Root",
    description="Get basic API information and links to documentation",
)
async def root():
    """Returns basic information about the API and links to documentation."""
    return {
        "message": "STM32 Manual Search API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json"
    }

@app.get(
    "/health",
    tags=["system"],
    summary="Health Check",
    description="Check if the API is running and healthy",
)
async def health_check():
    """Returns the health status of the API."""
    return {
        "status": "healthy",
        "service": "STM32 Manual Search API",
        "version": "1.0.0"
    }
