# from transformers import pipeline
# import tempfile
# import os
# import torch
# from pydub import AudioSegment  # make sure pydub is installed
#
# device = 0 if torch.cuda.is_available() else -1
# pipe = pipeline("automatic-speech-recognition", model="openai/whisper-tiny", device=device)
#
# async def speech_to_text(audio_file):
#     try:
#         # Save .webm temporarily
#         with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_webm:
#             webm_path = tmp_webm.name
#             content = await audio_file.read()
#             tmp_webm.write(content)
#
#         # Convert to .wav using pydub
#         audio = AudioSegment.from_file(webm_path, format="webm")
#         wav_path = webm_path.replace(".webm", ".wav")
#         audio.export(wav_path, format="wav")
#         os.remove(webm_path)
#
#         result = pipe(wav_path)
#         os.remove(wav_path)
#
#         return result["text"].strip()
#     except Exception as e:
#         raise ValueError(f"Speech-to-text failed: {str(e)}")

from faster_whisper import WhisperModel
import tempfile
import os
from pydub import AudioSegment
import torch
from datetime import datetime
from app.db.session import db

model_size = "tiny"
model = WhisperModel(model_size, compute_type="float16" if torch.cuda.is_available() else "int8")

async def speech_to_text(audio_file, candidate_id: str, question_id: int, expected_answer: str):
    try:
        # Save webm to temp
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_webm:
            webm_path = tmp_webm.name
            content = await audio_file.read()
            tmp_webm.write(content)

        # Convert webm → wav
        audio = AudioSegment.from_file(webm_path, format="webm")
        wav_path = webm_path.replace(".webm", ".wav")
        audio.export(wav_path, format="wav")
        os.remove(webm_path)

        # Transcribe
        segments, _ = model.transcribe(wav_path, beam_size=5, language="en")
        os.remove(wav_path)

        # Merge segments
        transcription = " ".join([seg.text.strip() for seg in segments]).strip()

        # Store in MongoDB
        db["qa_logs"].update_one(
            {"candidate_id": candidate_id},
            {
                "$push": {
                    "qa_log": {
                        "question_id": question_id,
                        "expected_answer": expected_answer,
                        "user_answer": transcription,
                        "timestamp": datetime.utcnow()
                    }
                }
            },
            upsert=True
        )

        return transcription

    except Exception as e:
        raise ValueError(f"Speech-to-text failed: {str(e)}")
