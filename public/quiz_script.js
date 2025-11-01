// Filename: quiz_script.js (已修复 Bug 1 和 Bug 2 的最终版)

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


firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const QuizApp = {
    session: null,
    summaryText: null,
    targetLanguage: 'en', // (默认为 'en')
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
    userAnswers: [], 
    
    // (Prompt 模板不变)
    QUIZ_SYSTEM_PROMPT_TEMPLATE: `You are a quiz generator. Based on the text I provide, generate exactly 5 multiple-choice questions.
    Format your response as a JSON array.
    Each object in the array must have ONLY these three keys:
    1. "question": The question text.
    2. "options": An array of 4 strings (the potential answers).
    3. "correctAnswer": The string from the 'options' array that is the correct answer.
    4. "explanation": A concise explanation for the correct answer.
    Respond ONLY in the following language: [LANGUAGE].
    Do not include any text outside of the JSON array.
    `,
    currentQuizSystemPrompt: '', 

    async init() {
        this.cacheDOMElements(); 
        this.setupEventListeners(); 
        await this.waitForAuth(); 
        
        const params = new URLSearchParams(window.location.search);
        const quizId = params.get('quizId'); 
        
        this.targetLanguage = sessionStorage.getItem('languageForQuiz') || 'en';
        this.elements.quizContainer.innerHTML = `<p class="loading-text">Loading quiz, please wait...</p>`;

        if (quizId) {
            // 这是你从主页点击历史测验的流程
            await this.loadQuizFromFirestore(quizId); 
        } else {
            // 这是你从 conversation_page.html 生成新测验的流程
            this.summaryText = sessionStorage.getItem('summaryForQuiz');
            if (!this.summaryText) {
                this.showError("Error: Quiz data not found in session.");
                this.elements.nextButton.disabled = true;
                this.elements.backButton.disabled = true;
                return; 
            }
            
            this.quizData = JSON.parse(sessionStorage.getItem('currentQuizData') || '[]');
            this.userAnswers = JSON.parse(sessionStorage.getItem('allUserAnswers') || 'null') || new Array(this.quizData.length).fill(null);
            
            // 检查是否从 result.html 返回
            const savedIndex = params.get('questionIndex');
            if (savedIndex !== null) {
                this.currentQuestionIndex = parseInt(savedIndex, 10);
                this.displayCurrentQuestion();
            }
            // 检查 session 中是否已有正在进行的测验
            else if (this.quizData.length > 0) {
                const nextIndexStr = sessionStorage.getItem('nextQuestionIndex'); 
                if (nextIndexStr === null) { this.currentQuestionIndex = 0; }
                else { this.currentQuestionIndex = parseInt(nextIndexStr, 10); }
                
                if (this.currentQuestionIndex >= this.quizData.length) { this.displayEndOfQuiz(); }
                else { this.displayCurrentQuestion(); }
            }
            // 否则，生成一个新测验
            else {
                await this.createSession(); 
                await this.generateNewQuiz();
            }
        }
    },
    
    // --- VVVV 核心修复：历史测验 Bug VVVV ---
    async loadQuizFromFirestore(quizId) {
        if (!this.currentUser) {
            this.showError("You must be logged in to view saved quizzes.");
            return;
        }
        try {
            this.elements.quizContainer.innerHTML = `<p class="loading-text">Loading saved quiz...</p>`;
            
            // 1. 清除上一个测验的会话数据 (!!! 这是修复 Bug 1 的关键 !!!)
            sessionStorage.removeItem('currentQuizData');
            sessionStorage.removeItem('allUserAnswers');
            sessionStorage.removeItem('summaryForQuiz');
            sessionStorage.removeItem('nextQuestionIndex');
            sessionStorage.removeItem('currentQuestionData');
            sessionStorage.removeItem('languageForQuiz');

            // 2. 从 Firestore 加载新测验
            const docRef = db.collection("quizzes").doc(quizId);
            const docSnap = await docRef.get();
            if (!docSnap.exists) { 
                this.showError("Error: Quiz not found.");
                return;
            }
            
            const quiz = docSnap.data();
            if (quiz.userId !== this.currentUser.uid) {
                this.showError("Error: You do not have permission to view this quiz.");
                return;
            }
            
            // 3. 将新测验数据存入 this 和 sessionStorage
            this.quizData = quiz.questions;
            this.summaryText = quiz.basedOnSummary; 
            this.userAnswers = new Array(this.quizData.length).fill(null);
            sessionStorage.setItem('allUserAnswers', JSON.stringify(this.userAnswers));
            sessionStorage.setItem('currentQuizData', JSON.stringify(this.quizData));
            sessionStorage.setItem('summaryForQuiz', this.summaryText); 
            
            // 4. 从头开始显示这个测验
            this.currentQuestionIndex = 0;
            this.displayCurrentQuestion();
        } catch (error) {
            this.showError(`Error loading quiz: ${error.message}`); 
        }
    },
    // --- ^^^^ 核心修复：历史测验 Bug ^^^^ ---

    waitForAuth: function() { 
        return new Promise((resolve) => { 
            auth.onAuthStateChanged(user => { 
                if (user) { 
                    this.currentUser = user; 
                } else { 
                    this.currentUser = null; 
                } 
                resolve(); 
            }); 
        }); 
    },
    
    cacheDOMElements: function() { 
        this.elements.quizContainer = document.getElementById('quiz-container'); 
        this.elements.nextButton = document.getElementById('next-quiz-btn'); 
        this.elements.backButton = document.getElementById('back-btn'); 
        this.elements.questionNumberButton = document.getElementById('question-number-btn'); 
        this.elements.mainPageButton = document.getElementById('main-page-btn'); 
        this.elements.conversationButton = document.getElementById('conversation-btn'); 
    },
    
    setupEventListeners: function() { 
        this.elements.nextButton.addEventListener('click', this.handleNextClick.bind(this)); 
        this.elements.backButton.addEventListener('click', this.goToPreviousQuestion.bind(this)); 
        this.elements.mainPageButton.addEventListener('click', this.goToMainPage.bind(this)); 
        this.elements.conversationButton.addEventListener('click', this.goToConversationPage.bind(this)); 
    },
    
    createSession: async function() { 
        try { 
            let targetLanguageName = this.targetLanguage; 
            if (targetLanguageName === 'zh') targetLanguageName = 'Chinese'; 
            if (targetLanguageName === 'en') targetLanguageName = 'English'; 
            this.currentQuizSystemPrompt = this.QUIZ_SYSTEM_PROMPT_TEMPLATE.replace('[LANGUAGE]', targetLanguageName); 
            this.session = await LanguageModel.create({ 
                initialPrompts: [{ role: 'system', content: this.currentQuizSystemPrompt }], 
                expectedInputs: [ { type: 'text' } ], 
                expectedOutputs: [ { type: 'text' } ], 
                languages: [this.targetLanguage] 
            }); 
        } catch (error) { 
            this.showError(`Failed to create AI session: ${error.message}`); 
        } 
    },

    async generateNewQuiz() {
        if (!this.session) {
            this.showError("Session not initialized. Please refresh.");
            return;
        }
        try {
            this.elements.quizContainer.innerHTML = `<p class="loading-text">Generating new quiz...</p>`;
            this.currentQuestionIndex = 0; 
            this.elements.backButton.disabled = true;
            
            const userMessage = { role: 'user', content: [ { type: 'text', value: this.summaryText } ] };
            const stream = await this.session.promptStreaming([userMessage]); 
            let fullResponse = '';
            for await (const chunk of stream) { fullResponse += chunk; }
            this.parseAndStoreQuizData(fullResponse); 
            this.displayCurrentQuestion();
        } catch (error) {
            this.showError(`Error generating quiz: ${error.message}`);
        }
    },    
    
    parseAndStoreQuizData: function(jsonString) { 
        try { 
            const startIndex = jsonString.indexOf('['); 
            const endIndex = jsonString.lastIndexOf(']'); 
            let cleanedString = jsonString; 
            if (startIndex !== -1 && endIndex !== -1) { 
                cleanedString = jsonString.substring(startIndex, endIndex + 1); 
            } else { 
                throw new Error("Did not find valid JSON array in API response."); 
            } 
            this.quizData = JSON.parse(cleanedString); 
            sessionStorage.setItem('currentQuizData', JSON.stringify(this.quizData)); 
            this.userAnswers = new Array(this.quizData.length).fill(null); 
            sessionStorage.setItem('allUserAnswers', JSON.stringify(this.userAnswers)); 
            this.saveQuizToFirestore(); 
        } catch (error) { 
            this.showError(`Error parsing quiz data: ${error.message}. API raw response: ${jsonString}`); 
            this.quizData = []; 
        } 
    },
    
    saveQuizToFirestore: async function() { 
        if (!this.currentUser) { return; } 
        if (!this.quizData || this.quizData.length === 0) { return; } 
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
            this.showError("Could not load quiz questions.");
            return;
        }
        const questionData = this.quizData[this.currentQuestionIndex];
        if (!questionData) {
            this.displayEndOfQuiz();
            return;
        }
        this.elements.quizContainer.innerHTML = ''; 
        this.updateQuestionNumberButton(); 
        this.elements.backButton.disabled = (this.currentQuestionIndex === 0);

        if (this.currentQuestionIndex === this.quizData.length - 1) {
            this.elements.nextButton.textContent = "See Results";
        } else {
            this.elements.nextButton.textContent = "Next";
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
    
    displayEndOfQuiz() {
        this.elements.quizContainer.innerHTML = `<p class="loading-text">You have completed all questions!</p>`;
        this.elements.nextButton.textContent = "See Results";
        this.elements.backButton.disabled = true; 
    },

    handleOptionClick: function(selectedOption, questionData) { 
        this.userAnswers[this.currentQuestionIndex] = selectedOption; 
        sessionStorage.setItem('allUserAnswers', JSON.stringify(this.userAnswers)); 
        sessionStorage.setItem('currentQuestionData', JSON.stringify({ 
            ...questionData, 
            selectedOption: selectedOption, 
            questionIndex: this.currentQuestionIndex 
        }));
        sessionStorage.setItem('nextQuestionIndex', this.currentQuestionIndex + 1);
        window.location.href = 'result.html';
    },
    
    // --- VVVV 核心修复：“Next” 按钮 Bug VVVV ---
    handleNextClick() {
        if (this.currentQuestionIndex < this.quizData.length - 1) {
            this.currentQuestionIndex++;
            this.displayCurrentQuestion();
        } else {
            sessionStorage.setItem('showAllResults', 'true'); 
            window.location.href = 'result.html';
        }
    },
    // --- ^^^^ 核心修复：“Next” 按钮 Bug ^^^^ ---

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayCurrentQuestion();
        }
    },
    goToMainPage() {
        window.location.href = 'index.html';
    },
    goToConversationPage() {
        window.location.href = 'conversation_page.html';
    },
    updateQuestionNumberButton() {
        this.elements.questionNumberButton.textContent = `Question ${this.currentQuestionIndex + 1}`;
    },
    showError(message) { 
        console.error(message); 
        if (this.elements.quizContainer) { 
            this.elements.quizContainer.innerHTML = `<p class="loading-text" style="color: red;">${message}</p>`; 
        } 
    }
};

document.addEventListener('DOMContentLoaded', () => {
    QuizApp.init();
});