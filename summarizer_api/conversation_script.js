/**
 * MODIFIED JAVASCRIPT
 * This script now supports being launched from another page via URL parameters.
 */

import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

const App = {
    session: null,
    elements: {},
    SYSTEM_PROMPT: "summarize passage/concept in concise and clear way",

    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();

        if (!('LanguageModel' in self)) {
            this.showError("错误：您的浏览器不支持内置的Prompt API。");
            return;
        }

        await this.createSession();
        
        // --- 新增代码开始 ---
        // 页面加载后，检查URL中是否有需要自动处理的prompt
        this.handleUrlPromptOnLoad();
        // --- 新增代码结束 ---
    },

    cacheDOMElements() {
        this.elements = {
            promptTextarea: document.getElementById('prompt-textarea'),
            submitButton: document.getElementById('submit-button'),
            inputDisplay: document.getElementById('input-display'),
            outputDisplay: document.getElementById('output-display'),
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
        } catch (error) {
            this.showError(`生成回答时出错: ${error.message}`);
        } finally {
            this.elements.submitButton.disabled = false;
            this.elements.promptTextarea.disabled = false;
            // 注意：我们只在手动提交时清空输入框
            // 如果是从URL自动执行，不清空，让用户看到原文
        }
    },
    
    // --- 新增函数开始 ---
    // 这个函数会在页面加载时检查URL
    handleUrlPromptOnLoad() {
        // 创建一个对象来轻松处理URL参数
        const params = new URLSearchParams(window.location.search);
        
        // 尝试获取名为 'prompt' 的参数
        const promptFromUrl = params.get('prompt');

        if (promptFromUrl) {
            // 如果找到了参数，解码文本
            const decodedPrompt = decodeURIComponent(promptFromUrl);
            
            // 将解码后的文本放入主页的输入框中
            // 这样用户就能看到他们是从什么内容跳转过来的
            this.elements.promptTextarea.value = decodedPrompt;
            
            // 直接调用提交函数，自动开始处理！
            console.log("Found prompt in URL, auto-submitting...");
            this.handleSubmit();
        }
    },
    // --- 新增函数结束 ---
    
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