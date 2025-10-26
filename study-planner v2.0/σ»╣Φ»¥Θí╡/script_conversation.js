/**
 * MODIFIED JAVASCRIPT
 * This script is adapted to work with the simple summarizer HTML.
 * It retains the core Prompt API logic but removes all UI features 
 * that are not present in the simple HTML file.
 */

// 导入必要的库，用于安全地渲染Markdown格式的响应
import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

const App = {
    // 应用状态
    session: null,
    elements: {}, // 存放DOM元素

    // 系统提示 (这是API的核心部分，我们保留它)
    SYSTEM_PROMPT: "Summarize the following text, providing concise and clear information.",

    // --- 1. 初始化方法 ---
    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();

        // 检查浏览器是否支持 LanguageModel API
        if (!('LanguageModel' in self)) {
            this.showError("错误：您的浏览器不支持内置的Prompt API。请使用支持此功能的Chrome版本。");
            return;
        }

        // 自动创建第一个会话
        await this.createSession();
    },

    // --- 2. 获取并缓存HTML元素 ---
    cacheDOMElements() {
        // 只获取我们简单HTML中存在的元素
        this.elements = {
            promptTextarea: document.getElementById('prompt-textarea'),
            submitButton: document.getElementById('submit-button'),
            inputDisplay: document.getElementById('input-display'),
            outputDisplay: document.getElementById('output-display'),
        };
    },
    
    // --- 3. 设置事件监听器 ---
    setupEventListeners() {
        this.elements.submitButton.addEventListener('click', this.handleSubmit.bind(this));
        this.elements.promptTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit();
            }
        });
    },

    // --- 4. 核心功能 ---
    async createSession() {
        try {
            this.session = await LanguageModel.create({
                // 我们删除了温度和Top-K的设置，使用API的默认值
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

        // 禁用按钮和输入框，防止重复提交
        this.elements.submitButton.disabled = true;
        this.elements.promptTextarea.disabled = true;

        // 更新界面，显示用户的输入和“正在处理”的状态
        this.elements.inputDisplay.innerHTML = `<strong>Input:</strong><p>${userInput}</p>`;
        this.elements.outputDisplay.innerHTML = '正在为您生成回答，请稍候...';

        try {
            const stream = await this.session.promptStreaming(userInput);
            
            let result = '';
            let previousChunk = '';
            for await (const chunk of stream) {
                const newChunk = chunk.startsWith(previousChunk) ? chunk.slice(previousChunk.length) : chunk;
                result += newChunk;
                // 使用 marked 和 DOMPurify 安全地将结果渲染到输出区域
                this.elements.outputDisplay.innerHTML = DOMPurify.sanitize(marked.parse(result));
                previousChunk = chunk;
            }
        } catch (error) {
            this.showError(`生成回答时出错: ${error.message}`);
        } finally {
            // 无论成功还是失败，最后都重新启用按钮和输入框
            this.elements.submitButton.disabled = false;
            this.elements.promptTextarea.disabled = false;
            this.elements.promptTextarea.value = ''; // 清空输入框
        }
    },
    
    // --- 5. 简化的错误处理 ---
    showError(message) {
        console.error(message);
        // 在输出区域显示错误信息
        if (this.elements.outputDisplay) {
            this.elements.outputDisplay.innerHTML = `<p style="color: red;">${message}</p>`;
        }
    }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});