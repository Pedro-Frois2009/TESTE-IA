/* ============================================================
   ELEMENTOS DA INTERFACE
   ============================================================ */

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const micButton = document.getElementById('micButton');
const messages = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const chatArea = document.getElementById('chatArea');
const newChatBtn = document.getElementById('newChatBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyContainer = document.getElementById('historyContainer');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');


/* ============================================================
   CONTROLE DO MENU MOBILE (ABRIR / FECHAR LATERAL)
   ============================================================ */

if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-active');
    });

    // Fecha a sidebar ao clicar em algum item do histórico no mobile
    document.addEventListener('click', (event) => {
        if (window.innerWidth <= 650) {
            if (!sidebar.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
                sidebar.classList.remove('mobile-active');
            }
        }
    });
}


/* ============================================================
   BANCO DE DADOS LOCAL (LOCALSTORAGE) E GERENCIADOR DE HISTÓRICO
   ============================================================ */

let currentConversationId = 'chat_' + Date.now();

const chatDatabase = {
    saveMessage(role, content) {
        let sessions = JSON.parse(localStorage.getItem('onoma_sessions') || '{}');
        if (!sessions[currentConversationId]) {
            sessions[currentConversationId] = {
                id: currentConversationId,
                title: content.substring(0, 28) + '...',
                history: []
            };
        }
        sessions[currentConversationId].history.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('onoma_sessions', JSON.stringify(sessions));
        updateHistoryUI();
    },

    loadSession(id) {
        let sessions = JSON.parse(localStorage.getItem('onoma_sessions') || '{}');
        if (sessions[id]) {
            currentConversationId = id;
            messages.innerHTML = '';
            const session = sessions[id];
            
            if (session.history.length > 0) {
                welcome?.classList.add('hidden');
                session.history.forEach(msg => {
                    appendMessageDOM(msg.content, msg.role);
                });
            } else {
                welcome?.classList.remove('hidden');
            }

            // Fecha o menu no mobile após carregar uma sessão
            if (window.innerWidth <= 650 && sidebar) {
                sidebar.classList.remove('mobile-active');
            }
        }
    },

    clearAll() {
        localStorage.removeItem('onoma_sessions');
        currentConversationId = 'chat_' + Date.now();
        messages.innerHTML = '';
        welcome?.classList.remove('hidden');
        if (chatInput) chatInput.value = '';
        updateHistoryUI();
    }
};

function updateHistoryUI() {
    if (!historyContainer) return;
    let sessions = JSON.parse(localStorage.getItem('onoma_sessions') || '{}');
    historyContainer.innerHTML = '';
    
    const keys = Object.keys(sessions).reverse();
    if (keys.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.fontSize = '11px';
        emptyMsg.style.color = 'var(--text-muted)';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '10px 0';
        emptyMsg.textContent = 'Nenhum histórico salvo.';
        historyContainer.appendChild(emptyMsg);
        return;
    }

    keys.forEach(id => {
        const item = sessions[id];
        const btn = document.createElement('button');
        btn.className = 'history-item';
        btn.textContent = item.title || 'Conversa sem título';
        btn.onclick = () => {
            chatDatabase.loadSession(id);
        };
        historyContainer.appendChild(btn);
    });
}

// Botão Nova Conversa
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        currentConversationId = 'chat_' + Date.now();
        messages.innerHTML = '';
        welcome?.classList.remove('hidden');
        if (chatInput) chatInput.value = '';
        
        if (window.innerWidth <= 650 && sidebar) {
            sidebar.classList.remove('mobile-active');
        }
    });
}

// Botão Limpar Histórico
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Deseja realmente limpar todo o histórico de conversas?')) {
            chatDatabase.clearAll();
        }
    });
}


/* ============================================================
   SÍNTESE DE VOZ (TEXT-TO-SPEECH)
   ============================================================ */

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*_#`\[\]]/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
}


/* ============================================================
   PREENCHER CAIXA DE TEXTO (E FECHAR MENU MOBILE SE ABERTO)
   ============================================================ */

window.fillPrompt = function (text) {
    if (!chatInput) return;
    chatInput.value = text;
    chatInput.focus();
    autoResizeInput();
};


/* ============================================================
   AUMENTAR AUTOMATICAMENTE A CAIXA DE TEXTO
   ============================================================ */

function autoResizeInput() {
    if (!chatInput) return;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 130) + 'px';
}

if (chatInput) {
    chatInput.addEventListener('input', autoResizeInput);
}


/* ============================================================
   ENTER ENVIA A MENSAGEM / SHIFT + ENTER = NOVA LINHA
   ============================================================ */

if (chatInput) {
    chatInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            chatForm.requestSubmit();
        }
    });
}


/* ============================================================
   RECONHECIMENTO DE VOZ CONTÍNUO (WEB SPEECH API)
   ============================================================ */

let isListening = false;
let recognitionInstance = null;

if (micButton) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognitionInstance = new SpeechRecognition();
        recognitionInstance.lang = 'pt-BR';
        recognitionInstance.interimResults = true;
        recognitionInstance.maxAlternatives = 1;
        recognitionInstance.continuous = true;

        micButton.addEventListener('click', function () {
            if (isListening) {
                recognitionInstance.stop();
                micButton.classList.remove('listening');
                isListening = false;
            } else {
                try {
                    recognitionInstance.start();
                } catch (e) {
                    console.error(e);
                }
            }
        });

        recognitionInstance.addEventListener('start', function () {
            isListening = true;
            micButton.classList.add('listening');
        });

        recognitionInstance.addEventListener('result', function (event) {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                chatInput.value = finalTranscript.trim();
                autoResizeInput();
                
                recognitionInstance.stop();
                micButton.classList.remove('listening');
                isListening = false;
                
                chatForm.requestSubmit();
            } else if (interimTranscript) {
                chatInput.value = interimTranscript;
                autoResizeInput();
            }
        });

        recognitionInstance.addEventListener('end', function () {
            if (isListening) {
                try {
                    recognitionInstance.start();
                } catch (e) {
                    micButton.classList.remove('listening');
                    isListening = false;
                }
            } else {
                micButton.classList.remove('listening');
            }
        });

        recognitionInstance.addEventListener('error', function (event) {
            console.error('Erro no reconhecimento de voz:', event.error);
            micButton.classList.remove('listening');
            isListening = false;
        });

    } else {
        micButton.style.display = 'none';
        console.warn('Web Speech API não é suportada neste navegador.');
    }
}


/* ============================================================
   ENVIO DO FORMULÁRIO (TEXTO OU VOZ)
   ============================================================ */

if (chatForm) {
    chatForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (isListening && recognitionInstance) {
            recognitionInstance.stop();
            micButton.classList.remove('listening');
            isListening = false;
        }

        const message = chatInput.value.trim();

        if (!message) {
            return;
        }

        addMessage(message, 'user');
        chatDatabase.saveMessage('user', message);

        chatInput.value = '';
        autoResizeInput();

        if (welcome) {
            welcome.classList.add('hidden');
        }

        setInputEnabled(false);

        const cleanMessage = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        if (cleanMessage === 'ola' || cleanMessage === 'olá') {
            const predefinedResponse = "Olá aventureiro, como posso ajudar?";
            
            setTimeout(() => {
                addMessage(predefinedResponse, 'assistant');
                chatDatabase.saveMessage('assistant', predefinedResponse);
                speakText(predefinedResponse);
                setInputEnabled(true);
                chatInput.focus();
            }, 600);
            
            return;
        }

        const typingElement = addTypingIndicator();

        try {
            const keysResponse = await fetch('keys.json');

            if (!keysResponse.ok) {
                throw new Error('Não foi possível carregar o arquivo keys.json.');
            }

            const keys = await keysResponse.json();
            const AZURE_API_KEY = keys.AZURE_API_KEY;
            const azureEndpoint = keys.azureEndpoint;

            if (!AZURE_API_KEY || !azureEndpoint) {
                throw new Error('AZURE_API_KEY ou azureEndpoint não encontrado no keys.json.');
            }

            const response = await fetch(azureEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AZURE_API_KEY}`
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content:
                                'Você é um assistente especializado no desenvolvimento criativo de universos fictícios. ' +
                                'Sempre entregue as informações estruturadas de forma completa na sua resposta, mesmo que o comando do usuário seja simples. ' +
                                'Para pedidos sobre personagens, apresente obrigatoriamente os tópicos: ' +
                                'APARÊNCIA (descreva características visuais, roupas, expressão), ' +
                                'ITENS (apresente objetos e acessórios com suas funções), e ' +
                                'HISTÓRIA (desenvolva origem, motivações e acontecimentos importantes). ' +
                                'Para pedidos sobre histórias, apresente obrigatoriamente: ' +
                                'ONDE SE PASSA (descreva local, ambiente e cenário) e ' +
                                'COMO CHEGAMOS A ESSE PONTO (explique acontecimentos e decisões que levaram ao momento). ' +
                                'Para pedidos sobre mundos, apresente obrigatoriamente: ' +
                                'CONTEXTO (situação atual e características), ' +
                                'LOCALIZAÇÃO (regiões, territórios ou ambientes) e ' +
                                'NOME (nome adequado ao mundo). ' +
                                'Para pedidos de ajuda ("Pedir ajuda"), apresente obrigatoriamente: ' +
                                'COMO VOCÊ PODE AJUDAR, ' +
                                'O QUE A PESSOA PODE FAZER e ' +
                                'POSSÍVEL ALTERNATIVA. ' +
                                'Crie e entregue o conteúdo criativo diretamente preenchendo esses tópicos de forma rica e detalhada, sem apenas devolver perguntas ao usuário. ' +
                                'Recuse educadamente apenas assuntos totalmente fora do escopo de criação.'
                        },
                        {
                            role: 'user',
                            content: 'I am going to Paris, what should I see?'
                        },
                        {
                            role: 'assistant',
                            content:
                                'Me desculpe caro aventureiro, mas receio não poder te ajudar ' +
                                'com esse pedido... Tem algum outro desejo em mente?'
                        },
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    max_completion_tokens: 13107,
                    temperature: 1,
                    top_p: 1,
                    stop: [],
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    model: 'gpt-4.1-mini'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            removeTypingIndicator(typingElement);

            const assistantMessage =
                data.choices && data.choices[0] && data.choices[0].message
                    ? data.choices[0].message.content
                    : null;

            if (typeof assistantMessage === 'string' && assistantMessage.trim()) {
                addMessage(assistantMessage, 'assistant');
                chatDatabase.saveMessage('assistant', assistantMessage);
                speakText(assistantMessage);
            } else {
                const fallbackMsg = 'Não consegui obter uma resposta do modelo.';
                addMessage(fallbackMsg, 'assistant');
                chatDatabase.saveMessage('assistant', fallbackMsg);
                speakText(fallbackMsg);
            }

        } catch (error) {
            console.error('Erro ao conversar com a Azure:', error);
            removeTypingIndicator(typingElement);
            const errorMsg = 'Não foi possível conectar à API da Azure.';
            addMessage(errorMsg, 'assistant');
            chatDatabase.saveMessage('assistant', errorMsg);
            speakText(errorMsg);

        } finally {
            setInputEnabled(true);
            chatInput.focus();
        }
    });
}


/* ============================================================
   CRIAR MENSAGEM (COM SUPORTE A MARKDOWN)
   ============================================================ */

function addMessage(text, sender) {
    appendMessageDOM(text, sender);
    scrollToBottom();
}

function appendMessageDOM(text, sender) {
    if (!messages) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (sender === 'assistant' && typeof marked !== 'undefined') {
        bubble.innerHTML = marked.parse(text);
    } else {
        bubble.textContent = text;
    }

    messageElement.appendChild(bubble);
    messages.appendChild(messageElement);
}


/* ============================================================
   INDICADOR "CHATBOT ESTÁ DIGITANDO"
   ============================================================ */

function addTypingIndicator() {
    if (!messages) return null;

    const messageElement = document.createElement('div');
    messageElement.className = 'message assistant';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;

    bubble.appendChild(typing);
    messageElement.appendChild(bubble);
    messages.appendChild(messageElement);

    scrollToBottom();

    return messageElement;
}


/* ============================================================
   REMOVER INDICADOR
   ============================================================ */

function removeTypingIndicator(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}


/* ============================================================
   HABILITAR / DESABILITAR INPUT
   ============================================================ */

function setInputEnabled(enabled) {
    if (chatInput) chatInput.disabled = !enabled;
    if (sendButton) sendButton.disabled = !enabled;
    if (micButton) micButton.disabled = !enabled;

    if (enabled) {
        chatInput?.removeAttribute('aria-busy');
    } else {
        chatInput?.setAttribute('aria-busy', 'true');
    }
}


/* ============================================================
   ROLAR PARA A ÚLTIMA MENSAGEM
   ============================================================ */

function scrollToBottom() {
    if (!chatArea) return;

    setTimeout(function () {
        chatArea.scrollTo({
            top: chatArea.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

document.addEventListener(
    'DOMContentLoaded',
    function () {
        autoResizeInput();
        updateHistoryUI();

        if (chatInput) {
            chatInput.focus();
        }
    }
);