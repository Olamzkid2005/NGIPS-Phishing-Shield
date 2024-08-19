document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const resultDiv = document.querySelector('.result');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const steps = document.querySelectorAll('#progress-steps li');

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            showProgress();
            showLoadingBar();
            await simulateProgress();
            await delaySubmission(form, 4000);
        });
    }

    if (resultDiv) {
        stylePrediction();
    }
});

function showProgress() {
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'block';
}

async function simulateProgress() {
    const steps = [
        { id: 'step-tokenization', duration: 1000 },
        { id: 'step-feature-extraction', duration: 1000 },
        { id: 'step-stemmization', duration: 1000 },
        { id: 'step-detection', duration: 1000 },
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepElement = document.getElementById(step.id);
        stepElement.classList.add('completed');

        updateProgressBar((i + 1) / steps.length * 100);
        await delay(step.duration);
    }
}

function updateProgressBar(percentage) {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${percentage}%`;
}

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
            loadingBar.style.width = `${width}%`;
        }
    }, 20);
}

function stylePrediction() {
    const predictionElement = document.querySelector('.result h2');
    if (predictionElement) {
        const predictionText = predictionElement.textContent.toLowerCase();
        if (predictionText.includes('bad')) {
            predictionElement.style.color = 'red';
            predictionElement.style.textTransform = 'uppercase';
        } else if (predictionText.includes('good')) {
            predictionElement.style.color = 'green';
            predictionElement.style.textTransform = 'uppercase';
        }
    }
}

async function delaySubmission(form, ms) {
    await delay(ms);
    form.submit();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
