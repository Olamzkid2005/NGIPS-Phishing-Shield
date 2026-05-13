import logging
import time

import numpy as np

from app.config import ENSEMBLE_WEIGHTS
from app.models.loader import get_loaded_models

logger = logging.getLogger(__name__)


def get_phishing_class_index(model):
    classes = list(model.classes_)
    if 'bad' in classes:
        return classes.index('bad')
    elif 1 in classes:
        return classes.index(1)
    raise ValueError(f"Model classes {classes} do not contain 'bad' or 1")


def predict_url(url: str) -> dict:
    models = get_loaded_models()
    if not models:
        raise RuntimeError("No models loaded — cannot make predictions")

    model_scores: dict[str, float] = {}
    weighted_sum = 0.0
    total_weight = 0.0

    for name, model in models.items():
        try:
            proba = model.predict_proba([url])[0]
            bad_idx = get_phishing_class_index(model)
            phishing_prob = float(proba[bad_idx])
            model_scores[name] = round(phishing_prob, 6)
            weight = ENSEMBLE_WEIGHTS.get(name, 1.0)
            weighted_sum += phishing_prob * weight
            total_weight += weight
        except Exception as e:
            logger.error(f"Prediction failed for model {name}: {e}")

    if total_weight == 0:
        raise RuntimeError("All model predictions failed")

    avg_phishing_prob = weighted_sum / total_weight
    is_phishing = avg_phishing_prob >= 0.5
    confidence = avg_phishing_prob if is_phishing else 1 - avg_phishing_prob

    return {
        "is_phishing": is_phishing,
        "confidence": round(confidence, 6),
        "model_scores": model_scores,
    }
