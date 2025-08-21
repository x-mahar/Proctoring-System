from pymongo import MongoClient
import os
from dotenv import load_dotenv
import logging
from pymongo import errors

# Load environment variables
load_dotenv()

# MongoDB connection string
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

# Connect to MongoDB with short timeouts and verify connectivity
client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)

try:
    # Force a ping to check that MongoDB is reachable
    client.admin.command("ping")
    db = client["proctoring_db"]
except errors.ServerSelectionTimeoutError as e:
    logging.error(f"MongoDB connection failed: {e}")
    db = None

# Collections (you can access these dynamically in your routes)
mongo_collection = db["cheating_logs"] if db is not None else None


def get_db():
    """Return a live MongoDB database handle, reconnecting if needed.

    This allows the API to recover if MongoDB starts after the app.
    Returns None if still unavailable.
    """
    global client, db, MONGO_URL, mongo_collection
    # If we think we're connected, verify with a ping
    if db is not None:
        try:
            client.admin.command("ping")
            return db
        except Exception:
            logging.warning("MongoDB ping failed; attempting to reconnect...")

    try:
        # Refresh URI from environment in case it changed
        MONGO_URL = os.getenv("MONGO_URL", MONGO_URL)
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
        client.admin.command("ping")
        db = client["proctoring_db"]
        mongo_collection = db["cheating_logs"]
        logging.info("MongoDB reconnected successfully.")
        return db
    except Exception as e:
        logging.error(f"MongoDB reconnection failed: {e}")
        db = None
        mongo_collection = None
        return None
