import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

const ResultApp = {
    elements: {
        resultQuestionTitle: null,
        resultContainer: null,
        returnButton: null,
        nextQuestionButton: null,
    },
    currentQuestionData: null, // 从 sessionStorage 获取的当前题目数据

    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();

        // 从 sessionStorage 获取当前题目数据和用户选择
        const storedData = sessionStorage.getItem('currentQuestionData');
        if (!storedData) {
            this.showError("错误：未找到测验题目数据。");
            return;
        }

        try {
            this.currentQuestionData = JSON.parse(storedData);
            this.displayResult(); // 显示结果
        } catch (error) {
            this.showError(`解析题目数据时出错: ${error.message}`);
        }
    },

    cacheDOMElements() {
        this.elements.resultQuestionTitle = document.getElementById('result-question-title');
        this.elements.resultContainer = document.getElementById('result-container');
        this.elements.returnButton = document.getElementById('return-btn');
        this.elements.nextQuestionButton = document.getElementById('next-question-btn');
    },

    setupEventListeners() {
        // 返回到 Quiz 页面，并指定题目索引
        this.elements.returnButton.addEventListener('click', () => {
            if (this.currentQuestionData) {
                window.location.href = `quiz.html?questionIndex=${this.currentQuestionData.questionIndex}`;
            } else {
                window.location.href = 'quiz.html'; // 如果数据丢失，直接返回
            }
        });

        // 跳转到 Quiz 页面，并显示下一题
        this.elements.nextQuestionButton.addEventListener('click', () => {
            if (this.currentQuestionData) {
                // 跳转到 Quiz 页面，并告知它显示下一题
                window.location.href = `quiz.html?questionIndex=${this.currentQuestionData.questionIndex + 1}`;
            } else {
                window.location.href = 'quiz.html'; // 如果数据丢失，直接返回
            }
        });
    },

    displayResult() {
        const data = this.currentQuestionData;
        if (!data) return;

        // 更新标题
        this.elements.resultQuestionTitle.textContent = `Question ${data.questionIndex + 1}`;

        const isCorrect = (data.selectedOption === data.correctAnswer);
        const resultClass = isCorrect ? 'correct' : 'incorrect';
        const resultText = isCorrect ? '正确！' : '错误。';

        this.elements.resultContainer.innerHTML = `
            <p class="question-text">${data.question}</p>
            <p class="user-answer">您的选择: <strong class="${resultClass}">${data.selectedOption}</strong> (${resultText})</p>
            <p class="correct-answer-text">正确答案: <strong>${data.correctAnswer}</strong></p>
            <div class="explanation-text">
                <h3>解析:</h3>
                ${DOMPurify.sanitize(marked.parse(data.explanation))}
            </div>
        `;
    },

    showError(message) {
        console.error(message);
        this.elements.resultContainer.innerHTML = `<p class="loading-text" style="color: red;">${message}</p>`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ResultApp.init();
});