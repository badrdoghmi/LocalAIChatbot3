// main.js - Chatbot avec modèle léger WebLLM et Gemini par défaut
class ChatBot {
  constructor() {
    this.engine = null;
    // Modèle ultra-léger pour chargement rapide
    this.selectedModel = "TinyLlama-1.1B-Chat-v0.4-q4f32_1-MLC";
    this.isInitialized = false;
    this.currentMode = 'cloud'; // Gemini par défaut
    this.isGenerating = false;
    this.localModelLoading = false;
    
    this.initializeApp();
  }

  async initializeApp() {
    try {
      // Initialize UI elements
      this.initializeUI();
      
      // Cache le loading screen car on utilise Gemini par défaut
      this.hideLoadingScreen();
      
      // Add welcome message
      this.addWelcomeMessage();
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.showError('Erreur lors de l\'initialisation: ' + error.message);
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
      
      if (newMode === 'local' && !this.isInitialized && !this.localModelLoading) {
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
          this.showError('Modèle local indisponible. Retour au mode Gemini.');
        } finally {
          this.hideLoadingScreen();
          this.localModelLoading = false;
        }
      } else {
        this.currentMode = newMode;
        this.updateStatusIndicator();
      }
    });

    this.cancelLoadBtn.addEventListener('click', () => {
      this.cancelLocalLoad();
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
        this.updateLoadingText('Chargement du modèle TinyLlama...');
        
        // Timeout après 30 secondes maximum
        const loadTimeout = setTimeout(() => {
          reject(new Error('Timeout du chargement du modèle'));
        }, 30000);

        // Initialize WebLLM engine avec modèle léger
        this.engine = await webllm.CreateWebLLMEngine({
          appId: "chatbot-fast",
          model: this.selectedModel,
          initProgressCallback: (report) => {
            this.handleInitProgress(report);
            
            // Résoudre quand le chargement est complet
            if (report.text.includes("All initialization completed.")) {
              clearTimeout(loadTimeout);
              this.isInitialized = true;
              this.updateStatusIndicator();
              console.log('WebLLM engine initialized successfully');
              resolve();
            }
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

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
      this.updateLoadingText('Téléchargement du modèle...');
    } else if (progressText.includes("Loading")) {
      this.updateLoadingText('Chargement en mémoire...');
    } else if (progressText.includes("Initializing")) {
      this.updateLoadingText('Initialisation...');
    }
  }

  updateLoadingText(text) {
    if (this.loadingText) {
      this.loadingText.textContent = text;
    }
  }

  showLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.style.display = 'flex';
      setTimeout(() => {
        this.loadingScreen.style.opacity = '1';
      }, 10);
    }
  }

  hideLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.style.opacity = '0';
      setTimeout(() => {
        this.loadingScreen.style.display = 'none';
      }, 500);
    }
  }

  updateStatusIndicator() {
    if (this.currentMode === 'local' && this.isInitialized) {
      this.statusDot.className = 'w-2 h-2 bg-green-500 rounded-full';
      this.statusText.textContent = 'Local - TinyLlama';
      this.statusText.className = 'text-xs text-green-400';
    } else if (this.currentMode === 'cloud') {
      this.statusDot.className = 'w-2 h-2 bg-blue-500 rounded-full';
      this.statusText.textContent = 'Cloud - Gemini';
      this.statusText.className = 'text-xs text-blue-400';
    } else {
      this.statusDot.className = 'w-2 h-2 bg-yellow-500 rounded-full';
      this.statusText.textContent = 'Local - Chargement';
      this.statusText.className = 'text-xs text-yellow-400';
    }
  }

  addWelcomeMessage() {
    const welcomeMessage = "Bonjour ! Je suis votre assistant IA. Je fonctionne actuellement en mode Gemini pour des réponses rapides et précises. Comment puis-je vous aider aujourd'hui ?";
    
    this.addMessage(welcomeMessage, false, false);
  }

  createMessageElement(message, fromUser) {
    const messageElement = document.createElement('div');
    
    // Base classes
    const baseClasses = [
      'max-w-md', 'break-words', 'px-4', 'py-3', 'rounded-2xl',
      'message-animation', 'mobile-message'
    ];
    
    // Style based on sender
    if (fromUser) {
      baseClasses.push('bg-blue-500', 'text-white', 'ml-auto', 'rounded-br-md');
    } else {
      baseClasses.push('bg-gray-700', 'text-gray-100', 'mr-auto', 'rounded-bl-md');
    }
    
    messageElement.className = baseClasses.join(' ');
    
    // Formatage du message avec sauts de ligne
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageElement.innerHTML = formattedMessage;
    
    return messageElement;
  }

  addMessage(message, fromUser, animate = true) {
    const messageElement = this.createMessageElement(message, fromUser);
    
    if (!animate) {
      messageElement.classList.remove('message-animation');
    }
    
    this.chatContent.appendChild(messageElement);
    this.scrollToBottom();
  }

  scrollToBottom() {
    setTimeout(() => {
      this.chatContent.scrollTop = this.chatContent.scrollHeight;
    }, 100);
  }

  showTypingIndicator() {
    this.typingIndicator.classList.remove('hidden');
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    this.typingIndicator.classList.add('hidden');
  }

  async handleSendMessage() {
    const userMessage = this.userInput.value.trim();
    
    if (!userMessage || this.isGenerating) {
      return;
    }

    // Clear input
    this.userInput.value = '';
    this.clearBtn.style.display = 'none';
    
    // Add user message
    this.addMessage(userMessage, true);
    
    // Set generating state
    this.isGenerating = true;
    this.sendBtn.disabled = true;
    
    // Show typing indicator
    this.showTypingIndicator();
    
    try {
      let botResponse;
      
      if (this.currentMode === 'local' && this.isInitialized) {
        botResponse = await this.generateLocalResponse(userMessage);
      } else {
        botResponse = await this.generateCloudResponse(userMessage);
      }
      
      this.hideTypingIndicator();
      this.addMessage(botResponse, false);
      
    } catch (error) {
      console.error('Error generating response:', error);
      this.hideTypingIndicator();
      
      // Message d'erreur contextuel
      const errorMessage = this.currentMode === 'local' 
        ? "Désolé, le mode local rencontre un problème. Passage au mode Gemini..."
        : "Désolé, une erreur de connexion s'est produite. Veuillez réessayer.";
      
      this.addMessage(errorMessage, false);
      
      // Fallback automatique au cloud en cas d'erreur locale
      if (this.currentMode === 'local') {
        this.modeSelect.value = 'cloud';
        this.currentMode = 'cloud';
        this.updateStatusIndicator();
      }
    } finally {
      this.isGenerating = false;
      this.sendBtn.disabled = false;
      this.userInput.focus();
    }
  }

  async generateLocalResponse(userMessage) {
    try {
      const prompt = this.buildPrompt(userMessage);
      const response = await this.engine.generate(prompt, {
        maxGenLength: 256, // Plus court pour plus de rapidité
        temperature: 0.7,
        topP: 0.9
      });
      
      return this.cleanResponse(response);
      
    } catch (error) {
      console.error('Local generation error:', error);
      throw new Error('Erreur de génération locale');
    }
  }

  async generateCloudResponse(userMessage) {
    try {
      // Simulation de délai réseau
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
      const response = await fetch("https://backend.buildpicoapps.com/aero/run/llm-api?pk=v1-Z0FBQUFBQm5IZkJDMlNyYUVUTjIyZVN3UWFNX3BFTU85SWpCM2NUMUk3T2dxejhLSzBhNWNMMXNzZlp3c09BSTR6YW1Sc1BmdGNTVk1GY0liT1RoWDZZX1lNZlZ0Z1dqd3c9PQ==", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: userMessage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        return data.text;
      } else {
        throw new Error('API returned error status');
      }
    } catch (error) {
      console.error('Cloud API error:', error);
      throw new Error('Erreur de connexion au service cloud');
    }
  }

  buildPrompt(userMessage) {
    // Prompt simplifié pour TinyLlama
    return `<|system|>
Vous êtes un assistant IA utile. Répondez de manière concise et utile.
<|user|>
${userMessage}
<|assistant|>
`;
  }

  cleanResponse(response) {
    // Nettoyage de la réponse pour enlever les artefacts du prompt
    return response
      .replace(/<\|system\|>.*?<\|assistant\|>/gs, '')
      .replace(/<\|.*?\|>/g, '')
      .trim();
  }

  showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm message-animation';
    errorElement.textContent = message;
    
    document.body.appendChild(errorElement);
    
    setTimeout(() => {
      errorElement.style.opacity = '0';
      setTimeout(() => {
        errorElement.remove();
      }, 500);
    }, 4000);
  }
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