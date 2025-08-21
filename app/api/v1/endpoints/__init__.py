from fastapi import APIRouter
from app.api.v1.endpoints import candidates, frames, register, status, questions

router = APIRouter()
router.include_router(register.router, tags=["Register"])
router.include_router(frames.router, tags=["Frames"])
