# STM32 Manual Search API

FastAPI-based REST API for searching STM32 manual documentation using vector embeddings and ChromaDB.

## Project Structure

```
python_be/
├── main.py                 # FastAPI application entry point
├── run.py                  # Development server runner
├── config.py               # Configuration settings
├── requirements.txt        # Python dependencies
├── environment.yml         # Conda environment specification
├── .env           # Example environment variables
├── api/
│   ├── __init__.py
│   └── routes.py          # API route definitions
├── services/
│   ├── __init__.py
│   └── search_service.py  # Search business logic
├── build_index.py         # Script to build the vector index
├── search_index.py        # Standalone search script
└── chroma_stm32/          # ChromaDB persistent storage
```

## Setup

### 1. Install Dependencies

#### Using conda (recommended):

**On Windows:**
```powershell
# Navigate to the python_be directory
cd python_be

# Create conda environment with Python 3.11
conda create -n ai_class python=3.11 -y

# Activate the environment
conda activate ai_class

# Install dependencies
pip install -r requirements.txt
```

**On Linux/macOS:**
```bash
conda env create -f environment.yml
conda activate ai_class
```

#### Or using pip:
```bash
pip install -r requirements.txt
```

> **Note for Windows users:** The `environment.yml` file contains Linux-specific packages that are not available on Windows. Use the conda + pip approach shown above instead.

### 2. Build the Index

Before running the API, you need to build the vector index from your PDF documents:

**On Windows:**
```powershell
# Make sure conda environment is activated and you're in python_be directory
conda activate ai_class
py build_index.py
```

**On Linux/macOS:**
```bash
python build_index.py
```

Make sure you have PDF files in the `document_source/` directory.

### 3. Configure Environment (Optional)

Copy the example environment file and modify as needed:

**On Windows (PowerShell):**
```powershell
Copy-Item .env .env
```

**On Linux/macOS:**
```bash
cp .env .env
```

**To test AI chat and function calling**
Edit sample API key with your actual API key in python_be/services/chat_service.py

## Running the API

> **Important for Windows users:** Always activate the conda environment first with `conda activate ai_class` and ensure you're in the `python_be` directory before running the commands below.

### Development Mode

**On Windows:**
```powershell
# Make sure you're in python_be directory with ai_class environment activated
py run.py
# Or directly with uvicorn:
py -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**On Linux/macOS:**
```bash
python run.py
# Or directly with uvicorn:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

**On Windows:**
```powershell
py -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

**On Linux/macOS:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Root Endpoint
- **GET** `/`
  - Returns API information

### Health Check
- **GET** `/health`
  - Returns health status

### Chat endpoint
- **POST** `/api/v1/chat/chat`
  - Call AzureOpenAI API with sample function calling (search document)

### File Management

#### List Files
- **GET** `/api/v1/files`
  - List all files in the document_source directory
  - Response:
    ```json
    {
      "files": [
        {
          "filename": "stm32_manual.pdf",
          "filepath": "/api/v1/files/download/stm32_manual.pdf",
          "size": 2048576,
          "extension": ".pdf"
        }
      ],
      "total_files": 1
    }
    ```
  - The `filepath` field contains the download URL for each file

#### Upload File
- **POST** `/api/v1/files/upload`
  - Upload a file to the document_source directory
  - Supports streaming upload for large files
  - Allowed file types: `.pdf`, `.txt`, `.docx`, `.doc`
  - Maximum file size: 100MB
  - Request: `multipart/form-data` with file field
  - **Filename Sanitization**: Filenames are automatically cleaned:
    - Unicode characters converted to ASCII
    - Special characters removed
    - Spaces replaced with underscores
    - Example: `"Competitive Programmer's Handbook.pdf"` → `"Competitive_Programmers_Handbook.pdf"`
  - If a file with the same name exists, a number suffix is added (e.g., `file_1.pdf`, `file_2.pdf`)
  - Response:
    ```json
    {
      "message": "File uploaded successfully",
      "filename": "stm32_manual.pdf",
      "filepath": "/api/v1/files/download/stm32_manual.pdf",
      "size": 2048576
    }
    ```
  - The `filepath` field contains the download URL for the uploaded file

#### Delete File
- **DELETE** `/api/v1/files/{filename}`
  - Delete a file from the document_source directory
  - Response:
    ```json
    {
      "message": "File deleted successfully",
      "filename": "stm32_manual.pdf"
    }
    ```

#### Download File
- **GET** `/api/v1/files/download/{filename}`
  - Download a file from the document_source directory
  - Returns the file as an attachment
  - Supports: PDF, TXT, DOCX, DOC files
  - Example: `GET /api/v1/files/download/stm32_manual.pdf`

### Search Manual
- **POST** `/api/v1/search`
  - Search the STM32 manual documentation
  - Request body:
    ```json
    {
      "query": "Low-power mode wakeup timings",
      "k": 5
    }
    ```
  - Response:
    ```json
    {
      "query": "Low-power mode wakeup timings",
      "results": [
        {
          "id": "chunk_123",
          "text": "...",
          "page": 45,
          "source": "stm32_manual.pdf",
          "score": 0.234
        }
      ],
      "total_results": 5
    }
    ```

### Collection Statistics
- **GET** `/api/v1/collection/stats`
  - Get statistics about the document collection
  - Response:
    ```json
    {
      "total_chunks": 1250,
      "collection_name": "stm32_manual_embedding",
      "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
      "sources": ["stm32_manual.pdf"]
    }
    ```

### Index Building (NEW!)

#### Build Index (Asynchronous)
- **POST** `/api/v1/index/build`
  - Build the search index from all PDFs in document_source directory
  - Runs in the background, returns immediately
  - Response:
    ```json
    {
      "success": true,
      "message": "Indexing started in background. Use /index/status to check progress."
    }
    ```

#### Build Index (Synchronous)
- **POST** `/api/v1/index/build/sync`
  - Build the search index and wait for completion
  - May take several minutes for large documents
  - Response:
    ```json
    {
      "success": true,
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
    ```

#### Get Index Status
- **GET** `/api/v1/index/status`
  - Check the status of background indexing operation
  - Response:
    ```json
    {
      "is_running": false,
      "last_result": {
        "success": true,
        "message": "Index built successfully",
        "total_chunks": 1250
      },
      "progress": null
    }
    ```

## Interactive API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Example Usage

### Complete Workflow (NEW!)

Here's a complete workflow using the new API endpoints:

#### 1. Upload a document
**Using curl (Windows PowerShell):**
```powershell
curl.exe -X POST "http://localhost:8000/api/v1/files/upload" `
  -F "file=@C:\path\to\stm32_manual.pdf"
```

#### 2. Build the index via API
**Using curl (Windows PowerShell):**
```powershell
# Start indexing in background
curl.exe -X POST "http://localhost:8000/api/v1/index/build"

# Check status
curl.exe http://localhost:8000/api/v1/index/status

# OR build synchronously (waits for completion)
curl.exe -X POST "http://localhost:8000/api/v1/index/build/sync"
```

**Using Python:**
```python
import requests
import time

# Start indexing
response = requests.post("http://localhost:8000/api/v1/index/build")
print(response.json())

# Check status periodically
while True:
    status = requests.get("http://localhost:8000/api/v1/index/status")
    data = status.json()
    print(f"Indexing running: {data['is_running']}")
    
    if not data['is_running'] and data['last_result']:
        print("Indexing complete!")
        print(data['last_result'])
        break
    
    time.sleep(2)  # Wait 2 seconds before checking again
```

#### 3. Search the documentation
**Using curl (Windows PowerShell):**
```powershell
curl.exe -X POST "http://localhost:8000/api/v1/search" `
  -H "Content-Type: application/json" `
  -d '{\"query\": \"GPIO configuration\", \"k\": 3}'
```

**Using Python:**
```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/search",
    json={"query": "GPIO configuration", "k": 3}
)

results = response.json()
print(f"Query: {results['query']}")
print(f"Found {results['total_results']} results:\n")

for result in results['results']:
    print(f"Score: {result['score']:.4f}")
    print(f"Source: {result['source']}, Page: {result['page']}")
    print(f"Text: {result['text'][:200]}...")
    print("-" * 80)
```

### File Management

#### List all files
**Using curl (Windows PowerShell):**
```powershell
curl.exe http://localhost:8000/api/v1/files
```

**Using Python:**
```python
import requests

response = requests.get("http://localhost:8000/api/v1/files")
print(response.json())
```

#### Upload a file
**Using curl (Windows PowerShell):**
```powershell
curl.exe -X POST "http://localhost:8000/api/v1/files/upload" `
  -F "file=@C:\path\to\your\document.pdf"
```

**Using Python:**
```python
import requests

with open("document.pdf", "rb") as f:
    files = {"file": ("document.pdf", f, "application/pdf")}
    response = requests.post(
        "http://localhost:8000/api/v1/files/upload",
        files=files
    )
print(response.json())
```

#### Delete a file
**Using curl (Windows PowerShell):**
```powershell
curl.exe -X DELETE "http://localhost:8000/api/v1/files/document.pdf"
```

**Using Python:**
```python
import requests

response = requests.delete(
    "http://localhost:8000/api/v1/files/document.pdf"
)
print(response.json())
```

#### Download a file
**Using curl (Windows PowerShell):**
```powershell
# Download and save to current directory
curl.exe -o "downloaded_file.pdf" "http://localhost:8000/api/v1/files/download/document.pdf"
```

**Using Python:**
```python
import requests

response = requests.get(
    "http://localhost:8000/api/v1/files/download/document.pdf"
)

# Save the file
with open("downloaded_file.pdf", "wb") as f:
    f.write(response.content)
print("File downloaded successfully")
```

**Using browser:**
Simply navigate to: `http://localhost:8000/api/v1/files/download/document.pdf`

### Search Operations

#### Using curl

**On Windows (PowerShell):**
```powershell
curl.exe -X POST "http://localhost:8000/api/v1/search" `
  -H "Content-Type: application/json" `
  -d '{\"query\": \"Low-power mode wakeup timings\", \"k\": 3}'
```

**On Linux/macOS:**
```bash
curl -X POST "http://localhost:8000/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "Low-power mode wakeup timings", "k": 3}'
```

### Using Python requests
```python
import requests

# Search example
response = requests.post(
    "http://localhost:8000/api/v1/search",
    json={"query": "Low-power mode wakeup timings", "k": 3}
)
print(response.json())
```

### Using JavaScript fetch
```javascript
fetch('http://localhost:8000/api/v1/search', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    query: 'Low-power mode wakeup timings',
    k: 3
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

## Configuration

The API can be configured through environment variables or the `.env` file:

- `APP_NAME`: Application name (default: "STM32 Manual Search API")
- `APP_VERSION`: Application version (default: "1.0.0")
- `DEBUG`: Enable debug mode (default: False)
- `HOST`: Server host (default: "0.0.0.0")
- `PORT`: Server port (default: 8000)
- `CHROMA_DIR`: ChromaDB directory (default: "./chroma_stm32")
- `COLLECTION_NAME`: Collection name (default: "stm32_manual_embedding")
- `EMBEDDING_MODEL_NAME`: Embedding model (default: "sentence-transformers/all-MiniLM-L6-v2")
- `CORS_ORIGINS`: Allowed CORS origins (default: "*")

## Features

- ✅ RESTful API with FastAPI
- ✅ Vector similarity search using sentence transformers
- ✅ ChromaDB for persistent storage
- ✅ Automatic API documentation (Swagger/ReDoc)
- ✅ CORS support for frontend integration
- ✅ Configurable via environment variables
- ✅ Health check endpoint
- ✅ Collection statistics endpoint
- ✅ Pydantic models for request/response validation

## Technology Stack

- **FastAPI**: Modern web framework for building APIs
- **ChromaDB**: Vector database for embeddings
- **Sentence Transformers**: For generating text embeddings
- **Uvicorn**: ASGI server for running FastAPI
- **Pydantic**: Data validation and settings management

## License

See project root for license information.
