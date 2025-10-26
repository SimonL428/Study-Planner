import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

// --- 1. Firebase 配置 (不变) ---
const firebaseConfig = {
  apiKey: "AIzaSyDIEh0vHfo-8iX1EA2I7ijwma-4eLPovxk",
  authDomain: "api-1db96.firebaseapp.com",
  projectId: "api-1db96",
  storageBucket: "api-1db96.firebasestorage.app",
  messagingSenderId: "636817576621",
  appId: "1:636817576621:web:f8a69a44f06b736fb32c24",
  measurementId: "G-9HDH0XHWT1"
};




// --- 2. 初始化 Firebase (不变) ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const QuizApp = {
    session: null,
    summaryText: null,
    elements: {
        quizContainer: null,
        nextButton: null,
        backButton: null,
        questionNumberButton: null,
        mainPageButton: null, 
        conversationButton: null,
    },
    quizData: [],
    currentQuestionIndex: 0,
    currentUser: null, 
    userAnswers: [], // <-- 用来存储你的所有答案
    
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
            this.showError("错误：您的浏览器不支持内置的Prompt API。");
            return;
        }
        
        try {
            this.cacheDOMElements(); 
            this.setupEventListeners(); 
        } catch (error) {
            this.showError(`页面元素加载失败: ${error.message}。`);
            return;
        }
        
        await this.waitForAuth(); 

        const params = new URLSearchParams(window.location.search);
        const quizId = params.get('quizId'); 

        // --- VVVV 核心修改：加载旧数据或新数据 VVVV ---
        if (quizId) {
            // 【流程 A】：从数据库加载旧 Quiz
            await this.loadQuizFromFirestore(quizId);
        } else {
            // 【流程 B】：从 sessionStorage 继续 Quiz
            this.summaryText = sessionStorage.getItem('summaryForQuiz');
            if (!this.summaryText) {
                this.showError("错误：未找到摘要内容。请返回上一页重新生成摘要。");
                this.elements.nextButton.disabled = true;
                this.elements.backButton.disabled = true;
                return; 
            }

            // 加载我们已有的 Quiz 数据和答案
            this.quizData = JSON.parse(sessionStorage.getItem('currentQuizData') || '[]');
            this.userAnswers = JSON.parse(sessionStorage.getItem('allUserAnswers') || 'null') || new Array(this.quizData.length).fill(null);

            // 检查我们是不是刚从 result.html 返回
            const savedIndex = params.get('questionIndex');
            
            if (savedIndex !== null) {
                // (这是从 result.html 的 "Back" 按钮返回)
                this.currentQuestionIndex = parseInt(savedIndex, 10);
                this.displayCurrentQuestion();
            }
            else if (this.quizData.length > 0) {
                 // (这是从 result.html 的 "Next" 按钮返回)
                const nextIndexStr = sessionStorage.getItem('nextQuestionIndex'); // (这可能是 '1', '2', ..., '5')
                if (nextIndexStr === null) {
                     // (如果 "Next" 按钮被点击，但 index 没存上)
                    this.currentQuestionIndex = 0;
                } else {
                    this.currentQuestionIndex = parseInt(nextIndexStr, 10);
                }
                
                if (this.currentQuestionIndex >= this.quizData.length) {
                    this.displayEndOfQuiz();
                } else {
                    this.displayCurrentQuestion();
                }
            }
            else {
                // (这是一个全新的 Quiz, 需要从 AI 生成)
                await this.createSession();
                await this.generateNewQuiz();
            }
        }
        // --- ^^^^ 核心修改结束 ^^^^ ---
    },

    async loadQuizFromFirestore(quizId) {
        if (!this.currentUser) {
            this.showError("您必须登录才能查看已保存的 Quiz。");
            return;
        }
        try {
            this.elements.quizContainer.innerHTML = '<p class="loading-text">正在加载已保存的测验...</p>';
            
            const docRef = db.collection("quizzes").doc(quizId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) { // (已修复：删掉了括号)
                this.showError("错误：未找到 ID 为 " + quizId + " 的测验。");
                return;
            }
            
            const quiz = docSnap.data();
            
            if (quiz.userId !== this.currentUser.uid) {
                this.showError("错误：您无权查看此测验。");
                return;
            }

            this.quizData = quiz.questions;
            this.summaryText = quiz.basedOnSummary; 
            
            // --- VVVV 核心修复：为新 quiz 初始化所有答案 VVVV ---
            this.userAnswers = new Array(this.quizData.length).fill(null);
            sessionStorage.setItem('allUserAnswers', JSON.stringify(this.userAnswers));
            // --- ^^^^ 核心修复 ^^^^ ---

            sessionStorage.setItem('currentQuizData', JSON.stringify(this.quizData));
            sessionStorage.setItem('summaryForQuiz', this.summaryText); // <-- 修复了“未找到摘要”的 Bug
            
            this.currentQuestionIndex = 0;
            this.displayCurrentQuestion();

        } catch (error) {
            this.showError(`加载测验时出错: ${error.message}`); 
        }
    },


    waitForAuth() {
        // (此函数不变)
        return new Promise((resolve) => {
            auth.onAuthStateChanged(user => {
                if (user) {
                    this.currentUser = user;
                    console.log("User logged in:", user.uid);
                } else {
                    this.currentUser = null;
                    console.warn("User is not logged in. Quiz will not be saved.");
                }
                resolve(); 
            });
        });
    },

    cacheDOMElements() {
        // (此函数不变)
        this.elements.quizContainer = document.getElementById('quiz-container');
        this.elements.nextButton = document.getElementById('next-quiz-btn');
        this.elements.backButton = document.getElementById('back-btn');
        this.elements.questionNumberButton = document.getElementById('question-number-btn');
        this.elements.mainPageButton = document.getElementById('main-page-btn');
        this.elements.conversationButton = document.getElementById('conversation-btn');
    },

    setupEventListeners() {
        // (此函数不变)
        this.elements.nextButton.addEventListener('click', this.handleNextClick.bind(this));
        this.elements.backButton.addEventListener('click', this.goToPreviousQuestion.bind(this));
        this.elements.mainPageButton.addEventListener('click', this.goToMainPage.bind(this));
        this.elements.conversationButton.addEventListener('click', this.goToConversationPage.bind(this));
    },

    async createSession() {
        // (此函数不变)
        try {
            this.session = await LanguageModel.create({
                initialPrompts: [{ role: 'system', content: this.QUIZ_SYSTEM_PROMPT }],
            });
        } catch (error) {
            this.showError(`创建AI会话失败: ${error.message}`);
        }
    },

    async generateNewQuiz() {
        // (此函数不变)
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
        // (此函数不变)
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
            
            // --- VVVV 核心修改：为新 quiz 初始化所有答案 VVVV ---
            this.userAnswers = new Array(this.quizData.length).fill(null);
            sessionStorage.setItem('allUserAnswers', JSON.stringify(this.userAnswers));
            // --- ^^^^ 核心修改 ^^^^ ---
            
            this.saveQuizToFirestore(); 
            
        } catch (error) {
            this.showError(`解析测验数据时出错: ${error.message}. API原始返回: ${jsonString}`);
            this.quizData = []; 
        }
    },

    async saveQuizToFirestore() {
        // (此函数不变)
        if (!this.currentUser) {
            console.warn("User not logged in, skipping save to Firestore.");
            return;
        }
        if (!this.quizData || this.quizData.length === 0) {
            console.warn("No quiz data to save.");
            return;
        }

        const topicName = sessionStorage.getItem('categoryForQuiz') || "Uncategorized";
        const title = this.quizData[0]?.question || "Untitled Quiz";
        
        const quizDocument = {
            userId: this.currentUser.uid,
            title: title,
            topicName: topicName, 
            quizType: "multiple_choice",
            basedOnSummary: this.summaryText,
            questions: this.quizData, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const docRef = await db.collection("quizzes").add(quizDocument);
            console.log("Quiz successfully saved to Firestore with ID: ", docRef.id);
        } catch (error) {
            console.error("Error saving quiz to Firestore: ", error);
        }
    },

    displayCurrentQuestion() {
        if (this.quizData.length === 0) {
            this.showError("无法加载测验题目。");
            return;
        }
        
        const questionData = this.quizData[this.currentQuestionIndex];
        
        // --- VVVV 核心修改：检查是否已答完 VVVV ---
        if (!questionData) {
            // (所有题都答完了)
            this.displayEndOfQuiz();
            return;
        }
        // --- ^^^^ 核心修改 ^^^^ ---
        
        this.elements.quizContainer.innerHTML = ''; 
        this.updateQuestionNumberButton(); 
        this.elements.backButton.disabled = (this.currentQuestionIndex === 0);

        if (this.currentQuestionIndex === this.quizData.length - 1) {
            this.elements.nextButton.textContent = "See Results"; // 最后一题显示 "See Results"
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
    
    // --- VVVV 新增函数 VVVV ---
    // (当题目答完时，显示这个)
    displayEndOfQuiz() {
        this.elements.quizContainer.innerHTML = '<p class="loading-text">You have completed all questions!</p>';
        this.elements.nextButton.textContent = "See Results";
        this.elements.backButton.disabled = true; // 答完了，不能后退
    },
    // --- ^^^^ 新增函数 ^^^^ ---


    // --- VVVV 核心修改：保存“所有”答案 VVVV ---
    handleOptionClick(selectedOption, questionData) {
        
        // 1. 保存这个问题的答案
        this.userAnswers[this.currentQuestionIndex] = selectedOption;
        
        // 2. 把 *所有* 答案的列表存入 sessionStorage
        sessionStorage.setItem('allUserAnswers', JSON.stringify(this.userAnswers));
        
        // 3. (不变) 保存当前问题的数据，以便 result.html 显示 *这道题* 的结果
        sessionStorage.setItem('currentQuestionData', JSON.stringify({
            ...questionData,
            selectedOption: selectedOption,
            questionIndex: this.currentQuestionIndex
        }));
        
        // 4. (不变) 告诉下一页 (quiz.html) 下一题是第几题
        sessionStorage.setItem('nextQuestionIndex', this.currentQuestionIndex + 1);

        // 5. (不变) 跳转到 result.html
        window.location.href = 'result.html';
    },
    // --- ^^^^ 核心修改 ^^^^ ---

    // --- VVVV 核心修改：处理 "See Results" 按钮 VVVV ---
    handleNextClick() {
        if (this.currentQuestionIndex < this.quizData.length - 1) {
            // (如果还有下一题，就正常显示)
            this.currentQuestionIndex++;
            this.displayCurrentQuestion();
        } else {
            // (如果已经是最后一题，或者答完了)
            // 这时按钮显示 "See Results"
            // 我们设置一个“特殊标志”，告诉 result.html 显示“全部”
            sessionStorage.setItem('showAllResults', 'true'); // <-- 关键“暗号”！
            window.location.href = 'result.html';
        }
    },
    // --- ^^^^ 核心修改 ^^^^ ---

    goToPreviousQuestion() {
        // (此函数不变)
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayCurrentQuestion();
        }
    },
    
    goToMainPage() {
        // (此函数不变)
        window.location.href = 'index.html';
    },

    goToConversationPage() {
        // (此函数不变)
        window.location.href = 'conversation_page.html';
    },

    updateQuestionNumberButton() {
        // (此函数不变)
        this.elements.questionNumberButton.textContent = `Question ${this.currentQuestionIndex + 1}`;
    },
    
    showError(message) {
        // (此函数不变)
        console.error(message);
        if (this.elements.quizContainer) {
            this.elements.quizContainer.innerHTML = `<p class="loading-text" style="color: red;">${message}</p>`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    QuizApp.init();
});