import logging
from typing import Optional

import joblib

from app.config import MODEL_FILES

logger = logging.getLogger(__name__)

_loaded_models: dict[str, object] = {}


def load_all_models() -> dict[str, object]:
    global _loaded_models
    for name, path in MODEL_FILES.items():
        if not path.exists():
            logger.warning(f"Model file not found: {path} — skipping {name}")
            continue
        try:
            model = joblib.load(path)
            _loaded_models[name] = model
            logger.info(f"Loaded model: {name} from {path}")
        except Exception as e:
            logger.error(f"Failed to load model {name} from {path}: {e}")
    if not _loaded_models:
        logger.error("No models were loaded. Service will run in degraded mode.")
    return _loaded_models


def get_loaded_models() -> dict[str, object]:
    return dict(_loaded_models)


def get_model(name: str) -> Optional[object]:
    return _loaded_models.get(name)
