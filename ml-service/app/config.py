import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

MODEL_FILES = {
    "logistic_regression": MODELS_DIR / "logistic_regression_pipeline.pkl",
    "multinomial_nb": MODELS_DIR / "multinomial_nb_pipeline.pkl",
}

ML_SERVICE_HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
ML_SERVICE_PORT = int(os.getenv("ML_SERVICE_PORT", "8001"))
ENSEMBLE_WEIGHTS = {"logistic_regression": 0.6, "multinomial_nb": 0.4}
