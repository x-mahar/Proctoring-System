from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer("all-MiniLM-L6-v2")

def evaluate_answer(user_answer: str, expected_answer: str) -> bool:
    embeddings = model.encode([user_answer, expected_answer], convert_to_tensor=True)
    similarity = util.cos_sim(embeddings[0], embeddings[1]).item()

    print(f"Similarity score: {similarity:.2f}")  # Debug

    # Threshold for correctness
    return similarity > 0.7
