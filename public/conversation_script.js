// Filename: conversation_script.js (V8.0 - Fixed "History Title" logic)

// --- 1. Imports (Unchanged) ---
import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

// --- 2. Firebase Config (Unchanged) ---
const firebaseConfig = {
  apiKey: "AIzaSyDIEh0vHfo-8iX1EA2I7ijwma-4eLPovxk",
  authDomain: "api-1db96.firebaseapp.com",
  projectId: "api-1db96",
  storageBucket: "api-1db96.firebasestorage.app",
  messagingSenderId: "636817576621",
  appId: "1:636817576621:web:f8a69a44f06b732c24",
  measurementId: "G-9HDH0XHWT1"
};

// --- 3. Initialize Firebase (Unchanged) ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 4. Your App Logic (V8.0) ---
const App = {
    session: null, 
    languageDetector: null, 
    translator: null, 
    supportsTranslation: false, 
    elements: {},
    currentSummary: "", 
    currentCategory: "", 
    currentUser: null, 
    currentDetectedLanguage: 'en', 
    
    currentImageBase64: null, 
    currentImageMimeType: null,

    SUMMARY_SYSTEM_PROMPT: `Summarize the user's input text concisely, focusing on key points and main ideas. If an image is provided, incorporate its context into the summary. Respond ONLY in English.`, 
    CATEGORY_SYSTEM_PROMPT: `You are a librarian. Categorize the following text (and/or image) into a single, general academic subject.
    Respond with ONLY one or two words.
    Examples: "Mathematics", "History", "Biology", "Economics", "Computer Science", "Literature".`,
    
    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();
        
        try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
        } catch (error) {
            console.warn("Could not set PDF.js worker. PDF uploads may fail.", error);
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
        this.elements = {
            chatDisplay: document.getElementById('chat-display-area'),
            chatMain: document.getElementById('chat-main'),
            promptTextarea: document.getElementById('prompt-textarea'),
            submitButton: document.getElementById('submit-button'),
            quizButton: document.getElementById('quiz-button'),
            mainPageButton: document.getElementById('main-page-btn'),
            newChatButton: document.getElementById('new-chat-btn'),
            recentHistoryList: document.getElementById('recent-history-list'),
            imageUploadInput: document.getElementById('image-upload-input'),
            imagePreviewContainer: document.getElementById('image-preview-container'),
            imagePreview: document.getElementById('image-preview'),
            clearImageButton: document.getElementById('clear-image-btn'),
            fileUploadInput: document.getElementById('file-upload-input'),
            loadingOverlay: document.getElementById('loading-overlay'),
        };
    },
    
    setupEventListeners() {
        // (Unchanged)
        this.elements.submitButton.addEventListener('click', this.handleSubmit.bind(this));
        this.elements.promptTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSubmit(); }
        });
        
        this.elements.quizButton.addEventListener('click', () => {
            if (this.currentSummary) {
                sessionStorage.removeItem('currentQuizData');   
                sessionStorage.removeItem('allUserAnswers');    
                sessionStorage.removeItem('nextQuestionIndex'); 
                sessionStorage.removeItem('showAllResults');    
                sessionStorage.setItem('summaryForQuiz', this.currentSummary); 
                sessionStorage.setItem('categoryForQuiz', this.currentCategory); 
                sessionStorage.setItem('languageForQuiz', this.currentDetectedLanguage);
                window.location.href = 'quiz.html';
            } else {
                alert('Please generate a summary first!');
            }
        });

        this.elements.mainPageButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
        this.elements.newChatButton.addEventListener('click', () => {
            window.location.href = 'conversation_page.html'; 
        });

        this.elements.imageUploadInput.addEventListener('change', this.handleImageUpload.bind(this));
        this.elements.clearImageButton.addEventListener('click', this.clearImagePreview.bind(this));
        this.elements.fileUploadInput.addEventListener('change', this.handleFileUpload.bind(this));
    },

    async handleSubmit() {
        const userInput = this.elements.promptTextarea.value.trim();
        if (!userInput && !this.currentImageBase64) return;
        
        // (V7.7 Fix - Lazy load)
        if (!this.languageDetector) {
            try {
                this.showLoading("Initializing language model..."); 
                this.languageDetector = await LanguageDetector.create(); 
                console.log("Language Detector loaded ON DEMAND.");
                this.hideLoading();
            } catch (error) {
                console.error("Failed to load Language Detector:", error);
                this.addMessageToChat("Error: Could not load language features. Please try again.", 'bot', true);
                this.hideLoading();
                return; 
            }
        }

        this.elements.submitButton.disabled = true;
        this.elements.quizButton.disabled = true; 
        this.elements.chatDisplay.innerHTML = '';
        this.addMessageToChat(userInput, 'user', false, this.currentImageBase64); 
        const loadingEl = this.addMessageToChat('Generating summary...', 'bot'); 
        
        try {
            // 1. (V-Text) Detect Language (Unchanged)
            const detectionResult = await this.languageDetector.detect(userInput || " "); 
            if (detectionResult && Array.isArray(detectionResult) && detectionResult.length > 0) {
                this.currentDetectedLanguage = detectionResult[0].detectedLanguage;
            } else {
                this.currentDetectedLanguage = 'en'; 
                console.warn("Language detection returned empty, defaulting to 'en'.");
            }
            console.log(`Language detected: ${this.currentDetectedLanguage}`);

            // 2. (V-Text) Preload (Unchanged)
            this.translator = null;
            this.supportsTranslation = false;
            if (this.currentDetectedLanguage !== 'en') {
                this.showLoading("Loading translation model...");
                try {
                    this.translator = await Translator.create({
                        sourceLanguage: 'en',
                        targetLanguage: this.currentDetectedLanguage
                    });
                    this.supportsTranslation = true;
                } catch (e) {
                    console.warn("Failed to load translator, will show English only.", e);
                }
            }
            this.hideLoading();

            // 3. (V4.4 Fix) Create *Multimodal* (Model A) Session (Unchanged)
            if (this.session) { this.session.destroy(); } 
            
            this.session = await LanguageModel.create({
                initialPrompts: [{ role: 'system', content: this.SUMMARY_SYSTEM_PROMPT }],
                expectedInputs: [ { type: 'text' }, { type: 'image' } ], 
                expectedOutputs: [ { type: 'text' } ]
            });

            // 4. (V4.6 Fix) Build *Multimodal* Message Array (Unchanged)
            const messageContent = []; 
            if (userInput) { 
                messageContent.push({ type: "text", value: userInput }); 
            }
            if (this.currentImageBase64) {
                messageContent.push({ type: "image", value: this.elements.imagePreview });
            }
            const fullPromptArray = [
                { role: 'user', content: messageContent }
            ];
            
            // 5. (V4.6 Fix) Get *English* Summary (Unchanged)
            const stream = await this.session.promptStreaming(fullPromptArray); 
            let englishSummary = '';
            for await (const chunk of stream) { 
                englishSummary += chunk;
                loadingEl.innerHTML = DOMPurify.sanitize(marked.parse(englishSummary));
            }
            
            this.currentSummary = englishSummary; 
            let translatedSummary = englishSummary; 

            // 6. (V-Text Fix) Translate *English* Summary (Unchanged)
            if (this.supportsTranslation && this.translator) {
                loadingEl.innerHTML += "\n\nTranslating to your language...";
                translatedSummary = await this.translator.translate(englishSummary);
                loadingEl.innerHTML = DOMPurify.sanitize(marked.parse(translatedSummary)); 
            }

            // 7. (V7.6 Fix) Categorize and Save
            try {
                if (this.currentUser) {
                    // (V7.9 Fix)
                    await this.categorizeAndSave(userInput, translatedSummary, englishSummary);
                }
            } catch (saveError) {
                console.error("Categorize and save failed, but proceeding...", saveError);
                this.addMessageToChat(`Error saving history: ${saveError.message}`, 'bot', true);
            }
            
            this.elements.quizButton.disabled = false;

        } catch (error) {
            this.addMessageToChat(`Error generating summary: ${error.message}`, 'bot', true);
        } finally {
            this.elements.submitButton.disabled = false;
            this.clearImagePreview(); 
            this.elements.fileUploadInput.value = null; 
        }
    },
    
    // --- (V4.x Image handling functions unchanged) ---
    handleImageUpload: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert("Error: Only JPEG, PNG, and WebP images are supported.");
            return;
        }
        this.currentImageMimeType = file.type;
        const reader = new FileReader();
        reader.onload = (e) => {
            const fullDataUrl = e.target.result;
            this.elements.imagePreview.src = fullDataUrl;
            this.elements.imagePreviewContainer.style.display = 'block';
            this.currentImageBase64 = "exists"; 
        };
        reader.readAsDataURL(file);
    },
    clearImagePreview: function() {
        this.currentImageBase64 = null; 
        this.currentImageMimeType = null;
        this.elements.imagePreview.src = '#';
        this.elements.imagePreviewContainer.style.display = 'none';
        this.elements.imageUploadInput.value = null;
    },
    
    // --- (V-Text File handling functions unchanged) ---
    handleFileUpload: async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.showLoading(`Reading file: ${file.name}...`);
        try {
            const text = await this.extractTextFromFile(file);
            this.elements.promptTextarea.value = text;
            this.addMessageToChat("File content loaded. Click 'Generate Summary' to continue.", 'bot');
        } catch (error) {
            console.error("File extraction error:", error);
            this.addMessageToChat(`Error: ${error.message}`, 'bot', true);
        } finally {
            this.hideLoading();
        }
    },
    extractTextFromFile: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            if (file.type === "application/pdf") {
                reader.onload = (e) => {
                    const data = e.target.result;
                    pdfjsLib.getDocument({ data: data }).promise.then(pdf => {
                        let fullText = "";
                        const pagePromises = [];
                        for (let i = 1; i <= pdf.numPages; i++) {
                            pagePromises.push(pdf.getPage(i).then(page => {
                                return page.getTextContent();
                            }).then(textContent => {
                                return textContent.items.map(item => item.str).join(" ");
                            }));
                        }
                        Promise.all(pagePromises).then(pageTexts => {
                            fullText = pageTexts.join("\n\n");
                            resolve(fullText);
                        });
                    }).catch(error => reject(error));
                };
                reader.readAsArrayBuffer(file);
            } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") { // .docx
                reader.onload = (e) => {
                    mammoth.extractRawText({ arrayBuffer: e.target.result })
                        .then(result => resolve(result.value))
                        .catch(error => reject(error));
                };
                reader.readAsArrayBuffer(file);
            } else if (file.type === "text/plain") { // .txt
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsText(file);
            } else {
                reject(new Error("Unsupported file type. Please upload PDF, DOCX, or TXT."));
            }
        });
    },
    showLoading: function(message) {
        if (!this.elements.loadingOverlay) return;
        this.elements.loadingOverlay.style.display = 'flex';
        this.elements.loadingOverlay.querySelector('p').textContent = message;
    },
    hideLoading: function() {
         if (this.elements.loadingOverlay) {
             this.elements.loadingOverlay.style.display = 'none';
         }
    },
    
    // --- (V7.9 Fixed categorizeAndSave - Use Summary for categorization) ---
    async categorizeAndSave(userInput, translatedSummary, englishSummary) {
        try {
            if (!englishSummary || englishSummary.trim() === "") {
                console.warn("Skipping categorization, no summary available.");
                this.currentCategory = "Uncategorized";
                return; 
            }
            const categorySession = await LanguageModel.create({
                 initialPrompts: [{ role: 'system', content: this.CATEGORY_SYSTEM_PROMPT }],
                 expectedInputs: [ { type: 'text' } ],
                 expectedOutputs: [ { type: 'text' } ]
            });
            const categoryPromptArray = [ 
                { role: 'user', content: [
                    { type: "text", value: englishSummary } 
                ] }
            ];
            const categoryResultString = await categorySession.prompt(categoryPromptArray);
            const category = categoryResultString; 
            this.currentCategory = category.trim(); 

            await db.collection("history").add({
                userId: this.currentUser.uid,
                category: this.currentCategory, 
                originalText: userInput,
                summaryText: translatedSummary, 
                englishSummaryText: englishSummary, 
                detectedLanguage: this.currentDetectedLanguage, 
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Failed to save history:", error);
            this.currentCategory = "Uncategorized"; 
            throw error; // (Important!) Throw the error, let handleSubmit know
        }
    },
    
    // --- (V7.0 Fix: With image - Unchanged) ---
    addMessageToChat: function(content, type = 'bot', isError = false, imageFlag = null) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        if (type === 'user') {
            messageEl.classList.add('user-message');
            if (imageFlag) { 
                const src = this.elements.imagePreview.src; 
                messageEl.innerHTML += `<img src="${src}" style="max-width: 100%; border-radius: 8px; margin-bottom: 8px;">`; 
            }
            if (content) {
                messageEl.innerHTML += `<p>${content}</p>`;
            }
        } else {
            messageEl.classList.add('bot-message');
            messageEl.innerHTML = DOMPurify.sanitize(marked.parse(content));
        }
        if (isError) { messageEl.style.color = 'red'; }
        this.elements.chatDisplay.appendChild(messageEl);
        this.elements.chatDisplay.scrollTop = this.elements.chatDisplay.scrollHeight;
        return messageEl;
    },

    // --- (V-Text History functions - Unchanged) ---
    handleUrlPromptOnLoad: function() {
        const params = new URLSearchParams(window.location.search);
        const promptFromUrl = params.get('prompt');
        if (promptFromUrl) {
            let decodedPrompt = "";
            try { 
                decodedPrompt = decodeURIComponent(promptFromUrl);
            } catch (e) {
                console.error("Error decoding prompt from URL:", e);
                this.addMessageToChat("Error: The text format in the URL is incorrect and cannot be loaded automatically.", 'bot', true);
                return;
            }
            this.elements.promptTextarea.value = decodedPrompt;
            this.addMessageToChat("Text loaded from your history. Please click 'Generate Summary' (Submit button) to start.", 'bot');
        }
    },
    
    // --- (V8.0 Fix: Sidebar title uses summary) ---
    loadRecentHistory: function(userId) {
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

                  // --- VVVV Core Fix (V8.0) VVVV ---
                  const originalText = item.originalText ? item.originalText.trim() : "";
                  let displayText = originalText; 

                  if (!displayText) {
                      // If originalText is empty (pure image)
                      // Prioritize using summaryText (Your new requirement)
                      if (item.summaryText) {
                           displayText = item.summaryText;
                      } else if (item.category && item.category !== "Uncategorized") {
                           // Secondly use category
                          displayText = `[Photo: ${item.category}]`;
                      } else {
                          // Last resort
                          displayText = "Untitled Entry";
                      }
                  }
                  
                  li.textContent = displayText;
                  li.title = displayText; // Mouse hover tooltip also uses it
                  // --- ^^^^ Core Fix (V8.0) ^^^^ ---

                  li.addEventListener('click', () => {
                      this.loadHistoryItem(item);
                  });
                  listEl.appendChild(li);
              });
          }, error => {
              console.error("Error loading sidebar history:", error);
              if (error.code === 'failed-precondition') {
                  listEl.innerHTML = '<p>History index is building. Please wait...</p>';
              } else {
                  listEl.innerHTML = '<p>Error loading history.</p>';
              }
          });
    },

    loadHistoryItem: function(item) {
        // (V7.8 Fix - Unchanged)
        this.elements.chatDisplay.innerHTML = '';
        if (item.originalText && item.originalText.trim() !== "") {
            this.addMessageToChat(item.originalText, 'user');
        } else {
            this.addMessageToChat("<em>(Original input was an image)</em>", 'user');
        }
        
        this.addMessageToChat(item.summaryText, 'bot'); 
        this.currentSummary = item.englishSummaryText || item.summaryText; 
        this.currentCategory = item.category || "Uncategorized";
        this.currentDetectedLanguage = item.detectedLanguage || 'en';
        this.elements.quizButton.disabled = false;
     }
};

// --- 5. Start App (Unchanged) ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});