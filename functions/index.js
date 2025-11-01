// --- 1. 导入 Firebase 模块 (2代 语法) ---
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// --- 2. 初始化 Admin SDK (2代 语法) ---
initializeApp();
const db = getFirestore();

/*
 * ===================================================================
 * 函数 #1: 获取按 Topic 分类的 Quizzes (2代 语法)
 * ===================================================================
 */
exports.getTopicsWithQuizzes = onCall(async (request) => {
    // 1. 检查“身份证” (2代 语法)
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const userId = request.auth.uid; // (2代 语法)

    try {
        // 2. 从 'quizzes' 集合中获取
        const quizzesSnapshot = await db.collection("quizzes")
                              .where("userId", "==", userId)
                              .get();
        
        // (后面的逻辑和以前一样)
        const topicsMap = new Map();
        quizzesSnapshot.forEach(doc => {
            const quiz = doc.data();
            const topicName = quiz.topicName || "Uncategorized";
            if (!topicsMap.has(topicName)) {
                topicsMap.set(topicName, []);
            }
            if (topicsMap.get(topicName).length < 5) {
                topicsMap.get(topicName).push({
                    id: doc.id,
                    title: quiz.title,
                    type: quiz.quizType
                });
            }
        });

        const result = Array.from(topicsMap.entries()).map(([name, quizzes]) => {
            return { topicName: name, quizzes: quizzes };
        });

        return result;

    } catch (error) {
        console.error("Error in getTopicsWithQuizzes:", error);
        throw new HttpsError("internal", "Failed to get quiz topics.");
    }
});


/*
 * ===================================================================
 * 函数 #2: 获取 "Top Topics" (来自 History) (2代 语法)
 * ===================================================================
 */
exports.getTopTopics = onCall(async (request) => {
    // 1. 检查“身份证” (2代 语法)
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const userId = request.auth.uid; // (2代 语法)

    try {
        // 2. 从 'history' 集合中获取
        const historySnapshot = await db.collection("history")
                                        .where("userId", "==", userId)
                                        .get();
        
        // (后面的逻辑和以前一样)
        const categoryCounts = {};
        historySnapshot.forEach(doc => {
            const item = doc.data();
            const category = item.category || "Uncategorized";
            if (!categoryCounts[category]) {
                categoryCounts[category] = 0;
            }
            categoryCounts[category]++;
        });

        const sortedCategories = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1]);

        const topCategories = sortedCategories.slice(0, 6).map(([name, count]) => {
            return { topicName: name, count: count };
        });

        return topCategories;

    } catch (error) {
        console.error("Error in getTopTopics:", error);
        throw new HttpsError("internal", "Failed to get top topics.");
    }
});