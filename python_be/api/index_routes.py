from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from services.index_service import IndexService

index_router = APIRouter()
index_service = IndexService()

# Track indexing status (in production, use a proper job queue like Celery or Redis)
indexing_status = {
    "is_running": False,
    "last_result": None,
    "progress": None
}


class FileProcessed(BaseModel):
    filename: str = Field(..., description="Name of the processed file")
    pages: int = Field(..., description="Number of pages in the file")
    chunks: int = Field(..., description="Number of chunks created from the file")


class BuildIndexResponse(BaseModel):
    success: bool = Field(..., description="Whether the indexing was successful")
    message: str = Field(..., description="Status message")
    total_chunks: Optional[int] = Field(None, description="Total number of chunks indexed")
    previous_chunks: Optional[int] = Field(None, description="Number of chunks before re-indexing")
    files_processed: Optional[List[FileProcessed]] = Field(None, description="List of processed files")
    embedding_model: Optional[str] = Field(None, description="Name of the embedding model used")
    collection_name: Optional[str] = Field(None, description="Name of the ChromaDB collection")
    error: Optional[str] = Field(None, description="Error message if indexing failed")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "Index built successfully",
                    "total_chunks": 1250,
                    "previous_chunks": 800,
                    "files_processed": [
                        {
                            "filename": "stm32_manual.pdf",
                            "pages": 150,
                            "chunks": 1250
                        }
                    ],
                    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
                    "collection_name": "stm32_manual_embedding"
                }
            ]
        }
    }


class IndexStatusResponse(BaseModel):
    is_running: bool = Field(..., description="Whether indexing is currently in progress")
    last_result: Optional[Dict[str, Any]] = Field(None, description="Result of the last indexing operation")
    progress: Optional[str] = Field(None, description="Current progress message")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "is_running": False,
                    "last_result": {
                        "success": True,
                        "message": "Index built successfully",
                        "total_chunks": 1250
                    },
                    "progress": None
                }
            ]
        }
    }


def run_index_build(rebuild: bool = False):
    """Background task to build the index."""
    global indexing_status
    
    try:
        indexing_status["is_running"] = True
        indexing_status["progress"] = "Starting indexing process..."
        
        result = index_service.build_index(rebuild=rebuild)
        
        indexing_status["last_result"] = result
        indexing_status["is_running"] = False
        indexing_status["progress"] = None
    except Exception as e:
        indexing_status["last_result"] = {
            "success": False,
            "error": f"Unexpected error during indexing: {str(e)}"
        }
        indexing_status["is_running"] = False
        indexing_status["progress"] = None


@index_router.post(
    "/index/build",
    response_model=BuildIndexResponse,
    summary="Build Search Index",
    description="""
    Build or incrementally add to the search index from PDF files in document_source.
    
    **Query Parameters:**
    - `rebuild` (boolean, default=false): 
      - If `false`: Only indexes NEW files (incremental, faster)
      - If `true`: Clears and rebuilds entire index from scratch (full rebuild)
    
    This operation:
    1. Scans all PDF files in the document_source directory
    2. Extracts text from each page
    3. Splits text into overlapping chunks (1500 chars with 200 char overlap)
    4. Generates embeddings using sentence-transformers
    5. Stores embeddings in ChromaDB for fast similarity search
    """,
    responses={
        200: {
            "description": "Indexing started or completed successfully",
        },
        409: {"description": "Indexing is already in progress"},
        500: {"description": "Error during indexing"},
    },
)
async def build_index(background_tasks: BackgroundTasks, rebuild: bool = False):
    """
    Build the search index from all PDF files in document_source.
    
    **Parameters:**
    - `rebuild`: If true, clears all existing data and rebuilds from scratch.
                If false (default), only indexes new files (incremental).
    
    This endpoint will process PDFs, extract text, create embeddings,
    and store them in ChromaDB for semantic search.
    
    The operation runs in the background and returns immediately. Use the
    `/index/status` endpoint to check the progress and results.
    """
    global indexing_status
    
    # Check if indexing is already running
    if indexing_status["is_running"]:
        raise HTTPException(
            status_code=409,
            detail="Indexing is already in progress. Please wait for it to complete."
        )
    
    # Start indexing in background
    background_tasks.add_task(run_index_build, rebuild=rebuild)
    
    mode = "full rebuild" if rebuild else "incremental"
    return BuildIndexResponse(
        success=True,
        message=f"Indexing started in background ({mode} mode). Use /index/status to check progress."
    )


@index_router.post(
    "/index/build/sync",
    response_model=BuildIndexResponse,
    summary="Build Search Index (Synchronous)",
    description="""
    Build or incrementally add to the search index synchronously (waits for completion).
    
    **Query Parameters:**
    - `rebuild` (boolean, default=false):
      - If `false`: Only indexes NEW files (incremental, faster)
      - If `true`: Clears and rebuilds entire index from scratch (full rebuild)
    
    This is the same as `/index/build` but waits for the indexing to complete
    before returning the result. Use this if you need to know the result immediately.
    
    **Warning:** This endpoint may take several minutes to complete for large document sets.
    """,
    responses={
        200: {
            "description": "Indexing completed successfully or failed",
        },
        409: {"description": "Indexing is already in progress"},
        500: {"description": "Error during indexing"},
    },
)
async def build_index_sync(rebuild: bool = False):
    """
    Build the search index synchronously (waits for completion).
    
    **Parameters:**
    - `rebuild`: If true, clears all existing data and rebuilds from scratch.
                If false (default), only indexes new files (incremental).
    
    This endpoint processes all PDFs and returns the result immediately.
    It may take several minutes to complete for large document sets.
    """
    global indexing_status
    
    # Check if indexing is already running
    if indexing_status["is_running"]:
        raise HTTPException(
            status_code=409,
            detail="Indexing is already in progress. Please wait for it to complete."
        )
    
    try:
        indexing_status["is_running"] = True
        result = index_service.build_index(rebuild=rebuild)
        indexing_status["last_result"] = result
        indexing_status["is_running"] = False
        
        return BuildIndexResponse(**result)
    except Exception as e:
        indexing_status["is_running"] = False
        raise HTTPException(
            status_code=500,
            detail=f"Error during indexing: {str(e)}"
        )


@index_router.get(
    "/index/status",
    response_model=IndexStatusResponse,
    summary="Get Indexing Status",
    description="Get the current status of the indexing operation",
    responses={
        200: {
            "description": "Status retrieved successfully",
        },
    },
)
async def get_index_status():
    """
    Get the current status of the indexing operation.
    
    Returns:
    - Whether indexing is currently running
    - Result of the last indexing operation (if any)
    - Current progress message (if running)
    """
    return IndexStatusResponse(
        is_running=indexing_status["is_running"],
        last_result=indexing_status["last_result"],
        progress=indexing_status["progress"]
    )
