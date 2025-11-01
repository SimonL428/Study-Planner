// Filename: i18n.js

// 1. 翻译字典
export const translations = {
    'en': {
        // --- 公共 ---
        mainPageButtonText: "Main Page",
        newChatButtonText: "New Chat",
        
        // --- Main Page (index.html) ---
        mainTitle: "Welcome to your AI Study Hub",
        loginMessage: "Login to see your personalized study history.",
        loginButton: "Login with Google",
        guestButton: "Continue as Guest",
        welcomeUser: "Welcome, ",
        logoutButton: "Logout",
        topTopicsTitle: "Your Top Topics",
        gridLoading: "Loading your history...",
        backToTopics: "← Back to Topics",
        quizTopicsTitle: "Your Topics with Quizzes",
        quizGridLoading: "Loading your quizzes...",
        noHistory: "No history found. Start a new chat!",
        
        // --- Conversation Page (conversation_page.html) ---
        submitButtonText: "Generate Summary",
        quizButtonText: "Take Quiz",
        promptPlaceholder: "Type your text, or upload an image/file...",
        recentHistoryTitle: "Recent History",
        loginPrompt: "Please login to see recent history.",
        clearImage: "Clear Image",
        translateInputButton: "Translate to EN", // (用于功能二)
        translatingButton: "Translating...", // (用于功能二)

        // --- Quiz & Result Pages (待添加) ---
        quizPageTitle: "Reinforce Your Keypoint",
        conversationButton: "Conversation",
        backButton: "Back",
        nextButton: "Next",
        questionPrefix: "Question ",
        loadingQuiz: "Loading quiz, please wait...",
        seeResultsButton: "See Results",
        quizComplete: "You have completed all questions!",
        loadingSavedQuiz: "Loading saved quiz...",
        errorQuizNotFound: "Error: Quiz not found.",
        generatingQuiz: "Generating new quiz...",

        // --- Result Page (result.html / result_script.js) ---
        resultPageTitlePrefix: "Question ",
        quizSummaryTitle: "Quiz Summary",
        returnButton: "Return",
        loadingResults: "Loading results...",
        correctText: "Correct!",
        incorrectText: "Incorrect.",
        yourAnswer: "Your Answer:",
        correctAnswer: "Correct Answer:",
        explanation: "Explanation",
        seeAllResultsButton: "See All Results",
        errorNoQuizData: "Error: Quiz data not found.",
        errorParsingData: "Error parsing quiz data"
    },
    'zh': {
        // --- 公共 ---
        mainPageButtonText: "主页",
        newChatButtonText: "新对话",

        // --- Main Page (index.html) ---
        mainTitle: "欢迎来到你的 AI 学习中心",
        loginMessage: "登录以查看你的个性化学习历史。",
        loginButton: "使用 Google 登录",
        guestButton: "以访客身份继续",
        welcomeUser: "欢迎, ",
        logoutButton: "登出",
        topTopicsTitle: "你的热门主题",
        gridLoading: "正在加载历史记录...",
        backToTopics: "← 返回主题",
        quizTopicsTitle: "你带测验的主题",
        quizGridLoading: "正在加载测验...",
        noHistory: "未找到历史记录。开始新对话吧！",
        
        // --- Conversation Page (conversation_page.html) ---
        submitButtonText: "生成摘要",
        quizButtonText: "开始测验",
        promptPlaceholder: "输入文本，或上传图片/文件...",
        recentHistoryTitle: "最近历史",
        loginPrompt: "请登录以查看最近的历史记录。",
        clearImage: "清除图片",
        translateInputButton: "翻译成英文", // (用于功能二)
        translatingButton: "翻译中...", // (用于功能二)

        // --- Quiz & Result Pages (待添加) ---
        quizPageTitle: "巩固你的关键点",
        conversationButton: "对话页",
        backButton: "返回",
        nextButton: "下一个",
        questionPrefix: "第 ", // (注意后面的空格)
        loadingQuiz: "正在加载测验题，请稍候...",
        seeResultsButton: "查看结果",
        quizComplete: "你已完成所有题目！",
        loadingSavedQuiz: "正在加载已保存的测验...",
        errorQuizNotFound: "错误：未找到测验。",
        generatingQuiz: "正在生成新测验...",

        // --- Result Page (result.html / result_script.js) ---
        resultPageTitlePrefix: "第 ", // (注意后面的空格)
        quizSummaryTitle: "测验总结",
        returnButton: "返回",
        loadingResults: "正在加载结果...",
        correctText: "正确！",
        incorrectText: "错误。",
        yourAnswer: "你的选择:",
        correctAnswer: "正确答案:",
        explanation: "解析",
        seeAllResultsButton: "查看所有结果",
        errorNoQuizData: "错误：未找到测验题目数据。",
        errorParsingData: "解析题目数据时出错"
    }
    // ... 你可以在此添加 'es', 'fr' 等
};

// 2. 共享的辅助函数：获取当前语言
export function getLanguage() {
    try {
        return localStorage.getItem('userLang') || 'en';
    } catch (e) {
        return 'en';
    }
}

// 3. 共享的核心函数：更新 UI
export function updateUILanguage(lang) {
    if (!lang || !translations[lang]) {
        lang = 'en'; // 确保回退
    }
    
    const texts = translations[lang];
    const fallback = translations['en'];

    // 辅助函数，用于安全地设置文本
    const setText = (id, key) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = texts[key] || fallback[key];
        }
    };

    // 辅助函数，用于安全地设置占位符
    const setPlaceholder = (id, key) => {
        const el = document.getElementById(id);
        if (el) {
            el.placeholder = texts[key] || fallback[key];
        }
    };

    // --- 更新 Main Page (index.html) ---
    setText('main-title', 'mainTitle');
    setText('login-message', 'loginMessage');
    setText('login-btn', 'loginButton');
    setText('guest-btn', 'guestButton');
    setText('user-name-greeting', 'welcomeUser'); // (注意: 'user-name' 将被覆盖)
    setText('start-new-chat-btn', 'newChatButtonText');
    setText('logout-btn', 'logoutButton');
    setText('top-topics-title', 'topTopicsTitle');
    setText('grid-loading-text', 'gridLoading');
    setText('back-to-grid-btn', 'backToTopics');
    setText('quiz-topics-title', 'quizTopicsTitle');
    setText('quiz-grid-loading-text', 'quizGridLoading');
    setText('back-to-grid-btn-quiz', 'backToTopics');
    // ... (为 quiz-list-view-title, list-view-title 等添加更多)

    // --- 更新 Conversation Page (conversation_page.html) ---
    setText('submit-button', 'submitButtonText');
    setText('quiz-button', 'quizButtonText');
    setText('main-page-btn', 'mainPageButtonText');
    setText('new-chat-btn', 'newChatButtonText');
    setText('recent-history-title', 'recentHistoryTitle'); // (你需要给这个 h3 添加 id)
    setPlaceholder('prompt-textarea', 'promptPlaceholder');

    // ... (为 Quiz 和 Result 页面添加 ID) ...
    // --- Quiz Page ---
    setText('quiz-page-title', 'quizPageTitle');
    setText('conversation-btn', 'conversationButton');
    setText('main-page-btn', 'mainPageButtonText'); // (复用)
    setText('back-btn', 'backButton');
    setText('next-quiz-btn', 'nextButton');
    // ( 'question-number-btn' 和 'loading-text' 由 quiz_script.js 动态处理)

    // --- Result Page ---
    // ( 'result-question-title' 和 'loading-text' 由 result_script.js 动态处理)
    // --- Quiz Page ---
    setText('quiz-page-title', 'quizPageTitle');
    setText('conversation-btn', 'conversationButton');
    setText('main-page-btn', 'mainPageButtonText'); // (复用)
    setText('back-btn', 'backButton');
    setText('next-quiz-btn', 'nextButton');
    // ( 'question-number-btn' 和 'loading-text' 由 quiz_script.js 动态处理)

    // --- Result Page ---
    // ( 'result-question-title' 和 'loading-text' 由 result_script.js 动态处理)
    setText('return-btn', 'returnButton');
    setText('next-question-btn', 'nextButton'); // (复用)
    // ( 'main-page-btn' 已在 Quiz Page 部分处理)

    // 4. 保存偏好
    try {
        localStorage.setItem('userLang', lang);
    } catch (e) {
        console.warn("无法保存语言偏好。", e);
    }
}