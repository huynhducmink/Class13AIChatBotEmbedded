from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import shutil
import re
import unicodedata
from pathlib import Path
from services.index_service import IndexService

file_router = APIRouter()
index_service = IndexService()

# Document source directory
DOCUMENT_SOURCE_DIR = Path(__file__).parent.parent / "document_source"

# Ensure the directory exists
DOCUMENT_SOURCE_DIR.mkdir(exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".doc"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename by removing or replacing problematic characters.
    Converts to ASCII, replaces spaces with underscores, and removes special characters.
    """
    # Get the name and extension separately
    path = Path(filename)
    name = path.stem
    extension = path.suffix
    
    # Normalize unicode characters (e.g., é -> e, ' -> ')
    name = unicodedata.normalize('NFKD', name)
    
    # Convert to ASCII, ignoring characters that can't be converted
    name = name.encode('ascii', 'ignore').decode('ascii')
    
    # Replace spaces and common separators with underscores
    name = re.sub(r'[\s\-]+', '_', name)
    
    # Remove any character that is not alphanumeric or underscore
    name = re.sub(r'[^\w]', '', name)
    
    # Remove multiple consecutive underscores
    name = re.sub(r'_+', '_', name)
    
    # Remove leading/trailing underscores
    name = name.strip('_')
    
    # If name is empty after sanitization, use a default
    if not name:
        name = "file"

    return f"{name}{extension.lower()}"


class FileInfo(BaseModel):
    filename: str = Field(..., description="Name of the file")
    filepath: str = Field(..., description="Download URL path for the file")
    size: int = Field(..., description="File size in bytes")
    extension: str = Field(..., description="File extension")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "filename": "stm32_manual.pdf",
                    "filepath": "/api/v1/files/download/stm32_manual.pdf",
                    "size": 2048576,
                    "extension": ".pdf"
                }
            ]
        }
    }


class FileListResponse(BaseModel):
    files: List[FileInfo] = Field(..., description="List of files in the document source")
    total_files: int = Field(..., description="Total number of files")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "files": [
                        {
                            "filename": "stm32_manual.pdf",
                            "filepath": "document_source/stm32_manual.pdf",
                            "size": 2048576,
                            "extension": ".pdf"
                        }
                    ],
                    "total_files": 1
                }
            ]
        }
    }


class DeleteResponse(BaseModel):
    message: str = Field(..., description="Deletion status message")
    filename: str = Field(..., description="Name of the deleted file")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message": "File deleted successfully",
                    "filename": "stm32_manual.pdf"
                }
            ]
        }
    }


class UploadResponse(BaseModel):
    message: str = Field(..., description="Upload status message")
    filename: str = Field(..., description="Name of the uploaded file")
    filepath: str = Field(..., description="Download URL path for the uploaded file")
    size: int = Field(..., description="File size in bytes")
    indexing_started: Optional[bool] = Field(
        default=None,
        description="Whether background indexing was started after upload",
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message": "File uploaded successfully",
                    "filename": "stm32_manual.pdf",
                    "filepath": "/api/v1/files/download/stm32_manual.pdf",
                    "size": 2048576
                }
            ]
        }
    }


@file_router.get(
    "/files",
    response_model=FileListResponse,
    summary="List All Files",
    description="Get a list of all files in the document_source directory",
    responses={
        200: {
            "description": "List of files retrieved successfully",
        },
        500: {"description": "Internal server error"},
    },
)
async def list_files():
    """
    List all files in the document_source directory.
    
    Returns information about each file including:
    - Filename
    - Relative filepath
    - File size in bytes
    - File extension
    """
    try:
        files_info = []
        
        # Iterate through all files in the document_source directory
        for file_path in DOCUMENT_SOURCE_DIR.iterdir():
            if file_path.is_file():
                file_size = file_path.stat().st_size
                download_path = f"/api/v1/files/download/{file_path.name}"
                
                files_info.append(FileInfo(
                    filename=file_path.name,
                    filepath=download_path,
                    size=file_size,
                    extension=file_path.suffix
                ))
        
        # Sort by filename
        files_info.sort(key=lambda x: x.filename)
        
        return FileListResponse(
            files=files_info,
            total_files=len(files_info)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


@file_router.post(
    "/files/upload",
    response_model=UploadResponse,
    summary="Upload File",
    description="Upload a file to the document_source directory using streaming upload",
    responses={
        200: {
            "description": "File uploaded successfully",
        },
        400: {"description": "Invalid file or file type not allowed"},
        413: {"description": "File size exceeds maximum allowed size"},
        500: {"description": "Internal server error"},
    },
)
async def upload_file(
    file: UploadFile = File(..., description="File to upload (PDF, TXT, DOCX)"),
):
    """
    Upload a file to the document_source directory and automatically build embeddings.
    
    **Supported file types:**
    - PDF (.pdf)
    - Text files (.txt)
    - Word documents (.docx, .doc)
    
    **Maximum file size:** 100MB
    
    **Note:** Filenames will be automatically sanitized to remove special characters,
    spaces will be replaced with underscores, and Unicode characters will be converted to ASCII.
    For example: "Competitive Programmer's Handbook.pdf" becomes "Competitive_Programmers_Handbook.pdf"
    
    The file will be saved in the document_source directory and embeddings will be
    automatically built to include it in the search index.
    """
    try:
        # Validate file extension
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Supported types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Sanitize filename to make it URL-friendly and remove problematic characters
        safe_filename = sanitize_filename(file.filename)
        file_path = DOCUMENT_SOURCE_DIR / safe_filename
        
        # Check if file already exists
        if file_path.exists():
            # Add a number suffix if file exists
            base_name = Path(safe_filename).stem
            extension = Path(safe_filename).suffix
            counter = 1
            while file_path.exists():
                safe_filename = f"{base_name}_{counter}{extension}"
                file_path = DOCUMENT_SOURCE_DIR / safe_filename
                counter += 1
        
        # Stream upload to file
        total_size = 0
        try:
            with open(file_path, "wb") as f:
                while chunk := await file.read(1024 * 1024):  # Read 1MB chunks
                    total_size += len(chunk)
                    
                    # Check file size limit
                    if total_size > MAX_FILE_SIZE:
                        # Delete the partially uploaded file
                        if file_path.exists():
                            file_path.unlink()
                        raise HTTPException(
                            status_code=413,
                            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
                        )
                    
                    f.write(chunk)
        except HTTPException:
            raise
        except Exception as e:
            # Clean up on error
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")
        
        # Get download path for response
        download_path = f"/api/v1/files/download/{safe_filename}"

        # Always rebuild embeddings to include the new file in the search index
        index_result = index_service.build_index()
        indexing_started = index_result.get("success", False)
        
        return UploadResponse(
            message="File uploaded successfully",
            filename=safe_filename,
            filepath=download_path,
            size=total_size,
            indexing_started=indexing_started,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@file_router.delete(
    "/files/{filename}",
    response_model=DeleteResponse,
    summary="Delete File",
    description="Delete a file from the document_source directory",
    responses={
        200: {
            "description": "File deleted successfully",
        },
        404: {"description": "File not found"},
        500: {"description": "Internal server error"},
    },
)
async def delete_file(filename: str):
    """
    Delete a file from the document_source directory.
    
    **Parameters:**
    - **filename**: Name of the file to delete (e.g., "stm32_manual.pdf")
    
    **Note:** After deleting files, you should rebuild the index using build_index.py
    to remove the deleted documents from the search results.
    """
    try:
        # Create safe filename (prevent directory traversal)
        safe_filename = Path(filename).name
        file_path = DOCUMENT_SOURCE_DIR / safe_filename
        
        # Check if file exists
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail=f"File '{safe_filename}' not found"
            )
        
        # Delete the file
        file_path.unlink()
        
        return DeleteResponse(
            message="File deleted successfully",
            filename=safe_filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")


@file_router.get(
    "/files/download/{filename}",
    summary="Download File",
    description="Download a file from the document_source directory",
    responses={
        200: {
            "description": "File downloaded successfully",
            "content": {"application/octet-stream": {}},
        },
        404: {"description": "File not found"},
        500: {"description": "Internal server error"},
    },
)
async def download_file(filename: str):
    """
    Download a file from the document_source directory.
    
    **Parameters:**
    - **filename**: Name of the file to download (e.g., "stm32_manual.pdf")
    
    The file will be sent as an attachment with the original filename.
    Supported file types: PDF, TXT, DOCX, DOC
    """
    try:
        # Create safe filename (prevent directory traversal)
        safe_filename = Path(filename).name
        file_path = DOCUMENT_SOURCE_DIR / safe_filename
        
        # Check if file exists
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail=f"File '{safe_filename}' not found"
            )
        
        # Determine media type based on extension
        media_types = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc": "application/msword",
        }
        
        file_extension = file_path.suffix.lower()
        media_type = media_types.get(file_extension, "application/octet-stream")
        
        # URL-encode the filename for the Content-Disposition header to handle special characters
        from urllib.parse import quote
        encoded_filename = quote(safe_filename)
        
        # Return file as response
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=safe_filename,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")


@file_router.get(
    "/files/view/{filename}",
    summary="View PDF File",
    description="View a PDF file directly in the browser with proper CORS headers for PDF.js",
    responses={
        200: {
            "description": "PDF file returned successfully",
            "content": {"application/pdf": {}},
        },
        404: {"description": "File not found"},
        500: {"description": "Internal server error"},
    },
)
async def view_pdf(filename: str):
    """
    View a PDF file directly in the browser with proper headers for PDF.js.
    
    **Parameters:**
    - **filename**: Name of the PDF file to view (e.g., "stm32_manual.pdf")
    
    This endpoint is specifically designed for viewing PDFs in the browser using PDF.js,
    with appropriate CORS headers and Content-Type.
    """
    try:
        # Create safe filename (prevent directory traversal)
        safe_filename = Path(filename).name
        file_path = DOCUMENT_SOURCE_DIR / safe_filename
        
        # Check if file exists
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail=f"File '{safe_filename}' not found"
            )
        
        # Check if it's a PDF
        if not safe_filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files can be viewed with this endpoint"
            )
        
        # Return PDF file with inline display and CORS headers
        return FileResponse(
            path=str(file_path),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{safe_filename}"',
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "public, max-age=3600",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error viewing PDF: {str(e)}")
