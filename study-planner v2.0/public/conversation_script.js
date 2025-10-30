// Filename: conversation_script.js
// Full Content:
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
  appId: "1:636817576621:web:f8a69a44f06b732c24",
  measurementId: "G-9HDH0XHWT1"
};

// --- 3. 初始化 Firebase (不变) ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 4. 你的 App 逻辑 ---
const App = {
    session: null, // Main session for text
    languageDetector: null, // Language Detector instance
    supportsTranslation: false, // Flag for translation support
    elements: {},
    currentSummary: "", // This will store the English summary for the Quiz
    currentCategory: "",
    currentDetectedLanguage: 'en', // Tracks the language of the current session/summary
    currentUser: null,
    // Updated prompt to ensure output is English for consistent translation source
    SUMMARY_SYSTEM_PROMPT: `Summarize the user's input text concisely, focusing on key points and main ideas. Respond in English.`,
    CATEGORY_SYSTEM_PROMPT: `You are a librarian. Categorize the following text into a single, general academic subject. Respond with ONLY one or two words. Examples: "Mathematics", "History", "Biology", "Economics", "Computer Science", "Literature".`,

    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();
        if (!('LanguageModel'in self)) {
            this.addMessageToChat('错误：您的浏览器不支持内置的Prompt API。', 'bot', true);
            // Disable input if core API is missing
            this.toggleInputs(true);
            return;
        }

        // Check for LanguageDetector and Translator support
        // We also check Translator here because we use it for pre-emptive downloads
        this.supportsTranslation = ('LanguageDetector' in self) && ('Translator' in self);

        if (this.supportsTranslation) {
            try {
                // Initialize detector
                this.languageDetector = await LanguageDetector.create();
                console.log("LanguageDetector and Translator APIs available.");
            } catch (error) {
                console.error("Failed to initialize LanguageDetector:", error);
                this.supportsTranslation = false; // Disable if initialization fails
            }
        } else {
            console.warn("LanguageDetector or Translator API not supported. Translation features disabled.");
        }

        auth.onAuthStateChanged(user => {
            if (user) {
                this.currentUser = user; this.loadRecentHistory(user.uid);
            } else {
                this.currentUser = null; if (this.elements.recentHistoryList) { this.elements.recentHistoryList.innerHTML = '<p>Please login to see recent history.</p>'; }
            }
        });
        this.handleUrlPromptOnLoad();
     },

    // Helper function to disable/enable inputs
    toggleInputs(disabled, disableQuiz = false) {
        if(this.elements.submitButton) this.elements.submitButton.disabled = disabled;
        if(disableQuiz && this.elements.quizButton) this.elements.quizButton.disabled = disabled;
        if(this.elements.fileUploadInput) this.elements.fileUploadInput.disabled = disabled;
        if(this.elements.fileUploadButton) this.elements.fileUploadButton.style.opacity = disabled ? 0.5 : 1;
        if(this.elements.promptTextarea) this.elements.promptTextarea.disabled = disabled;
    },

    // Helper function for language names (adapted from playground example)
    languageTagToHumanReadable(languageTag, targetLanguage = 'en') {
        try {
            const displayNames = new Intl.DisplayNames([targetLanguage], {
                type: 'language',
            });
            return displayNames.of(languageTag);
        } catch (error) {
            console.error("Error getting language name:", error);
            return languageTag;
        }
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
            fileUploadInput: document.getElementById('file-upload-input'),
            fileUploadButton: document.getElementById('file-upload-button'), // The label for doc/text
            fileStatusDisplay: document.getElementById('file-status-display')
        };
     },

    // (Updated) Added async logic to the Quiz Button listener for pre-emptive downloads
    setupEventListeners() {
        if (this.elements.submitButton) {
            this.elements.submitButton.addEventListener('click', this.handleSubmit.bind(this));
        }
        if (this.elements.promptTextarea) {
            this.elements.promptTextarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSubmit(); }
            });
        }
        if (this.elements.quizButton) {
            // *** Major Change: Made this listener async ***
             this.elements.quizButton.addEventListener('click', async () => {
                if (this.currentSummary) {
                    sessionStorage.removeItem('currentQuizData');
                    sessionStorage.removeItem('allUserAnswers');
                    sessionStorage.removeItem('nextQuestionIndex');
                    sessionStorage.removeItem('showAllResults');
                    // currentSummary is maintained as the English version for the quiz
                    sessionStorage.setItem('summaryForQuiz', this.currentSummary);
                    sessionStorage.setItem('categoryForQuiz', this.currentCategory);
                    // Pass the detected language preference to the quiz page
                    sessionStorage.setItem('languageForQuiz', this.currentDetectedLanguage);

                    // *** FIX: Pre-emptive Download Initiation ***
                    // To prevent the "User Gesture Required" error on the quiz page,
                    // we initiate the download NOW using the fresh click gesture, BEFORE navigation.
                    const sourceLang = 'en';
                    const targetLang = this.currentDetectedLanguage;

                    // Check if Translator is available and translation is needed
                    if (this.supportsTranslation && targetLang !== sourceLang && 'Translator' in self) {
                        try {
                            console.log(`Pre-emptively checking/initiating download for ${targetLang}...`);
                            // Check availability (this is usually fast)
                            const availability = await Translator.availability({ sourceLanguage: sourceLang, targetLanguage: targetLang });

                            // If it needs to be downloaded, start the creation process now.
                            if (availability === 'downloadable' || availability === 'downloading') {
                                console.log(`Status: ${availability}. Initiating background download.`);
                                // Initiate creation. We do NOT await it, as we want to navigate immediately.
                                // The download will continue in the background. When quiz.html calls create(), it will resolve when the download finishes.
                                Translator.create({ sourceLanguage: sourceLang, targetLanguage: targetLang })
                                    .then(() => console.log(`Pre-emptive creation/download for ${targetLang} completed successfully.`))
                                    .catch(err => console.error(`Pre-emptive creation/download for ${targetLang} failed:`, err));
                            } else {
                                console.log(`Language ${targetLang} status: ${availability}. No immediate action needed.`);
                            }
                        } catch (error) {
                            // Catch errors during availability check or initiation attempt
                            console.error("Error during pre-emptive translation check:", error);
                        }
                    }
                    // *********************************************

                    // Navigate to the quiz page
                    window.location.href = 'quiz.html';
                } else {
                    alert('请先生成一个摘要！');
                }
            });
        }
        if (this.elements.mainPageButton) {
            this.elements.mainPageButton.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        if (this.elements.newChatButton) {
             this.elements.newChatButton.addEventListener('click', () => {
                // Reset context for a new chat
                this.currentDetectedLanguage = 'en';
                window.location.href = 'conversation_page.html';
            });
        }
        if (this.elements.fileUploadInput) {
            this.elements.fileUploadInput.addEventListener('change', this.handleFileUpload.bind(this));
        }
         // No listener needed for the label (#file-upload-button), relies on default behavior
    },

    // (No significant changes here, keeping the optimized flow)
    async handleSubmit() {
        const userInput = this.elements.promptTextarea.value.trim(); if (!userInput) return;

        // 1. UI Setup
        this.toggleInputs(true, true); // Disable all inputs

        if (this.elements.fileStatusDisplay) this.elements.fileStatusDisplay.textContent = '';
        this.elements.promptTextarea.value = '';

        const welcomeMessage = this.elements.chatDisplay.querySelector('h2');
        if (welcomeMessage && welcomeMessage.textContent.includes('Welcome!')) {
            this.elements.chatDisplay.innerHTML = '';
        }

        this.addMessageToChat(userInput, 'user');
        // Update initial message to reflect the new process
        const loadingEl = this.addMessageToChat('Detecting language and preparing resources...', 'bot');

        let detectedLanguage = 'en';
        const summarySourceLanguage = 'en'; // We explicitly requested English in the prompt
        let translationPromise = null; // Promise to hold the translator instance if download starts

        try {
            // 2. Language Detection (Quick)
            if (this.supportsTranslation && this.languageDetector) {
                try {
                    const detectionResult = await this.languageDetector.detect(userInput);
                    if (detectionResult && detectionResult.length > 0) {
                        detectedLanguage = detectionResult[0].detectedLanguage;
                        console.log(`Detected input language: ${detectedLanguage}`);
                    }
                } catch (error) {
                    console.error("Language detection failed:", error);
                    // Proceed with default 'en' if detection fails
                }
            }

            // Store the detected language for this session/summary
            this.currentDetectedLanguage = detectedLanguage;

            const expectTranslation = this.supportsTranslation && detectedLanguage !== summarySourceLanguage;

            // 3. Check Availability and Initiate Download (Crucial Step)
            // We do this NOW, while the user gesture from the submit click is still active.
            if (expectTranslation) {
                try {
                    const availability = await Translator.availability({ sourceLanguage: summarySourceLanguage, targetLanguage: detectedLanguage });
                    console.log(`Translator availability for ${detectedLanguage}: ${availability}`);

                    // 'on-device' (or sometimes 'available') means it's ready immediately.
                    // 'downloadable' or 'downloading' means we must initiate the download now using the gesture.
                    if (availability === 'on-device' || availability === 'available' || availability === 'downloadable' || availability === 'downloading') {
                        console.log(`Status: ${availability}. Initiating creation/download.`);

                        // Start creation but DON'T await it yet. Store the promise.
                        // This allows the download to start concurrently with the summarization.
                        translationPromise = Translator.create({ sourceLanguage: summarySourceLanguage, targetLanguage: detectedLanguage })
                            .catch(error => {
                                // This catches the "User Gesture Required" error if the gesture expired too quickly, or network errors.
                                console.error("Translator creation/download initiation failed:", error);
                                return { error: error.message }; // Return an error object for better messaging
                            });
                    }
                    // If 'unavailable', translationPromise remains null.

                } catch (error) {
                    console.error("Error checking translation availability:", error);
                    // Proceed without translation if availability check fails
                }
            }

            // 4. Summarization (Long process, runs concurrently with download)
            let statusMessage = 'Generating summary...';
            if (translationPromise && expectTranslation) {
                 // Update status if a download might be happening concurrently
                statusMessage = `(Preparing translation: ${this.languageTagToHumanReadable(detectedLanguage)}...) Generating summary...`;
            }
            loadingEl.innerHTML = DOMPurify.sanitize(marked.parse(statusMessage));


            if (!this.session) {
                this.session = await LanguageModel.create({
                    initialPrompts: [{ role: 'system', content: this.SUMMARY_SYSTEM_PROMPT }],
                });
            }

            const stream = await this.session.promptStreaming(userInput);
            let englishSummary = '';

            // Consume the stream.
            for await (const chunk of stream) {
                englishSummary += chunk;
                // Only update the display if we are NOT expecting a translation (Hybrid Streaming).
                // This prevents flashing English text before the translation is ready.
                if (!expectTranslation) {
                    loadingEl.innerHTML = DOMPurify.sanitize(marked.parse(englishSummary));
                    this.elements.chatDisplay.scrollTop = this.elements.chatDisplay.scrollHeight;
                }
            }

            let displayedSummary = englishSummary;

            // 5. Finalize Translation
            if (expectTranslation) {
                if (translationPromise) {
                    loadingEl.innerHTML = DOMPurify.sanitize(marked.parse('Finalizing translation...'));
                    // Now we await the translator creation/download promise started in Step 3.
                    const translator = await translationPromise;

                    if (translator && !translator.error) {
                        try {
                            const translatedText = await translator.translate(englishSummary);
                            displayedSummary = translatedText;
                        } catch (translationError) {
                            // Error during the actual translation process
                             displayedSummary = `${englishSummary}\n\n*(Translation failed: ${translationError.message})*`;
                        }
                    } else {
                        // Translator creation/download failed (e.g., the gesture issue persisted or network error)
                        const errorDetail = translator?.error || "Unknown error";
                        // Provide specific feedback if it was the gesture issue
                        if (errorDetail.includes('Requires a user gesture')) {
                             // If the gesture failed even with the optimized flow, provide the English summary and context.
                            displayedSummary = `${englishSummary}\n\n*(Translation failed: Browser requires permission to download language pack. The automatic download was blocked. Please ensure downloads are allowed and try again.)*`;
                        } else {
                            displayedSummary = `${englishSummary}\n\n*(Translation failed: Could not prepare language pack. ${errorDetail})*`;
                        }
                    }
                } else {
                    // Availability was 'unavailable' (translationPromise was null)
                    displayedSummary = `${englishSummary}\n\n*(Note: Translation to ${this.languageTagToHumanReadable(detectedLanguage)} is unavailable.)*`;
                }
            }

            // 6. Final Display
            // If we buffered (expected translation), we now update the display.
            if (expectTranslation) {
                loadingEl.innerHTML = DOMPurify.sanitize(marked.parse(displayedSummary));
                this.elements.chatDisplay.scrollTop = this.elements.chatDisplay.scrollHeight;
            }

            // 7. Save History and set context
            // We call this regardless of login status to ensure currentSummary is set for the session
            await this.categorizeAndSave(userInput, displayedSummary, englishSummary);

        } catch (error) {
            // Catches errors primarily from the Prompt API or major flow issues
            console.error("Error during handleSubmit:", error);
            this.addMessageToChat(`生成摘要时出错: ${error.message}`, 'bot', true);
        }
        finally {
            // Re-enable inputs
            this.toggleInputs(false);
            // Enable Quiz button if a summary was successfully generated
            if (this.currentSummary && this.elements.quizButton) {
                this.elements.quizButton.disabled = false;
            }
            if (this.elements.fileUploadInput) {
                this.elements.fileUploadInput.value = null; // Clear file input
            }
        }
     },

    async handleFileUpload(event) {
        // (No changes required here)
        // --- THIS IS THE CORRECT LOGIC for DOC/PDF/TXT ---
        const file = event.target.files[0];
        if (!file) {
            if (this.elements.fileUploadInput) this.elements.fileUploadInput.value = null; // Clear selection if cancelled
            return;
        }

        const fileType = file.type;
        const fileName = file.name;

        // Only process supported document types
        if (
            fileType === 'application/pdf' ||
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileType === 'text/plain' ||
            fileName.endsWith('.docx') || fileName.endsWith('.pdf') || fileName.endsWith('.txt')
        ) {
            // Disable buttons during processing
            this.elements.submitButton.disabled = true;
            if (this.elements.fileUploadButton) this.elements.fileUploadButton.style.opacity = 0.5;
            if (this.elements.fileStatusDisplay) this.elements.fileStatusDisplay.textContent = `Reading ${file.name}...`;

            try {
                const text = await this.extractTextFromFile(file);
                this.elements.promptTextarea.value = text; // Put extracted text in box
                if (this.elements.fileStatusDisplay) this.elements.fileStatusDisplay.textContent = `Loaded ${file.name}. Click 'Generate Summary'.`;
                this.elements.submitButton.disabled = false; // Enable submit now text is ready
            } catch (error) {
                console.error("File extraction error:", error);
                if (this.elements.fileStatusDisplay) this.elements.fileStatusDisplay.textContent = `Error: ${error.message}`;
                // Re-enable upload button on error
                if (this.elements.fileUploadButton) this.elements.fileUploadButton.style.opacity = 1;
                this.elements.submitButton.disabled = false; // Also re-enable submit just in case
            } finally {
                 // Always clear the file input selection after processing or error
                 if (this.elements.fileUploadInput) this.elements.fileUploadInput.value = null;
                 // Re-enable upload button if it wasn't already
                 if (this.elements.fileUploadButton) this.elements.fileUploadButton.style.opacity = 1;
            }
        } else {
             // File type not supported by this workflow
            alert("Unsupported file type. Please upload PDF, DOCX, or TXT using this button.");
             if (this.elements.fileUploadInput) this.elements.fileUploadInput.value = null; // Clear the invalid selection
        }
    },

    async extractTextFromFile(file) {
        // (Optimized file reading logic)
        const fileType = file.name.split('.').pop().toLowerCase();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                     // Check if the result is already a string (happens if readAsText was called for TXT)
                    if (typeof e.target.result === 'string') {
                        resolve(e.target.result);
                        return;
                    }

                    const arrayBuffer = e.target.result;
                    if (fileType === 'pdf') {
                        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        let fullText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            fullText += textContent.items.map(item => item.str).join(' ') + '\n';
                        } resolve(fullText);
                    } else if (fileType === 'docx') {
                        const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                        resolve(result.value);
                    } else if (fileType === 'txt') {
                        // This path handles the case where TXT was somehow read as ArrayBuffer (less likely but safe)
                        const textDecoder = new TextDecoder("utf-8");
                        resolve(textDecoder.decode(arrayBuffer));
                    }
                     else { reject(new Error("Unsupported file. Use PDF, DOCX, or TXT.")); }
                } catch (error) { reject(new Error(`Failed to parse ${fileType}: ${error.message}`)); }
            };
            reader.onerror = (e) => { reject(new Error("Failed to read file.")); };

            // Use the most efficient reading method per file type
            if (fileType === 'txt') {
                reader.readAsText(file);
            } else if (fileType === 'pdf' || fileType === 'docx') {
                reader.readAsArrayBuffer(file);
            }
            else { reject(new Error("Unsupported file. Use PDF, DOCX, or TXT.")); }
        });
     },

    // Updated to handle saving both displayed and English summaries, AND the detected language
    async categorizeAndSave(userInput, summaryText, englishSummary = null) {
        // Determine the definitive English version for Quizzes and set it as currentSummary
        const summaryForQuiz = englishSummary || summaryText;
        this.currentSummary = summaryForQuiz;

        // If the user is not logged in, we set the context for the session but don't save to DB.
        if (!this.currentUser) {
            this.currentCategory = "Session";
            // Ensure language is set even for guests
            if (!this.currentDetectedLanguage) this.currentDetectedLanguage = 'en';
            return;
        }

        try {
            const categorySession = await LanguageModel.create({
                initialPrompts: [{ role: 'system', content: this.CATEGORY_SYSTEM_PROMPT }],
            });
            // Categorization is based on the original user input
            const category = await categorySession.prompt(userInput);
            this.currentCategory = category.trim();

            const dataToSave = {
                userId: this.currentUser.uid,
                category: this.currentCategory,
                originalText: userInput,
                summaryText: summaryText, // The displayed (potentially translated) summary
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                detectedLanguage: this.currentDetectedLanguage // Save the language preference
            };

            // If translation happened (englishSummary is provided and different), save the English version separately.
            if (englishSummary && englishSummary !== summaryText) {
                dataToSave.englishSummaryText = englishSummary;
            }

            await db.collection("history").add(dataToSave);

        } catch (error) {
            console.error("Save history failed:", error);
            this.currentCategory = "Uncategorized";
        }
     },

    handleUrlPromptOnLoad() {
        // (No changes required here)
        const params = new URLSearchParams(window.location.search);
        const promptFromUrl = params.get('prompt');
        const loadFromHistory = params.get('loadFromHistory');

        if (promptFromUrl) {
            let decodedPrompt = "";
            try {
                decodedPrompt = decodeURIComponent(promptFromUrl);
            } catch (e) {
                console.error("Could not decode prompt from URL:", e);
                this.addMessageToChat("Error: Invalid text format in URL, cannot load automatically.", 'bot', true);
                return;
            }
            this.elements.promptTextarea.value = decodedPrompt;
            this.addMessageToChat("Click 'Generate Summary' to start.", 'bot');

        } else if (loadFromHistory === 'true') {
            const promptFromSession = sessionStorage.getItem('promptToLoadFromHistory');
            if (promptFromSession) {
                this.elements.promptTextarea.value = promptFromSession;
                sessionStorage.removeItem('promptToLoadFromHistory');
                this.addMessageToChat("Loaded from history. Click 'Generate Summary' to re-run.", 'bot');
            }
        }
     },

    addMessageToChat(content, type = 'bot', isError = false) {
        // (No changes required here)
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';

        if (type === 'user') {
            messageEl.classList.add('user-message');
            messageEl.innerHTML = `<p>${content}</p>`; // Always wrap user text in <p>
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
        // (No changes required here)
        const listEl = this.elements.recentHistoryList;
        listEl.innerHTML = ''; // Clear previous items/message
        db.collection("history")
          .where("userId", "==", userId)
          .orderBy("timestamp", "desc")
          .limit(15)
          .onSnapshot(snapshot => {
              if (snapshot.empty) {
                  listEl.innerHTML = '<p>No recent history.</p>';
                  return;
              }
              listEl.innerHTML = ''; // Clear loading/no history message
              snapshot.forEach(doc => {
                  const item = doc.data();
                  const li = document.createElement('li');
                  li.className = 'recent-item';
                  li.textContent = item.originalText; // Display original text
                  li.title = item.originalText; // Show full text on hover
                  li.addEventListener('click', () => {
                      this.loadHistoryItem(item);
                  });
                  listEl.appendChild(li);
              });
          }, error => {
              console.error("Error loading sidebar history:", error);
              listEl.innerHTML = '<p>Error loading history.</p>';
          });
     },

    // Updated to prioritize English summary for the Quiz feature AND load the language preference
    loadHistoryItem(item) {
        // Always clears the screen when loading a history item
        this.elements.chatDisplay.innerHTML = '';
        this.addMessageToChat(item.originalText, 'user');
        // Display the summary that was shown to the user (potentially translated)
        this.addMessageToChat(item.summaryText, 'bot');

        // Set currentSummary to the English version if it exists, otherwise use the displayed version
        this.currentSummary = item.englishSummaryText || item.summaryText;
        this.currentCategory = item.category || "Uncategorized";
        // Load the language preference associated with this history item
        this.currentDetectedLanguage = item.detectedLanguage || 'en';
        this.elements.quizButton.disabled = false;
     }
};

// --- 5. Start App (Unchanged) ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});