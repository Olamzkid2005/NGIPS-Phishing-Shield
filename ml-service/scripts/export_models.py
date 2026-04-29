import os
import pandas as pd
import joblib
from nltk.tokenize import RegexpTokenizer
from nltk.stem.snowball import SnowballStemmer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB


class URLTokenizer:
    def __init__(self):
        self.tokenizer = RegexpTokenizer(r'[A-Za-z]+')
        self.stemmer = SnowballStemmer("english")

    def __call__(self, text):
        tokens = self.tokenizer.tokenize(text)
        return [self.stemmer.stem(word) for word in tokens]


def get_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def load_dataset():
    project_root = get_project_root()
    csv_path = os.path.join(project_root, 'Dataset', 'phishing_site_urls Combined.csv')
    print(f"Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=['URL', 'Label'])
    df['URL'] = df['URL'].astype(str)
    df = df[df['URL'].str.strip() != '']
    print(f"Dataset loaded: {len(df)} rows")
    return df


def train_and_export_models(df):
    custom_tokenizer = URLTokenizer()

    trainX, testX, trainY, testY = train_test_split(
        df['URL'], df['Label'], test_size=0.2, random_state=42
    )

    print("\nTraining Logistic Regression pipeline...")
    lr_pipeline = make_pipeline(
        CountVectorizer(tokenizer=custom_tokenizer, stop_words='english'),
        LogisticRegression(max_iter=1000)
    )
    lr_pipeline.fit(trainX, trainY)
    lr_train_acc = lr_pipeline.score(trainX, trainY)
    lr_test_acc = lr_pipeline.score(testX, testY)
    print(f"Logistic Regression - Training Accuracy: {lr_train_acc:.4f}")
    print(f"Logistic Regression - Testing Accuracy: {lr_test_acc:.4f}")

    print("\nTraining MultinomialNB pipeline...")
    nb_pipeline = make_pipeline(
        CountVectorizer(tokenizer=custom_tokenizer, stop_words='english'),
        MultinomialNB()
    )
    nb_pipeline.fit(trainX, trainY)
    nb_train_acc = nb_pipeline.score(trainX, trainY)
    nb_test_acc = nb_pipeline.score(testX, testY)
    print(f"MultinomialNB - Training Accuracy: {nb_train_acc:.4f}")
    print(f"MultinomialNB - Testing Accuracy: {nb_test_acc:.4f}")

    return lr_pipeline, nb_pipeline, lr_test_acc, nb_test_acc


def export_models(lr_pipeline, nb_pipeline):
    project_root = get_project_root()
    models_dir = os.path.join(project_root, 'ml-service', 'models')
    os.makedirs(models_dir, exist_ok=True)

    lr_path = os.path.join(models_dir, 'logistic_regression_pipeline.pkl')
    nb_path = os.path.join(models_dir, 'multinomial_nb_pipeline.pkl')

    joblib.dump(lr_pipeline, lr_path)
    joblib.dump(nb_pipeline, nb_path)

    print(f"\nModels exported to:")
    print(f"  {lr_path}")
    print(f"  {nb_path}")

    return lr_path, nb_path


def main():
    print("=" * 60)
    print("Phishing Shield - Model Export Script")
    print("=" * 60)

    df = load_dataset()

    lr_pipeline, nb_pipeline, lr_acc, nb_acc = train_and_export_models(df)

    lr_path, nb_path = export_models(lr_pipeline, nb_pipeline)

    print("\n" + "=" * 60)
    print("Model Training Summary")
    print("=" * 60)
    print(f"Logistic Regression Pipeline Accuracy: {lr_acc:.4f}")
    print(f"MultinomialNB Pipeline Accuracy: {nb_acc:.4f}")
    print(f"\nExported Files:")
    print(f"  - {os.path.basename(lr_path)}")
    print(f"  - {os.path.basename(nb_path)}")
    print("=" * 60)


if __name__ == '__main__':
    main()