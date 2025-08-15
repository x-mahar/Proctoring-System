import sys
import os
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)


# Add the base path (where 'app/' exists) to PYTHONPATH
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)



from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


# ✅ Correct import from app/api/v1/__init__.py
from app.api.v1 import api_router

# Initialize FastAPI app
app = FastAPI(
    title="Proctoring API",
    description="API for detecting head pose and tracking cheating behavior during online exams.",
    version="1.0.0"
)

# ✅ Enable CORS (open for dev; restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:63342",
        "http://127.0.0.1:63342",
        "http://localhost:8000"
    ],# Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Register all versioned API endpoints
app.include_router(api_router, prefix="/api/v1")
app.openapi_schema = None


# ✅ Health check route
@app.get("/", tags=["System"])
def root():
    return {"message": "Proctoring system backend is live!"}

# Serve static files (like HTML, JS, CSS)
app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/")
def get_frontend():
    return FileResponse("frontend/index.html")