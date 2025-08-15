# 🎓 AI-Based Proctoring System

A production-ready, AI-powered proctoring system built with FastAPI and MongoDB that ensures secure and automated test-taking through real-time webcam analysis, cheating detection, speech-to-text answering, and result evaluation.

---

## 🚀 Features

- ✅ Candidate registration with auto-generated ID
- 🎥 Real-time webcam monitoring
  - Head pose estimation (via MediaPipe)
  - Phone/multiple person detection (via YOLOv5)
- 🎤 Voice-based answering with STT (Faster-Whisper)
- 📊 Answer evaluation with sentence similarity
- 🕵️ Cheating detection
  - Face not detected
  - Looking away for >3 seconds
  - Mobile phone / multiple faces
  - Tab switch / minimize detection
- 🧠 Live transcription display and re-record option
- 📝 Final result logging to MongoDB
- 📁 Cheating logs in CSV
- 🌐 Simple and responsive frontend dashboard
- ☁️ Screen recording with cloud storage (AWS/GCS ready)

---

## 🧱 Tech Stack

| Layer       | Tech                     |
|-------------|--------------------------|
| Backend     | FastAPI, Python          |
| Frontend    | HTML, JS, CSS            |
| Database    | MongoDB (NoSQL)          |
| AI Models   | MediaPipe, YOLOv5, Faster-Whisper, SentenceTransformer |
| Cloud (Optional) | AWS S3 or Google Cloud Storage |

---

## 📂 Project Structure

procting_app/
│
├── app/
│ ├── api/v1/endpoints/ # FastAPI routes (register, frames, questions)
│ ├── core/ # Configuration settings
│ ├── db/ # MongoDB session and models
│ ├── utils/ # STT, YOLO, MediaPipe, face crop, etc.
│ └── logs/ # cheating_logs.csv
│
├── models/ # Pydantic models and schemas
├── static/ # Frontend HTML, CSS, JS files
├── main.py # FastAPI entrypoint
├── requirements.txt
└── README.md

yaml
Copy code

---

## 🏁 Getting Started

### 1️⃣ Clone the repository
```bash
git clone https://github.com/your-username/proctoring-system.git
cd proctoring-system
2️⃣ Setup a virtual environment
bash
Copy code
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
3️⃣ Install dependencies
bash
Copy code
pip install -r requirements.txt
4️⃣ Setup MongoDB
Use local MongoDB or MongoDB Atlas

Update connection URI in .env:

ini
Copy code
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "proctoring_db"
5️⃣ Run the application
bash
Copy code
uvicorn main:app --reload
Then visit: http://localhost:8000 to access the frontend.

🌍 API Endpoints
Method	Endpoint	Description
POST	/api/v1/register	Register candidate with name
POST	/api/v1/frames	Process webcam frame (YOLO + MediaPipe)
POST	/api/v1/questions/stt_only	Convert audio to text
POST	/api/v1/questions/submit_answer	Submit answer for evaluation
POST	/api/v1/questions/get_result	Fetch final score + remarks
POST	/api/v1/questions/screen_record	Upload screen recording

💾 Logging
MongoDB:

Candidate details

QA responses and scores

Final test result

CSV:

cheating_logs.csv only contains cheating incidents (timestamped)

☁️ Cloud Storage (Optional)
To store screen recordings in cloud:

AWS S3

Create S3 bucket

Add AWS credentials to .env

Use boto3 to upload videos from backend

📸 Screenshots
<p align="center"> <img src="Screenshot (218).png" width="400"> <img src="Screenshot (219).png" width="400"><br> <img src="Screenshot (220).png" width="400"> <img src="Screenshot (221).png" width="400"><br> <img src="Screenshot (222).png" width="400"> <img src="Screenshot (223).png" width="400"><br> <img src="Screenshot (224).png" width="400"> <img src="Screenshot (225).png" width="400"><br> <img src="Screenshot (226).png" width="400"> <img src="Screenshot (227).png" width="400"><br> <img src="Screenshot (228).png" width="400"> <img src="Screenshot (229).png" width="400"><br> <img src="Screenshot (230).png" width="400"> <img src="Screenshot (231).png" width="400"><br> <img src="Screenshot (232).png" width="400"> <img src="Screenshot (233).png" width="400"><br> <img src="Screenshot (234).png" width="400"> </p>
👨‍💻 Contributors
Developer: Nitin

Institution: Ganga Institute of Technology and Management

yaml
Copy code

---

This layout:  
- Shows **two images per row**  
- Centers them  
- Resizes them so they don’t overflow the page  
- Works perfectly when viewed on GitHub  

If your screenshots are inside a folder (e.g., `assets/`), just change each path from:
<img src="Screenshot (218).png" width="400"> ``` to: ``` <img src="assets/Screenshot (218).png" width="400"> 