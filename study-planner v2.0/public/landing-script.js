const firebaseConfig = {
  apiKey: "AIzaSyDIEh0vHfo-8iX1EA2I7ijwma-4eLPovxk",
  authDomain: "api-1db96.firebaseapp.com",
  projectId: "api-1db96",
  storageBucket: "api-1db96.firebasestorage.app",
  messagingSenderId: "636817576621",
  appId: "1:636817576621:web:f8a69a44f06b736fb32c24",
  measurementId: "G-9HDH0XHWT1"
};

/* =================================================
   你的最终版 landing-script.js (即 DashboardApp.js)
   (包含了所有修复)
   ================================================= */



/* =================================================
   你的最终版 landing-script.js (V3 - 修复了 data is not defined)
   (包含了所有修复)
   ================================================= */



// --- 2. 初始化 Firebase ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
const functions = firebase.functions(); // (用于调用后端)

// --- 3. 我们的仪表盘应用 ---
const DashboardApp = {
    fullHistoryData: {}, 
    fullQuizData: {}, 
    elements: {},

    async init() {
        this.cacheDOMElements();
        
        try {
            // (修复 Guest 登出 Bug)
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log("Firebase persistence set to LOCAL.");
        } catch (error) {
            console.error("Failed to set persistence:", error);
        }

        this.setupEventListeners();
        this.handleAuthStateChange();
    },

    cacheDOMElements() {
        this.elements = {
            // 视图
            loggedOutView: document.getElementById('logged-out-view'),
            loggedInView: document.getElementById('logged-in-view'),
            categoryGridView: document.getElementById('category-grid-view'),
            historyListView: document.getElementById('history-list-view'),

            // 按钮
            loginButton: document.getElementById('login-btn'),
            guestButton: document.getElementById('guest-btn'), 
            logoutButton: document.getElementById('logout-btn'),
            startNewChatButton: document.getElementById('start-new-chat-btn'),
            backToGridButton: document.getElementById('back-to-grid-btn'),
            
            // 动态内容
            userName: document.getElementById('user-name'),
            gridLoadingText: document.getElementById('grid-loading-text'),
            categoryGridContainer: document.getElementById('category-grid-container'),
            listViewTitle: document.getElementById('list-view-title'),
            historyListContainer: document.getElementById('history-list-container'),

            // Quiz 元素
            quizGridView: document.getElementById('quiz-grid-view'), 
            quizListView: document.getElementById('quiz-list-view'), 
            quizGridLoadingText: document.getElementById('quiz-grid-loading-text'),
            quizGridContainer: document.getElementById('quiz-grid-container'),
            quizListViewTitle: document.getElementById('quiz-list-view-title'),
            quizListContainer: document.getElementById('quiz-list-container'),
            backToGridButtonQuiz: document.getElementById('back-to-grid-btn-quiz') 
        };
    },

    setupEventListeners() {
        this.elements.loginButton.addEventListener('click', () => {
            auth.signInWithPopup(provider).catch(error => console.error("登录失败:", error));
        });

        this.elements.guestButton.addEventListener('click', () => {
            auth.signInAnonymously().catch(error => console.error("匿名登录失败:", error));
        });

        this.elements.logoutButton.addEventListener('click', () => {
            auth.signOut();
        });
        
        this.elements.startNewChatButton.addEventListener('click', () => {
            window.location.href = 'conversation_page.html';
        });

        this.elements.backToGridButton.addEventListener('click', () => {
            this.showView('grid');
        });

        this.elements.backToGridButtonQuiz.addEventListener('click', () => {
            this.showView('quiz-grid');
        });
    },

    handleAuthStateChange() {
        auth.onAuthStateChanged(user => {
            if (user) {
                this.elements.loggedInView.style.display = 'block';
                this.elements.loggedOutView.style.display = 'none';

                if (user.isAnonymous) {
                    this.elements.userName.textContent = 'Guest User';
                } else {
                    this.elements.userName.textContent = user.displayName;
                }
                
                this.loadHistoryAndBuildGrid(user.uid); 
                this.loadQuizzes(); 

            } else {
                this.elements.loggedInView.style.display = 'none';
                this.elements.loggedOutView.style.display = 'block';
                this.fullHistoryData = {}; 
                this.fullQuizData = {}; 
            }
        });
    },

    async loadHistoryAndBuildGrid(userId) {
        // (不变 ... 包含 'id: doc.id' 修复)
        this.elements.gridLoadingText.textContent = 'Loading your history...';
        try {
            const snapshot = await db.collection("history").where("userId", "==", userId).orderBy("timestamp", "desc").get();
            if (snapshot.empty) {
                this.elements.gridLoadingText.textContent = 'No history found. Start a new chat!';
                return;
            }
            const categoryCounts = {};
            snapshot.forEach(doc => {
                const item = doc.data();
                const category = item.category || "Uncategorized"; 
                if (!categoryCounts[category]) {
                    categoryCounts[category] = { count: 0, items: [] };
                }
                categoryCounts[category].count++;
                categoryCounts[category].items.push({ id: doc.id, ...item });
            });
            this.fullHistoryData = categoryCounts;
            const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1].count - a[1].count);
            this.displayCategoryView(sortedCategories);
        } catch (error) {
            console.error("加载历史失败:", error);
            this.elements.gridLoadingText.textContent = 'Error loading history.';
        }
    },

    displayCategoryView(sortedCategories) {
        // (不变)
        this.elements.categoryGridContainer.innerHTML = ''; 
        this.elements.gridLoadingText.style.display = 'none'; 
        const topCategories = sortedCategories.slice(0, 6);
        topCategories.forEach(([categoryName, data]) => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.category = categoryName;
            card.innerHTML = `<h3>${categoryName}</h3><p>${data.count} summaries</p>`;
            card.addEventListener('click', () => {
                this.displayListView(categoryName);
            });
            this.elements.categoryGridContainer.appendChild(card);
        });
    },

    displayListView(categoryName) {
        // (不变 ... 包含删除按钮的逻辑)
        const data = this.fullHistoryData[categoryName];
        if (!data) return; 
        this.elements.listViewTitle.textContent = categoryName; 
        this.elements.historyListContainer.innerHTML = ''; 
        data.items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'history-list-item'; 
            const textEl = document.createElement('p');
            textEl.textContent = item.originalText;
            textEl.addEventListener('click', () => {
                const encodedText = encodeURIComponent(item.originalText);
                window.location.href = `conversation_page.html?prompt=${encodedText}`;
            });
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×'; 
            deleteBtn.dataset.id = item.id; 
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                this.deleteHistoryItem(item.id, itemEl, categoryName); 
            });
            itemEl.appendChild(textEl);
            itemEl.appendChild(deleteBtn);
            this.elements.historyListContainer.appendChild(itemEl);
        });
        this.showView('list');
    },

    async deleteHistoryItem(id, element, categoryName) {
        // (不变 ... 删除函数的逻辑)
        if (!confirm("Are you sure you want to delete this summary?")) {
            return;
        }
        try {
            await db.collection("history").doc(id).delete();
            element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            element.style.opacity = '0';
            element.style.transform = 'translateX(20px)';
            setTimeout(() => { element.remove(); }, 300);
            const categoryData = this.fullHistoryData[categoryName];
            if (categoryData) {
                categoryData.items = categoryData.items.filter(item => item.id !== id);
                categoryData.count--;
                const gridCard = this.elements.categoryGridContainer.querySelector(`[data-category="${categoryName}"]`);
                if (gridCard) {
                    const p = gridCard.querySelector('p');
                    if (p) p.textContent = `${categoryData.count} summaries`;
                }
            }
        } catch (error) {
            console.error("Error removing document: ", error);
            alert("Failed to delete summary.");
        }
    },

    async loadQuizzes() {
        // (不变)
        this.elements.quizGridLoadingText.textContent = 'Loading your quizzes...';
        try {
            const getTopicsWithQuizzes = functions.httpsCallable('getTopicsWithQuizzes');
            const result = await getTopicsWithQuizzes();
            const quizTopics = result.data; 
            if (!quizTopics || quizTopics.length === 0) {
                this.elements.quizGridLoadingText.textContent = 'No quizzes found.';
                return;
            }
            this.fullQuizData = quizTopics.reduce((acc, topic) => {
                acc[topic.topicName] = topic.quizzes; 
                return acc;
            }, {});
            this.displayQuizCategoryView(quizTopics);
        } catch (error) {
            console.error("加载 Quizzes 失败:", error);
            this.elements.quizGridLoadingText.textContent = `Error loading quizzes: ${error.message}`;
        }
    },

    displayQuizCategoryView(quizTopics) {
        // (不变)
        this.elements.quizGridContainer.innerHTML = ''; 
        this.elements.quizGridLoadingText.style.display = 'none'; 
        quizTopics.forEach(topic => {
            const card = document.createElement('div');
            card.className = 'category-card'; 
            card.dataset.category = topic.topicName;
            card.innerHTML = `<h3>${topic.topicName}</h3><p>${topic.quizzes.length} quizzes</p>`;
            card.addEventListener('click', () => {
                this.displayQuizListView(topic.topicName);
            });
            this.elements.quizGridContainer.appendChild(card);
        });
    },

    // --- VVVV 核心修复 VVVV ---
    // (修复了 'data is not defined' Bug)
    displayQuizListView(categoryName) {
        const quizzes = this.fullQuizData[categoryName];
        
        // --- VVVV 修复：从 'data' 改为 'quizzes' VVVV ---
        if (!quizzes) return; 
        // --- ^^^^ ------------------------------ ^^^^ ---

        this.elements.quizListViewTitle.textContent = categoryName; 
        this.elements.quizListContainer.innerHTML = ''; 

        quizzes.forEach(quiz => {
            const itemEl = document.createElement('div');
            itemEl.className = 'history-list-item'; 
            itemEl.innerHTML = `<p>${quiz.title}</p> <span class="quiz-type-badge">${quiz.type}</span>`;

            itemEl.addEventListener('click', () => {
                // (已修复 404 Bug)
                window.location.href = `quiz.html?quizId=${quiz.id}`;
            });
            
            this.elements.quizListContainer.appendChild(itemEl);
        });

        this.showView('quiz-list');
    },
    // --- ^^^^ 核心修复 ^^^^ ---

    showView(viewName) {
        // (不变)
        this.elements.categoryGridView.style.display = 'none';
        this.elements.historyListView.style.display = 'none';
        if (this.elements.quizGridView) this.elements.quizGridView.style.display = 'none';
        if (this.elements.quizListView) this.elements.quizListView.style.display = 'none';
        
        if (viewName === 'grid') { 
            this.elements.categoryGridView.style.display = 'block';
            if (this.elements.quizGridView) this.elements.quizGridView.style.display = 'block';
        } else if (viewName === 'list') { 
            this.elements.historyListView.style.display = 'block';
        } else if (viewName === 'quiz-grid') { 
             this.elements.categoryGridView.style.display = 'block';
             if (this.elements.quizGridView) this.elements.quizGridView.style.display = 'block';
        } else if (viewName === 'quiz-list') { 
            this.elements.quizListView.style.display = 'block';
        }
    }
};

// --- 启动应用 ---
document.addEventListener('DOMContentLoaded', () => {
    DashboardApp.init();
});