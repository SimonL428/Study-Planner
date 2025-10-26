import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

const App = {
    session: null,
    elements: {},
    currentSummary: "", // 用于存储最新的摘要
    SYSTEM_PROMPT: "summarize the text concisely and informatively.",

    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();

        if (!('LanguageModel' in self)) {
            this.showError("错误：您的浏览器不支持内置的Prompt API。");
            return;
        }

        await this.createSession();
        // 页面加载时检查URL
        this.handleUrlPromptOnLoad();
    },

    cacheDOMElements() {
        this.elements = {
            promptTextarea: document.getElementById('prompt-textarea'),
            submitButton: document.getElementById('submit-button'),
            inputDisplay: document.getElementById('input-display'),
            outputDisplay: document.getElementById('output-display'),
            quizButton: document.getElementById('quiz-button') // 获取 QUIZ 按钮
        };
    },
    
    setupEventListeners() {
        this.elements.submitButton.addEventListener('click', this.handleSubmit.bind(this));
        
        this.elements.promptTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit();
            }
        });
        
        // 为 QUIZ 按钮添加监听器
        this.elements.quizButton.addEventListener('click', () => {
            if (this.currentSummary) {
                // 将摘要存入 sessionStorage，以便 quiz.html 可以访问
                sessionStorage.setItem('summaryForQuiz', this.currentSummary);
                // 跳转到 quiz.html
                window.location.href = 'quiz.html';
            } else {
                alert('请先生成一个摘要，然后再进行测验！');
            }
        });
    },

    async createSession() {
        try {
            this.session = await LanguageModel.create({
                initialPrompts: [{ role: 'system', content: this.SYSTEM_PROMPT }],
            });
            console.log("AI session created successfully.");
        } catch (error) {
            this.showError(`创建AI会话失败: ${error.message}`);
        }
    },

    async handleSubmit() {
        const userInput = this.elements.promptTextarea.value.trim();
        if (!userInput || !this.session) {
            return;
        }

        this.elements.submitButton.disabled = true;
        this.elements.promptTextarea.disabled = true;
        this.elements.inputDisplay.innerHTML = `<strong>Input:</strong><p>${userInput}</p>`;
        this.elements.outputDisplay.innerHTML = '正在为您生成回答，请稍候...';

        try {
            const stream = await this.session.promptStreaming(userInput);
            
            let result = '';
            let previousChunk = '';
            for await (const chunk of stream) {
                const newChunk = chunk.startsWith(previousChunk) ? chunk.slice(previousChunk.length) : chunk;
                result += newChunk;
                this.elements.outputDisplay.innerHTML = DOMPurify.sanitize(marked.parse(result));
                previousChunk = chunk;
            }
            
            // 将纯文本结果存入变量
            this.currentSummary = result; 

        } catch (error) {
            this.showError(`生成回答时出错: ${error.message}`);
        } finally {
            this.elements.submitButton.disabled = false;
            this.elements.promptTextarea.disabled = false;
            // 我们不清空输入框，因为它可能来自URL
        }
    },
    
    // 检查URL参数的函数
    handleUrlPromptOnLoad() {
        const params = new URLSearchParams(window.location.search);
        const promptFromUrl = params.get('prompt');

        if (promptFromUrl) {
            const decodedPrompt = decodeURIComponent(promptFromUrl);
            // 将文本放入输入框
            this.elements.promptTextarea.value = decodedPrompt;
            console.log("Found prompt in URL, auto-submitting...");
            // 自动提交
            this.handleSubmit();
        }
    },
    
    showError(message) {
        console.error(message);
        if (this.elements.outputDisplay) {
            this.elements.outputDisplay.innerHTML = `<p style="color: red;">${message}</p>`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});