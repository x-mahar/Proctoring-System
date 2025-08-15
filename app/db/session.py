from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection string
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

# Connect to MongoDB
client = MongoClient(MONGO_URL)

# Select database
db = client["proctoring_db"]

# Collections (you can access these dynamically in your routes)
mongo_collection = db["cheating_logs"]
