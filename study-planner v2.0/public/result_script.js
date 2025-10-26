// --- VVVV 确保这些 import 在文件顶部 VVVV ---
import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

const ResultApp = {
    elements: {
        resultQuestionTitle: null,
        resultContainer: null,
        returnButton: null,
        nextQuestionButton: null,
        mainPageButton: null // (确保你的 result.html 里有一个 "main-page-btn")
    },
    currentQuestionData: null, 

    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();

        // --- VVVV 核心修改：检查“暗号” VVVV ---
        const showAll = sessionStorage.getItem('showAllResults');
        
        if (showAll === 'true') {
            // 【流程 A】：显示所有 5 个答案 (你的新功能)
            this.displayAllResults();
            // (用完后就删掉，以免下次出错)
            sessionStorage.removeItem('showAllResults'); 
        } else {
            // 【流程 B】：(旧流程) 只显示 1 个答案
            const storedData = sessionStorage.getItem('currentQuestionData');
            if (!storedData) {
                this.showError("错误：未找到测验题目数据。");
                return;
            }
            try {
                this.currentQuestionData = JSON.parse(storedData);
                this.displaySingleResult(); // (这是你旧的 displayResult 函数)
            } catch (error) {
                this.showError(`解析题目数据时出错: ${error.message}`);
            }
        }
        // --- ^^^^ 核心修改 ^^^^ ---
    },

    cacheDOMElements() {
        this.elements.resultQuestionTitle = document.getElementById('result-question-title');
        this.elements.resultContainer = document.getElementById('result-container');
        this.elements.returnButton = document.getElementById('return-btn');
        this.elements.nextQuestionButton = document.getElementById('next-question-btn');
        // (请确保你的 result.html 里有这个按钮)
        this.elements.mainPageButton = document.getElementById('main-page-btn');
    },

    setupEventListeners() {
        // (你旧的 "Back" 按钮)
        this.elements.returnButton.addEventListener('click', () => {
            if (this.currentQuestionData) {
                window.location.href = `quiz.html?questionIndex=${this.currentQuestionData.questionIndex}`;
            } else {
                window.location.href = 'quiz.html'; 
            }
        });

        // (你旧的 "Next" 按钮)
        this.elements.nextQuestionButton.addEventListener('click', () => {
            if (this.currentQuestionData) {
                window.location.href = `quiz.html?questionIndex=${this.currentQuestionData.questionIndex + 1}`;
            } else {
                window.location.href = 'quiz.html'; 
            }
        });
        
        // (新的 "Main Page" 按钮监听)
        if (this.elements.mainPageButton) {
            this.elements.mainPageButton.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
    },

    // --- 【流程 B】：(你旧的函数，几乎不变) ---
    displaySingleResult() {
        const data = this.currentQuestionData;
        if (!data) return;

        // (只显示 "Next" 按钮)
        this.elements.returnButton.style.display = 'none';
        this.elements.nextQuestionButton.style.display = 'block';

        // 更新标题
        this.elements.resultQuestionTitle.textContent = `Question ${data.questionIndex + 1}`;

        const isCorrect = (data.selectedOption === data.correctAnswer);
        const resultClass = isCorrect ? 'correct' : 'incorrect';
        const resultText = isCorrect ? '正确！' : '错误。';

        // (这是你旧的 HTML)
        this.elements.resultContainer.innerHTML = `
            <p class="question-text">${data.question}</p>
            <p class="user-answer">您的选择: <strong class="${resultClass}">${data.selectedOption}</strong> (${resultText})</p>
            <p class="correct-answer-text">正确答案: <strong>${data.correctAnswer}</strong></p>
            <div class="explanation-text">
                <h3>解析:</h3>
                ${DOMPurify.sanitize(marked.parse(data.explanation))}
            </div>
        `;
        
        // --- VVVV 检查是不是最后一题 VVVV ---
        const allQuestions = JSON.parse(sessionStorage.getItem('currentQuizData') || '[]');
        if (data.questionIndex >= allQuestions.length - 1) {
            this.elements.nextQuestionButton.textContent = 'See All Results';
            
            // (如果他们点了，就设置“暗号”并重新加载)
            this.elements.nextQuestionButton.onclick = () => {
                sessionStorage.setItem('showAllResults', 'true');
                window.location.reload(); // 重新加载 result.html
            };
        }
        // --- ^^^^ 检查完毕 ^^^^ ---
    },
    
    // --- VVVV 【流程 A】：这是你的新函数 VVVV ---
    displayAllResults() {
        // (隐藏 "Next" 和 "Back" 按钮)
        this.elements.returnButton.style.display = 'none';
        this.elements.nextQuestionButton.style.display = 'none';
        this.elements.resultQuestionTitle.textContent = 'Quiz Summary'; // (新标题)
        
        const allQuestions = JSON.parse(sessionStorage.getItem('currentQuizData') || '[]');
        
        if (allQuestions.length === 0) {
            this.showError("错误：未找到测验数据。");
            return;
        }

        this.elements.resultContainer.innerHTML = ''; // 清空
        
        allQuestions.forEach((questionData, index) => {
            const resultEl = document.createElement('div');
            resultEl.className = 'result-card'; // (一个普通的 class)
            
            // (这是你要求的新 HTML：只有问题、答案、解析，全为黑色)
            resultEl.innerHTML = `
                <p class_="question-text" style="color: black;"><strong>Q ${index + 1}: ${questionData.question}</strong></p>
                <p class="correct-answer-text" style="color: black;">正确答案: <strong>${questionData.correctAnswer}</strong></p>
                <div class="explanation-text" style="color: black;">
                    <h3>解析:</h3>
                    ${DOMPurify.sanitize(marked.parse(questionData.explanation))}
                </div>
            `;
            this.elements.resultContainer.appendChild(resultEl);
        });
    },
    // --- ^^^^ 新函数结束 ^^^^ ---

    showError(message) {
        console.error(message);
        this.elements.resultContainer.innerHTML = `<p class="loading-text" style="color: red;">${message}</p>`;
        
        // (出错时隐藏所有按钮)
        if (this.elements.returnButton) this.elements.returnButton.style.display = 'none';
        if (this.elements.nextQuestionButton) this.elements.nextQuestionButton.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ResultApp.init();
});