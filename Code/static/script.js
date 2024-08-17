document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const resultDiv = document.querySelector('.result');

    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();  // Prevents the default form submission
            showLoadingBar();
            setTimeout(() => form.submit(), 4000);  // Delays submission to show the loading bar
        });
    }

    if (resultDiv) {
        stylePrediction();
    }
});

function showLoadingBar() {
    const container = document.querySelector('.container');
    const loadingBar = document.createElement('div');
    loadingBar.className = 'loading-bar';
    container.appendChild(loadingBar);

    let width = 0;
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
        } else {
            width++;
            loadingBar.style.width = width + '%';
        }
    }, 20);
}

function stylePrediction() {
    const predictionElement = document.querySelector('.result h2');
    if (predictionElement) {
        console.log('Prediction Element Found:', predictionElement.textContent);
        const predictionText = predictionElement.textContent.toLowerCase();
        if (predictionText.includes('bad')) {
            predictionElement.style.color = 'red';
            predictionElement.style.textTransform = 'uppercase';
        } else if (predictionText.includes('good')) {
            predictionElement.style.color = 'green';
            predictionElement.style.textTransform = 'uppercase';
        }
    } else {
        console.log('Prediction Element Not Found');
    }
}

