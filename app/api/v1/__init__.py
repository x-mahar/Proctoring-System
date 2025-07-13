from fastapi import APIRouter
from app.api.v1.endpoints import frames, register, status, questions

api_router = APIRouter()

api_router.include_router(register.router, prefix="/register")
api_router.include_router(frames.router, prefix="/frames")
api_router.include_router(status.router, prefix="/status")
api_router.include_router(questions.router, prefix="/questions", tags=["Questions"])