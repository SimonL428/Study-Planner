import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

const QuizApp = {
    session: null,
    summaryText: null,
    elements: {
        quizContainer: null,
        nextButton: null,
        backButton: null,
        questionNumberButton: null,
        mainPageButton: null, 
        conversationButton: null, // 确保所有元素都在这里
    },
    quizData: [],
    currentQuestionIndex: 0,

    QUIZ_SYSTEM_PROMPT: `You are a quiz generator. Based on the text I provide, generate exactly 5 multiple-choice questions.
    Format your response as a JSON array.
    Each object in the array must have ONLY these three keys:
    1. "question": The question text.
    2. "options": An array of 4 strings (the potential answers).
    3. "correctAnswer": The string from the 'options' array that is the correct answer.
    4. "explanation": A concise explanation for the correct answer.

    Do not include any text outside of the JSON array.
    `,

    async init() {
        if (!('LanguageModel' in self)) {
            // 注意：我们在这里还不能调用 showError，因为 elements 还没被缓存
            console.error("Browser doesn't support LanguageModel API.");
            const container = document.getElementById('quiz-container');
            if (container) {
                container.innerHTML = '<p class="loading-text" style="color: red;">错误：您的浏览器不支持内置的Prompt API。</p>';
            }
            return;
        }
        
        try {
            this.cacheDOMElements(); // 缓存所有元素
            this.setupEventListeners(); // 设置所有监听器
        } catch (error) {
            // 如果缓存或设置监听器时出错（比如HTML不匹配），在这里捕获
            console.error("初始化UI时出错:", error);
            this.showError(`页面元素加载失败: ${error.message}。请确保HTML文件是最新的。`);
            return;
        }

        // --- 检查摘要的核心逻辑 ---
        this.summaryText = sessionStorage.getItem('summaryForQuiz');
        if (!this.summaryText) {
            // 如果没有摘要，就显示错误并停止
            this.showError("错误：未找到摘要内容。请返回上一页重新生成摘要。");
            // 禁用所有导航按钮
            this.elements.nextButton.disabled = true;
            this.elements.backButton.disabled = true;
            return; 
        }

        // --- 只有在有摘要时才继续 ---
        await this.createSession();
        
        const params = new URLSearchParams(window.location.search);
        const savedIndex = params.get('questionIndex');
        const savedQuizData = sessionStorage.getItem('currentQuizData');

        if (savedIndex !== null && savedQuizData) {
            this.currentQuestionIndex = parseInt(savedIndex, 10);
            this.quizData = JSON.parse(savedQuizData);
            this.displayCurrentQuestion();
        } else {
            await this.generateNewQuiz();
        }
    },

    cacheDOMElements() {
        // 缓存所有按钮，如果任何一个找不到，JS会在这里抛出错误
        this.elements.quizContainer = document.getElementById('quiz-container');
        this.elements.nextButton = document.getElementById('next-quiz-btn');
        this.elements.backButton = document.getElementById('back-btn');
        this.elements.questionNumberButton = document.getElementById('question-number-btn');
        this.elements.mainPageButton = document.getElementById('main-page-btn');
        this.elements.conversationButton = document.getElementById('conversation-btn');
    },

    setupEventListeners() {
        // 设置所有按钮的监听器
        this.elements.nextButton.addEventListener('click', this.handleNextClick.bind(this));
        this.elements.backButton.addEventListener('click', this.goToPreviousQuestion.bind(this));
        this.elements.mainPageButton.addEventListener('click', this.goToMainPage.bind(this));
        this.elements.conversationButton.addEventListener('click', this.goToConversationPage.bind(this));
    },

    async createSession() {
        try {
            this.session = await LanguageModel.create({
                initialPrompts: [{ role: 'system', content: this.QUIZ_SYSTEM_PROMPT }],
            });
        } catch (error) {
            this.showError(`创建AI会话失败: ${error.message}`);
        }
    },

    async generateNewQuiz() {
        if (!this.session) {
            this.showError("会话未初始化，请刷新页面。");
            return;
        }
        try {
            this.elements.quizContainer.innerHTML = '<p class="loading-text">正在生成新测验，请稍候...</p>';
            this.currentQuestionIndex = 0; 
            this.elements.backButton.disabled = true;

            const stream = await this.session.promptStreaming(this.summaryText);
            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk;
            }
            this.parseAndStoreQuizData(fullResponse);
            this.displayCurrentQuestion();

        } catch (error) {
            this.showError(`生成测验时出错: ${error.message}`);
        }
    },

    parseAndStoreQuizData(jsonString) {
        try {
            const startIndex = jsonString.indexOf('[');
            const endIndex = jsonString.lastIndexOf(']');
            let cleanedString = jsonString;
            
            if (startIndex !== -1 && endIndex !== -1) {
                cleanedString = jsonString.substring(startIndex, endIndex + 1);
            } else {
                throw new Error("在API响应中未找到有效的JSON数组。");
            }

            this.quizData = JSON.parse(cleanedString);
            sessionStorage.setItem('currentQuizData', JSON.stringify(this.quizData));
            
        } catch (error) {
            this.showError(`解析测验数据时出错: ${error.message}. API原始返回: ${jsonString}`);
            this.quizData = []; 
        }
    },

    displayCurrentQuestion() {
        if (this.quizData.length === 0) {
            this.showError("无法加载测验题目。");
            return;
        }

        const questionData = this.quizData[this.currentQuestionIndex];
        if (!questionData) {
            this.showError("没有更多题目了。");
            return;
        }

        this.elements.quizContainer.innerHTML = ''; 
        this.updateQuestionNumberButton(); 

        this.elements.backButton.disabled = (this.currentQuestionIndex === 0);

        if (this.currentQuestionIndex === this.quizData.length - 1) {
            this.elements.nextButton.textContent = "New Quiz";
        } else {
            this.elements.nextButton.textContent = "next";
        }
        
        const questionWrapper = document.createElement('div');
        questionWrapper.className = 'quiz-question-wrapper';
        const questionText = document.createElement('p');
        questionText.className = 'quiz-question-text';
        questionText.textContent = questionData.question;
        const optionsGrid = document.createElement('div');
        optionsGrid.className = 'options-grid';

        questionData.options.forEach(optionText => {
            const optionButton = document.createElement('button');
            optionButton.className = 'option-btn';
            optionButton.textContent = optionText;
            optionButton.addEventListener('click', () => {
                this.handleOptionClick(optionText, questionData);
            });
            optionsGrid.appendChild(optionButton);
        });

        questionWrapper.appendChild(questionText);
        questionWrapper.appendChild(optionsGrid);
        this.elements.quizContainer.appendChild(questionWrapper);
    },

    handleOptionClick(selectedOption, questionData) {
        sessionStorage.setItem('currentQuestionData', JSON.stringify({
            ...questionData,
            selectedOption: selectedOption,
            questionIndex: this.currentQuestionIndex
        }));
        window.location.href = 'result.html';
    },

    handleNextClick() {
        if (this.currentQuestionIndex < this.quizData.length - 1) {
            this.currentQuestionIndex++;
            this.displayCurrentQuestion();
        } else {
            this.generateNewQuiz();
        }
    },

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayCurrentQuestion();
        }
    },
    
    goToMainPage() {
        // !!! 修复 BUG： "Main Page" 应该指向摘要页
        window.location.href = 'index.html';
    },

    goToConversationPage() {
        // "Conversation" 指向启动页
        window.location.href = 'conversation_page.html';
    },

    updateQuestionNumberButton() {
        this.elements.questionNumberButton.textContent = `Question ${this.currentQuestionIndex + 1}`;
    },

    showError(message) {
        console.error(message);
        // 确保 elements.quizContainer 存在后再写入
        if (this.elements.quizContainer) {
            this.elements.quizContainer.innerHTML = `<p class="loading-text" style="color: red;">${message}</p>`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    QuizApp.init();
});