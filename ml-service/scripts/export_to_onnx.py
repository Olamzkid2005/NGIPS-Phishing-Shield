import os
import re
import sys
import json
import joblib
import numpy as np
from nltk.tokenize import RegexpTokenizer
from nltk.stem.snowball import SnowballStemmer

from skl2onnx import convert_sklearn, to_onnx
from skl2onnx.common.data_types import StringTensorType, FloatTensorType


class URLTokenizer:
    """Must be defined at module level so joblib can unpickle pipeline objects
    that were serialized with this tokenizer as __main__.URLTokenizer."""
    def __init__(self):
        self.tokenizer = RegexpTokenizer(r'[A-Za-z]+')
        self.stemmer = SnowballStemmer("english")

    def __call__(self, text):
        tokens = self.tokenizer.tokenize(text)
        return [self.stemmer.stem(word) for word in tokens]


def get_models_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models'))


def load_pipeline(name):
    models_dir = get_models_dir()
    path = os.path.join(models_dir, f'{name}_pipeline.pkl')
    if not os.path.exists(path):
        print(f"ERROR: Model file not found: {path}")
        sys.exit(1)
    print(f"Loading pipeline from: {path}")
    return joblib.load(path)


def convert_full_pipeline(pipeline, name):
    """Try converting the full sklearn pipeline to ONNX."""
    initial_type = [('input', StringTensorType([None, 1]))]
    options = {id(pipeline): {'zipmap': False}}

    print(f"  Attempting full pipeline conversion for {name}...")
    try:
        onnx_model = convert_sklearn(
            pipeline,
            initial_types=initial_type,
            target_opset=12,
            options=options,
        )
        print(f"  Full pipeline conversion succeeded for {name}")
        return onnx_model
    except Exception as e:
        print(f"  Full pipeline conversion failed: {e}")
        return None


def convert_with_explicit_tokenizer(pipeline, name):
    """
    Fallback: extract CountVectorizer vocab and classifier,
    rebuild a pipeline using sklearn's built-in tokenizer,
    then convert.
    """
    from sklearn.feature_extraction.text import CountVectorizer
    from sklearn.pipeline import make_pipeline
    import re

    print(f"  Attempting conversion with built-in tokenizer for {name}...")

    # Extract the CountVectorizer and classifier from the pipeline
    steps = pipeline.steps
    vectorizer = None
    classifier = None
    for step_name, step_obj in steps:
        if isinstance(step_obj, CountVectorizer):
            vectorizer = step_obj
        else:
            classifier = step_obj

    if vectorizer is None or classifier is None:
        print(f"  ERROR: Could not extract vectorizer and classifier from pipeline")
        return None

    # Extract the fitted vocabulary from the original vectorizer
    vocabulary = vectorizer.vocabulary_

    # Rebuild a CountVectorizer that uses a plain regex tokenizer
    # WARNING: This drops SnowballStemmer, causing training-serving skew.
    # Stemming changes token counts, which changes the feature vector.
    # ONNX export is experimental — use .pkl for production inference.
    def simple_tokenizer(text):
        return re.findall(r'[A-Za-z]+', text)

    new_vectorizer = CountVectorizer(
        vocabulary=vocabulary,
        tokenizer=simple_tokenizer,
        stop_words=None,
        lowercase=True,
    )

    new_pipeline = make_pipeline(new_vectorizer, classifier)

    initial_type = [('input', StringTensorType([None, 1]))]
    options = {id(new_pipeline): {'zipmap': False}}

    try:
        onnx_model = convert_sklearn(
            new_pipeline,
            initial_types=initial_type,
            target_opset=12,
            options=options,
        )
        print(f"  Built-in tokenizer conversion succeeded for {name}")
        return onnx_model
    except Exception as e:
        print(f"  Built-in tokenizer conversion failed: {e}")
        return None


def convert_classifier_only(pipeline, name):
    """
    Last resort: convert only the classifier part.
    Vectorization must be handled in Node.js.
    """
    print(f"  Attempting classifier-only conversion for {name}...")

    steps = pipeline.steps
    classifier = steps[-1][1]

    # Create a dummy numeric input for the classifier
    n_features = classifier.coef_.shape[1] if hasattr(classifier, 'coef_') else classifier.feature_count_.shape[1]

    try:
        onnx_model = convert_sklearn(
            classifier,
            initial_types=[('features', FloatTensorType([None, n_features]))],
            target_opset=12,
            options={id(classifier): {'zipmap': False}},
        )
        print(f"  Classifier-only conversion succeeded for {name}")
        return onnx_model
    except Exception as e:
        print(f"  Classifier-only conversion failed: {e}")
        return None


def save_onnx_model(onnx_model, name):
    models_dir = get_models_dir()
    output_path = os.path.join(models_dir, f'{name}.onnx')
    with open(output_path, 'wb') as f:
        f.write(onnx_model.SerializeToString())
    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Saved: {output_path} ({size_kb:.1f} KB)")
    return output_path


def export_vocabulary_metadata(pipeline, name):
    """Export vocabulary and stop words as JSON for Node.js vectorization."""
    from sklearn.feature_extraction.text import CountVectorizer

    models_dir = get_models_dir()

    # Extract the CountVectorizer from the pipeline
    vectorizer = None
    classifier = None
    for step_name, step_obj in pipeline.steps:
        if isinstance(step_obj, CountVectorizer):
            vectorizer = step_obj
        else:
            classifier = step_obj

    if vectorizer is None:
        print(f"  WARNING: No CountVectorizer found in {name} pipeline")
        return

    # Build vocabulary JSON: {word: index}
    vocab = vectorizer.vocabulary_
    stop_words = list(vectorizer.stop_words_) if hasattr(vectorizer, 'stop_words_') and vectorizer.stop_words_ else []

    # Get expected feature count
    n_features = classifier.coef_.shape[1] if hasattr(classifier, 'coef_') else classifier.feature_count_.shape[1]

    metadata = {
        "vocabulary": vocab,
        "stop_words": stop_words,
        "n_features": n_features,
        "model_name": name,
    }

    output_path = os.path.join(models_dir, f'{name}_vocab.json')
    with open(output_path, 'w') as f:
        json.dump(metadata, f)
    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Vocabulary metadata saved: {output_path} ({size_kb:.1f} KB)")
    print(f"    Vocabulary size: {len(vocab)} words")
    print(f"    Stop words: {len(stop_words)} words")
    print(f"    Expected features: {n_features}")


def export_model(pipeline, name):
    print(f"\n{'='*60}")
    print(f"Exporting: {name}")
    print(f"{'='*60}")

    # Strategy 1: try full pipeline conversion
    onnx_model = convert_full_pipeline(pipeline, name)
    strategy = "full_pipeline"

    # Strategy 2: try with explicit built-in tokenizer
    if onnx_model is None:
        onnx_model = convert_with_explicit_tokenizer(pipeline, name)
        strategy = "built_in_tokenizer"

    # Strategy 3: classifier only
    if onnx_model is None:
        onnx_model = convert_classifier_only(pipeline, name)
        strategy = "classifier_only"

    if onnx_model is None:
        print(f"  FAILED: All conversion strategies exhausted for {name}")
        return False

    output_path = save_onnx_model(onnx_model, name)

    # Always export vocabulary metadata for Node.js vectorization
    export_vocabulary_metadata(pipeline, name)

    print(f"  Strategy used: {strategy}")
    return True


def main():
    print("=" * 60)
    print("Phishing Shield - ONNX Export Script")
    print("=" * 60)

    models = {
        'logistic_regression': load_pipeline('logistic_regression'),
        'multinomial_nb': load_pipeline('multinomial_nb'),
    }

    results = {}
    for name, pipeline in models.items():
        results[name] = export_model(pipeline, name)

    print(f"\n{'='*60}")
    print("Export Summary")
    print(f"{'='*60}")
    for name, success in results.items():
        status = "SUCCESS" if success else "FAILED"
        print(f"  {name}: {status}")

    models_dir = get_models_dir()
    print(f"\nOutput directory: {models_dir}")

    # List all .onnx files with sizes
    print(f"\nGenerated ONNX files:")
    for f in sorted(os.listdir(models_dir)):
        if f.endswith('.onnx'):
            size_kb = os.path.getsize(os.path.join(models_dir, f)) / 1024
            print(f"  {f} ({size_kb:.1f} KB)")

    all_success = all(results.values())
    print(f"\nOverall: {'ALL SUCCESS' if all_success else 'SOME FAILED'}")
    return 0 if all_success else 1


if __name__ == '__main__':
    main()
