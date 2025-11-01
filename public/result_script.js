// Filename: result_script.js (V7.8 - Final Version - No Translation)

import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

const ResultApp = {
    elements: {
        resultQuestionTitle: null,
        resultContainer: null,
        returnButton: null,
        nextQuestionButton: null,
        mainPageButton: null
    },
    currentQuestionData: null, 

    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();

        const showAll = sessionStorage.getItem('showAllResults');
        
        if (showAll === 'true') {
            this.displayAllResults();
            sessionStorage.removeItem('showAllResults'); 
        } else {
            const storedData = sessionStorage.getItem('currentQuestionData');
            if (!storedData) {
                this.showError("Error: Quiz question data not found.");
                return;
            }
            try {
                this.currentQuestionData = JSON.parse(storedData);
                this.displaySingleResult(); 
            } catch (error) {
                this.showError(`Error parsing question data: ${error.message}`);
            }
        }
    },

    cacheDOMElements() {
        this.elements.resultQuestionTitle = document.getElementById('result-question-title');
        this.elements.resultContainer = document.getElementById('result-container');
        this.elements.returnButton = document.getElementById('return-btn');
        this.elements.nextQuestionButton = document.getElementById('next-question-btn');
        this.elements.mainPageButton = document.getElementById('main-page-btn');
    },

    setupEventListeners() {
        if (this.elements.returnButton) {
            this.elements.returnButton.addEventListener('click', () => {
                if (this.currentQuestionData) {
                    window.location.href = `quiz.html?questionIndex=${this.currentQuestionData.questionIndex}`;
                } else {
                    window.location.href = 'quiz.html'; 
                }
            });
        }

        if (this.elements.nextQuestionButton) {
            this.elements.nextQuestionButton.addEventListener('click', () => {
                if (this.currentQuestionData) {
                    // (This is the logic you wanted: navigate from Q 0 -> Q 1)
                    window.location.href = `quiz.html?questionIndex=${this.currentQuestionData.questionIndex + 1}`;
                } else {
                    window.location.href = 'quiz.html'; 
                }
            });
        }
        
        if (this.elements.mainPageButton) {
            this.elements.mainPageButton.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
    },

    displaySingleResult() {
        const data = this.currentQuestionData;
        if (!data) return;

        this.elements.returnButton.style.display = 'none';
        this.elements.nextQuestionButton.style.display = 'block';

        this.elements.resultQuestionTitle.textContent = `Question ${data.questionIndex + 1}`;

        const isCorrect = (data.selectedOption === data.correctAnswer);
        const resultClass = isCorrect ? 'correct' : 'incorrect';
        const resultText = isCorrect ? 'Correct!' : 'Incorrect.';

        this.elements.resultContainer.innerHTML = `
            <p class="question-text">${data.question}</p>
            <p class="user-answer">Your Answer: <strong class="${resultClass}">${data.selectedOption}</strong> (${resultText})</p>
            <p class="correct-answer-text">Correct Answer: <strong>${data.correctAnswer}</strong></p>
            <div class="explanation-text">
                <h3>Explanation:</h3>
                ${DOMPurify.sanitize(marked.parse(data.explanation))}
            </div>
        `;
        
        const allQuestions = JSON.parse(sessionStorage.getItem('currentQuizData') || '[]');
        if (data.questionIndex >= allQuestions.length - 1) {
            this.elements.nextQuestionButton.textContent = 'See All Results';
            
            this.elements.nextQuestionButton.onclick = () => {
                sessionStorage.setItem('showAllResults', 'true');
                window.location.reload(); 
            };
        }
    },
    
    displayAllResults() {
        this.elements.returnButton.style.display = 'none';
        this.elements.nextQuestionButton.style.display = 'none';
        this.elements.resultQuestionTitle.textContent = 'Quiz Summary'; 
        
        const allQuestions = JSON.parse(sessionStorage.getItem('currentQuizData') || '[]');
        
        if (allQuestions.length === 0) {
            this.showError("Error: Quiz data not found.");
            return;
        }

        this.elements.resultContainer.innerHTML = ''; 
        
        allQuestions.forEach((questionData, index) => {
            const resultEl = document.createElement('div');
            resultEl.className = 'result-card'; 
            
            resultEl.innerHTML = `
                <p class="question-text" style="color: black;"><strong>Q ${index + 1}: ${questionData.question}</strong></p>
                <p class="correct-answer-text" style="color: black;">Correct Answer: <strong>${questionData.correctAnswer}</strong></p>
                <div class="explanation-text" style="color: black;">
                    <h3>Explanation:</h3>
                    ${DOMPurify.sanitize(marked.parse(questionData.explanation))}
                </div>
            `;
            this.elements.resultContainer.appendChild(resultEl);
        });
    },

    showError(message) {
        console.error(message);
        this.elements.resultContainer.innerHTML = `<p class="loading-text" style="color: red;">${message}</p>`;
        
        if (this.elements.returnButton) this.elements.returnButton.style.display = 'none';
        if (this.elements.nextQuestionButton) this.elements.nextQuestionButton.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ResultApp.init();
});