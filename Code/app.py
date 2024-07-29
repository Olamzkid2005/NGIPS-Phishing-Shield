from flask import Flask, request, render_template
import joblib
import os

app = Flask(__name__)

# Load the phishing detection model
model_path = 'phishing_model.pkl'
if os.path.exists(model_path):
    model = joblib.load(model_path)
else:
    model = None

def predict_phishing(url):
    if model:
        prediction = model.predict([url])
        return 'Phishing' if prediction[0] == 1 else 'Legitimate'
    else:
        return 'Model not loaded'

@app.route('/', methods=['GET', 'POST'])
def index():
    prediction = None
    if request.method == 'POST':
        url = request.form['url']
        prediction = predict_phishing(url)
    return render_template('index.html', prediction=prediction)

if __name__ == '__main__':
    app.run(debug=True)
