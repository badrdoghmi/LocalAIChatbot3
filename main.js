// main.js - Chatbot avec modèle léger WebLLM et Gemini par défaut
class ChatBot {
  constructor() {
    this.engine = null;
    // Modèles disponibles
    this.availableModels = [
      "Llama-3.2-1B-Instruct-q4f32_1-MLC",
      "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC"
    ];
    this.selectedModel = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
    this.isInitialized = false;
    this.currentMode = 'cloud';
    this.isGenerating = false;
    this.localModelLoading = false;
    this.chatHistory = [];
    this.currentImage = null;
    this.webllmAvailable = false;
    
    this.initializeApp();
  }

  async initializeApp() {
    try {
      // Vérifier si WebLLM est disponible
      await this.checkWebLLMAvailability();
      
      // Initialize UI elements
      this.initializeUI();
      
      // Cache le loading screen car on utilise Gemini par défaut
      this.hideLoadingScreen();
      
      // Load chat history from localStorage
      this.loadChatHistory();
      
      // Add welcome message if no history
      if (this.chatHistory.length === 0) {
        this.addWelcomeMessage();
      } else {
        this.displayChatHistory();
      }
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.showError('Erreur lors de l\'initialisation: ' + error.message);
    }
  }

  async checkWebLLMAvailability() {
    return new Promise((resolve) => {
      let checks = 0;
      const maxChecks = 50; // 5 secondes maximum
      
      const checkInterval = setInterval(() => {
        checks++;
        
        if (typeof webllm !== 'undefined' && window.webllmLoaded !== false) {
          clearInterval(checkInterval);
          this.webllmAvailable = true;
          console.log('WebLLM is available');
          this.updateWebLLMStatus('Modèles locaux disponibles');
          resolve(true);
        } else if (checks >= maxChecks) {
          clearInterval(checkInterval);
          this.webllmAvailable = false;
          console.warn('WebLLM not available after timeout');
          this.updateWebLLMStatus('Mode local indisponible - Utilisez Gemini');
          resolve(false);
        }
      }, 100);
    });
  }

  updateWebLLMStatus(message) {
    const statusElement = document.getElementById('webllmStatus');
    if (statusElement) {
      statusElement.textContent = message;
      if (message.includes('indisponible')) {
        statusElement.className = 'text-xs mt-1 text-red-500';
      } else {
        statusElement.className = 'text-xs mt-1 text-green-500';
      }
    }
  }

  initializeUI() {
    // Get DOM elements
    this.chatContent = document.getElementById('chat-content');
    this.userInput = document.getElementById('user-input');
    this.sendBtn = document.getElementById('sendBtn');
    this.micBtn = document.getElementById('micBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.modeSelect = document.getElementById('modeSelect');
    this.typingIndicator = document.getElementById('typing');
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    this.loadingScreen = document.getElementById('loadingScreen');
    this.loadingText = document.getElementById('loadingText');
    this.progressText = document.getElementById('progressText');
    this.cancelLoadBtn = document.getElementById('cancelLoad');
    this.newChatBtn = document.getElementById('newChatBtn');
    this.imageUploadBtn = document.getElementById('imageUploadBtn');
    this.imageInput = document.getElementById('imageInput');
    this.imagePreview = document.getElementById('imagePreview');
    this.previewImage = document.getElementById('previewImage');
    this.imageName = document.getElementById('imageName');
    this.removeImageBtn = document.getElementById('removeImageBtn');
    this.modelSelect = document.getElementById('modelSelect');

    // Désactiver le mode local si WebLLM n'est pas disponible
    if (!this.webllmAvailable) {
      const localOption = this.modeSelect.querySelector('option[value="local"]');
      if (localOption) {
        localOption.disabled = true;
        localOption.textContent = 'Local (Indisponible)';
      }
    }

    // Event listeners
    this.userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.userInput.addEventListener('input', () => {
      this.clearBtn.style.display = this.userInput.value ? 'block' : 'none';
    });

    this.clearBtn.addEventListener('click', () => {
      this.userInput.value = '';
      this.clearBtn.style.display = 'none';
      this.userInput.focus();
    });

    this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    
    this.modeSelect.addEventListener('change', async (e) => {
      const newMode = e.target.value;
      
      if (newMode === 'local') {
        if (!this.webllmAvailable) {
          this.showError('WebLLM n\'est pas disponible. Vérifiez votre connexion internet.');
          this.modeSelect.value = 'cloud';
          this.currentMode = 'cloud';
          this.updateStatusIndicator();
          return;
        }

        if (!this.isInitialized && !this.localModelLoading) {
          // Afficher l'écran de chargement pour le mode local
          this.showLoadingScreen();
          this.localModelLoading = true;
          
          try {
            await this.initializeWebLLM();
            this.currentMode = 'local';
            this.updateStatusIndicator();
          } catch (error) {
            console.error('Failed to load local model:', error);
            this.modeSelect.value = 'cloud';
            this.currentMode = 'cloud';
            this.showError('Échec du chargement du modèle local: ' + error.message);
          } finally {
            this.hideLoadingScreen();
            this.localModelLoading = false;
          }
        } else {
          this.currentMode = 'local';
          this.updateStatusIndicator();
        }
      } else {
        this.currentMode = newMode;
        this.updateStatusIndicator();
      }
    });

    this.cancelLoadBtn.addEventListener('click', () => {
      this.cancelLocalLoad();
    });

    // Nouveau chat
    this.newChatBtn.addEventListener('click', () => {
      this.startNewChat();
    });

    // Upload d'image
    this.imageUploadBtn.addEventListener('click', () => {
      this.imageInput.click();
    });

    this.imageInput.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    this.removeImageBtn.addEventListener('click', () => {
      this.removeImage();
    });

    // Initialize clear button state
    this.clearBtn.style.display = 'none';
    
    // Focus sur l'input
    setTimeout(() => {
      this.userInput.focus();
    }, 500);
  }

  async initializeWebLLM() {
    return new Promise(async (resolve, reject) => {
      try {
        this.updateLoadingText('Vérification de WebLLM...');
        
        // Vérifier une dernière fois que WebLLM est disponible
        if (typeof webllm === 'undefined') {
          throw new Error('Bibliothèque WebLLM non chargée. Vérifiez votre connexion internet.');
        }

        console.log('WebLLM version disponible');
        this.updateLoadingText('Chargement du modèle ' + this.getModelDisplayName() + '...');

        // Timeout après 45 secondes maximum
        const loadTimeout = setTimeout(() => {
          reject(new Error('Timeout: Le chargement du modèle a pris trop de temps'));
        }, 45000);

        // Initialize WebLLM engine
        this.engine = await webllm.CreateWebLLMEngine({
          appId: "chatbot-app-v3",
          model: this.selectedModel,
          initProgressCallback: (report) => {
            console.log('WebLLM Progress:', report);
            this.handleInitProgress(report);
            
            // Résoudre quand le chargement est complet
            if (report.text.includes("All initialization completed.") || 
                report.text.includes("Ready to generate") ||
                report.progress === 1) {
              clearTimeout(loadTimeout);
              this.isInitialized = true;
              this.updateStatusIndicator();
              this.updateWebLLMStatus('Modèle local chargé avec succès!');
              console.log('WebLLM engine initialized successfully with model:', this.selectedModel);
              resolve();
            }
          }
        });

      } catch (error) {
        console.error('WebLLM initialization error:', error);
        
        // Tentative avec un modèle de fallback
        if (this.selectedModel !== "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC") {
          console.log('Trying fallback model...');
          this.selectedModel = "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC";
          this.updateLoadingText('Essai avec TinyLlama...');
          try {
            await this.initializeWebLLM();
            resolve();
          } catch (fallbackError) {
            reject(fallbackError);
          }
        } else {
          reject(error);
        }
      }
    });
  }

  // ... (le reste du code reste identique à la version précédente)

  cancelLocalLoad() {
    this.hideLoadingScreen();
    this.modeSelect.value = 'cloud';
    this.currentMode = 'cloud';
    this.updateStatusIndicator();
    this.localModelLoading = false;
    this.showError('Chargement local annulé. Mode Gemini activé.');
  }

  handleInitProgress(report) {
    const progressText = report.text;
    this.progressText.textContent = progressText;
    
    // Messages de progression plus user-friendly
    if (progressText.includes("Fetching")) {
      this.updateLoadingText('Téléchargement des fichiers du modèle...');
    } else if (progressText.includes("Loading")) {
      this.updateLoadingText('Chargement en mémoire...');
    } else if (progressText.includes("Initializing")) {
      this.updateLoadingText('Initialisation du moteur...');
    } else if (progressText.includes("Weights")) {
      this.updateLoadingText('Chargement des poids du modèle...');
    } else if (progressText.includes("KV")) {
      this.updateLoadingText('Préparation du cache...');
    } else if (progressText.includes("Completed") || progressText.includes("Ready")) {
      this.updateLoadingText('Modèle chargé avec succès !');
    }

    // Afficher la progression en pourcentage si disponible
    if (report.progress !== undefined) {
      const percent = Math.round(report.progress * 100);
      this.progressText.textContent = `Progression: ${percent}% - ${progressText}`;
    }
  }

  // ... (le reste des méthodes reste identique)

}

// Initialize the chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChatBot();
});

// Service Worker Registration for PWA (optionnel)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
