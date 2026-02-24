"""
Gunicorn entry point — runs DB init and scheduler once before any workers fork.
"""
from app import app, start_scheduler
from database import init_db

init_db()
start_scheduler()
