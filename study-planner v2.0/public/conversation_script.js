// --- 1. 导入 (不变) ---
import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

// --- 2. 粘贴你新的、安全的 Firebase 配置信息 (不变) ---
const firebaseConfig = {
  apiKey: "AIzaSyDIEh0vHfo-8iX1EA2I7ijwma-4eLPovxk",
  authDomain: "api-1db96.firebaseapp.com",
  projectId: "api-1db96",
  storageBucket: "api-1db96.firebasestorage.app",
  messagingSenderId: "636817576621",
  appId: "1:636817576621:web:f8a69a44f06b736fb32c24",
  measurementId: "G-9HDH0XHWT1"
};

// --- 3. 初始化 Firebase (不变) ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 4. 你的 App 逻辑 (V2.2 - 修复了 Category Bug) ---
const App = {
    session: null,
    elements: {},
    currentSummary: "",
    currentCategory: "", // <-- VVVV 新增 VVVV ---
    currentUser: null, 
    SUMMARY_SYSTEM_PROMPT: `Summarize the user's input text concisely, focusing on key points and main ideas.`,
    CATEGORY_SYSTEM_PROMPT: `You are a librarian. Categorize the following text into a single, general academic subject.
    Respond with ONLY one or two words.
    Examples: "Mathematics", "History", "Biology", "Economics", "Computer Science", "Literature".`,
    
    async init() {
        // (此函数不变)
        this.cacheDOMElements();
        this.setupEventListeners();

        if (!('LanguageModel'in self)) {
            this.addMessageToChat('错误：您的浏览器不支持内置的Prompt API。', 'bot', true);
            return;
        }

        auth.onAuthStateChanged(user => {
            if (user) {
                this.currentUser = user;
                this.loadRecentHistory(user.uid);
            } else {
                this.currentUser = null;
                const historyList = this.elements.recentHistoryList;
                if (historyList) {
                    historyList.innerHTML = '<p>Please login to see recent history.</p>';
                }
            }
        });

        this.handleUrlPromptOnLoad(); 
    },

    cacheDOMElements() {
        // (此函数不变)
        this.elements = {
            chatDisplay: document.getElementById('chat-display-area'),
            chatMain: document.getElementById('chat-main'),
            promptTextarea: document.getElementById('prompt-textarea'),
            submitButton: document.getElementById('submit-button'),
            quizButton: document.getElementById('quiz-button'),
            mainPageButton: document.getElementById('main-page-btn'),
            newChatButton: document.getElementById('new-chat-btn'),
            recentHistoryList: document.getElementById('recent-history-list')
        };
    },
    
    setupEventListeners() {
        this.elements.submitButton.addEventListener('click', this.handleSubmit.bind(this));
        this.elements.promptTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSubmit(); }
        });
        
        // --- VVVV 核心修复 1 VVVV ---
        // (在跳转前保存 category)
        this.elements.quizButton.addEventListener('click', () => {
            if (this.currentSummary) {
                // --- VVVV 这是关键修复 VVVV ---
                // 这是一个新 Quiz，我们必须清除所有旧数据
                sessionStorage.removeItem('currentQuizData');   // (清除旧的题目)
                sessionStorage.removeItem('allUserAnswers');    // (清除旧的答案)
                sessionStorage.removeItem('nextQuestionIndex'); // (清除旧的进度)
                sessionStorage.removeItem('showAllResults');    // (清除旧的“暗号”)
                // --- ^^^^ 修复结束 ^^^^ ---

                // (现在我们再存入新数据)
                sessionStorage.setItem('summaryForQuiz', this.currentSummary);
                sessionStorage.setItem('categoryForQuiz', this.currentCategory); 
                
                window.location.href = 'quiz.html';
            } else {
                alert('请先生成一个摘要！');
            }
        });
        // --- ^^^^ 核心修复 1 ^^^^ ---

        this.elements.mainPageButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        this.elements.newChatButton.addEventListener('click', () => {
            window.location.href = 'conversation_page.html'; 
        });
    },

    
    // --- VVVV 核心修复 2 VVVV ---
    // (在 handleSubmit 中 AWAIT categorizeAndSave)
    async handleSubmit() {
        const userInput = this.elements.promptTextarea.value.trim();
        if (!userInput) return;
        
        this.elements.submitButton.disabled = true;
        this.elements.quizButton.disabled = true; // <-- VVVV 新增 VVVV (在AI运行时禁用 "Go to Quiz")
        this.elements.promptTextarea.value = ''; 
        
        this.elements.chatDisplay.innerHTML = '';
        this.addMessageToChat(userInput, 'user');
        
        const loadingEl = this.addMessageToChat('正在生成摘要...', 'bot');

        try {
            if (!this.session) {
                console.log("User gesture detected. Creating summary session...");
                this.session = await LanguageModel.create({
                    initialPrompts: [{ role: 'system', content: this.SUMMARY_SYSTEM_PROMPT }],
                });
                console.log("Session created.");
            }

            const stream = await this.session.promptStreaming(userInput);
            let result = '';
            for await (const chunk of stream) { 
                result += chunk;
                loadingEl.innerHTML = DOMPurify.sanitize(marked.parse(result));
            }
            this.currentSummary = result;

            // 4. 保存到数据库 (并等待它完成！)
            if (this.currentUser) {
                // --- VVVV 核心修复：添加 "await" VVVV ---
                await this.categorizeAndSave(userInput, result);
                // --- ^^^^ --------------------- ^^^^ ---
            }
            
            // --- VVVV 新增 VVVV ---
            // (现在 this.currentSummary 和 this.currentCategory 都准备好了)
            this.elements.quizButton.disabled = false; 

        } catch (error) {
            this.addMessageToChat(`生成摘要时出错: ${error.message}`, 'bot', true);
        } finally {
            this.elements.submitButton.disabled = false;
        }
    },
    // --- ^^^^ 核心修复 2 ^^^^ ---
    
    async categorizeAndSave(userInput, summaryText) {
        // --- VVVV 核心修复 3 VVVV ---
        // (把 category 存到 this.currentCategory 变量里)
        try {
            const categorySession = await LanguageModel.create({
                 initialPrompts: [{ role: 'system', content: this.CATEGORY_SYSTEM_PROMPT }],
            });
            const category = await categorySession.prompt(userInput);
            
            // --- VVVV 新增这一行 VVVV ---
            this.currentCategory = category.trim(); 
            // --- ^^^^ 新增这一行 ^^^^ ---

            await db.collection("history").add({
                userId: this.currentUser.uid,
                category: this.currentCategory, // (使用新变量)
                originalText: userInput,
                summaryText: summaryText,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("保存历史记录失败:", error);
            // 即使保存失败，也设置一个默认分类，以便 quiz 页面能用
            this.currentCategory = "Uncategorized"; 
        }
    },
    // --- ^^^^ 核心修复 3 ^^^^ ---

    handleUrlPromptOnLoad() {
        // (此函数不变)
        const params = new URLSearchParams(window.location.search);
        const promptFromUrl = params.get('prompt');
        if (promptFromUrl) {
            let decodedPrompt = "";
            try { 
                decodedPrompt = decodeURIComponent(promptFromUrl);
            } catch (e) {
                console.error("无法解码 URL中的 prompt:", e);
                this.addMessageToChat("错误：URL中的文本格式不正确，无法自动加载。", 'bot', true);
                return;
            }
            this.elements.promptTextarea.value = decodedPrompt;
            this.addMessageToChat("请点击 'Generate Summary' (Submit按钮) 开始。", 'bot');
        }
    },
    
    addMessageToChat(content, type = 'bot', isError = false) {
        // (此函数不变)
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        
        if (type === 'user') {
            messageEl.classList.add('user-message');
            messageEl.innerHTML = `<p>${content}</p>`;
        } else {
            messageEl.classList.add('bot-message');
            messageEl.innerHTML = DOMPurify.sanitize(marked.parse(content));
        }
        
        if (isError) {
            messageEl.style.color = 'red';
        }
        
        this.elements.chatDisplay.appendChild(messageEl);
        this.elements.chatDisplay.scrollTop = this.elements.chatDisplay.scrollHeight;
        
        return messageEl;
    },

    loadRecentHistory(userId) {
        // (此函数不变)
        const listEl = this.elements.recentHistoryList;
        listEl.innerHTML = ''; 
        db.collection("history")
          .where("userId", "==", userId)
          .orderBy("timestamp", "desc")
          .limit(15)
          .onSnapshot(snapshot => {
              if (snapshot.empty) {
                  listEl.innerHTML = '<p>No recent history.</p>';
                  return;
              }
              listEl.innerHTML = '';
              snapshot.forEach(doc => {
                  const item = doc.data();
                  const li = document.createElement('li');
                  li.className = 'recent-item';
                  li.textContent = item.originalText;
                  li.title = item.originalText;
                  li.addEventListener('click', () => {
                      this.loadHistoryItem(item);
                  });
                  listEl.appendChild(li);
              });
          }, error => {
              console.error("加载侧边栏历史失败:", error);
              listEl.innerHTML = '<p>Error loading history.</p>';
          });
    },

    loadHistoryItem(item) {
        // --- VVVV 核心修复 4 VVVV ---
        // (从 history 加载时，也要填充 category！)
        this.elements.chatDisplay.innerHTML = '';
        this.addMessageToChat(item.originalText, 'user');
        this.addMessageToChat(item.summaryText, 'bot');
        
        this.currentSummary = item.summaryText;
        this.currentCategory = item.category || "Uncategorized"; // <-- VVVV 新增 VVVV
        
        // (启用 "Go to Quiz" 按钮)
        this.elements.quizButton.disabled = false;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});