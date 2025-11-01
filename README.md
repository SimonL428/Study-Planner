# AI-Powered Summarization and Quiz Generator

## Overview

This web application is an intelligent, AI-powered study and productivity tool designed to help users efficiently process, understand, and retain information from various text sources. It addresses the modern challenge of information overload by providing concise summaries and personalized reinforcement learning through interactive quizzes, all within a seamless, multi-lingual interface. By streamlining the learning process, this tool helps students, researchers, and professionals save time and improve comprehension when dealing with lengthy documents.

## Key Features

- **Intelligent Summarization:** Upload documents (PDF, DOCX, PNG, JPEG, etc) or paste text directly to receive a concise summary of the key concepts.
- **Multi-Lingual Interface:** The application automatically detects the user's input language, processes the content, and translates the final summary back into the original language.
- **Interactive Quiz Generation:** Generate personalized multiple-choice quizzes based on the summarized content to reinforce learning.
- **Translated Quizzes:** Quizzes (questions, options, and explanations) are also presented in the user's original language. A "Generate Quiz" button ensures compliance with browser security policies for downloading necessary translation models on demand.
- **Automatic Categorization:** Inputs are automatically categorized by subject (e.g., Biology, History).
- **User History and Persistence:** Integrated with Firebase for user authentication, allowing users to save and revisit their summaries and generated quizzes.

## Technologies and APIs Used

This application leverages cutting-edge, on-device AI APIs, ensuring enhanced user privacy and performance as processing occurs locally.

- **Prompt API (`LanguageModel`):** The core engine used for text summarization, content categorization, and quiz generation (e.g., Gemini Nano).
- **Language Detector API (`LanguageDetector`):** Automatically determines the language of the user's input text.
- **Translator API (`Translator`):** Handles on-device translation of summaries and quiz content into the user's preferred language.
- **Firebase (Firestore & Authentication):** Used for user management and data persistence (history and quizzes).
- **Libraries:** `pdf.js` (PDF extraction), `mammoth.js` (DOCX extraction), `marked.js` (Markdown rendering), `DOMPurify` (Security).

