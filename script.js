/* ============================================================
   ELEMENTOS DA INTERFACE
   ============================================================ */

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const messages = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const chatArea = document.getElementById('chatArea');


/* ============================================================
   BANCO DE DADOS LOCAL (MEMÓRIA DO CHAT)
   ============================================================ */

const chatDatabase = {
    history: [],

    saveMessage(role, content) {
        this.history.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });

        // Caso queira persistência real no navegador:
        // localStorage.setItem('chat_database', JSON.stringify(this.history));
    },

    getHistory() {
        return this.history;
    }
};


/* ============================================================
   PREENCHER CAIXA DE TEXTO
   ============================================================ */

window.fillPrompt = function (text) {
    if (!chatInput) {
        return;
    }

    chatInput.value = text;
    chatInput.focus();

    autoResizeInput();
};


/* ============================================================
   AUMENTAR AUTOMATICAMENTE A CAIXA DE TEXTO
   ============================================================ */

function autoResizeInput() {
    if (!chatInput) {
        return;
    }

    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 130) + 'px';
}


if (chatInput) {
    chatInput.addEventListener('input', autoResizeInput);
}


/* ============================================================
   ENTER ENVIA A MENSAGEM
   SHIFT + ENTER = NOVA LINHA
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
   ENVIO DO FORMULÁRIO
   DIRETO PARA A AZURE OPENAI
   ============================================================ */

if (chatForm) {
    chatForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const message = chatInput.value.trim();

        if (!message) {
            return;
        }

        // Exibe a mensagem do usuário.
        addMessage(message, 'user');

        // Salva a mensagem na memória local.
        chatDatabase.saveMessage('user', message);

        // Limpa a caixa de texto.
        chatInput.value = '';
        autoResizeInput();

        // Esconde a mensagem de boas-vindas.
        if (welcome) {
            welcome.classList.add('hidden');
        }

        // Desabilita o campo enquanto a API responde.
        setInputEnabled(false);

        // Mostra o indicador de digitação.
        const typingElement = addTypingIndicator();

        try {
            /* ----------------------------------------------------
               CARREGAR CHAVES DO ARQUIVO keys.json
               ---------------------------------------------------- */

            const keysResponse = await fetch('keys.json');

            if (!keysResponse.ok) {
                throw new Error(
                    'Não foi possível carregar o arquivo keys.json.'
                );
            }

            const keys = await keysResponse.json();

            const AZURE_API_KEY = keys.AZURE_API_KEY;
            const azureEndpoint = keys.azureEndpoint;

            if (!AZURE_API_KEY || !azureEndpoint) {
                throw new Error(
                    'AZURE_API_KEY ou azureEndpoint não encontrado no keys.json.'
                );
            }


            /* ----------------------------------------------------
               ENVIAR MENSAGEM PARA A AZURE OPENAI
               ---------------------------------------------------- */

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
                                'Você é um assistente estrito de RPG e criação de mundos. ' +
                                'Responda apenas a pedidos sobre criação de histórias, ' +
                                'personagens, mundos ou pedidos de ajuda relacionados a isso. ' +
                                'Se o usuário falar sobre qualquer outro assunto, recuse educadamente.'
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


            /* ----------------------------------------------------
               VERIFICAR RESPOSTA DA API
               ---------------------------------------------------- */

            if (!response.ok) {
                const errorText = await response.text();

                throw new Error(
                    `Erro HTTP ${response.status}: ${errorText}`
                );
            }


            /* ----------------------------------------------------
               PROCESSAR RESPOSTA
               ---------------------------------------------------- */

            const data = await response.json();

            removeTypingIndicator(typingElement);

            const assistantMessage =
                data.choices &&
                data.choices[0] &&
                data.choices[0].message
                    ? data.choices[0].message.content
                    : null;


            /* ----------------------------------------------------
               EXIBIR RESPOSTA DO ASSISTENTE
               ---------------------------------------------------- */

            if (
                typeof assistantMessage === 'string' &&
                assistantMessage.trim()
            ) {
                addMessage(assistantMessage, 'assistant');

                // Salva a resposta na memória local.
                chatDatabase.saveMessage(
                    'assistant',
                    assistantMessage
                );

            } else {
                const fallbackMsg =
                    'Não consegui obter uma resposta do modelo.';

                addMessage(fallbackMsg, 'assistant');

                chatDatabase.saveMessage(
                    'assistant',
                    fallbackMsg
                );
            }

        } catch (error) {
            console.error(
                'Erro ao conversar com a Azure:',
                error
            );

            removeTypingIndicator(typingElement);

            const errorMsg =
                'Não foi possível conectar à API da Azure.';

            addMessage(errorMsg, 'assistant');

            chatDatabase.saveMessage(
                'assistant',
                errorMsg
            );

        } finally {
            // Reativa o campo de texto.
            setInputEnabled(true);

            chatInput.focus();
        }
    });
}


/* ============================================================
   CRIAR MENSAGEM
   ============================================================ */

function addMessage(text, sender) {
    if (!messages) {
        return;
    }

    const messageElement =
        document.createElement('div');

    messageElement.className =
        `message ${sender}`;

    const bubble =
        document.createElement('div');

    bubble.className =
        'message-bubble';

    bubble.textContent =
        text;

    messageElement.appendChild(bubble);

    messages.appendChild(messageElement);

    scrollToBottom();
}


/* ============================================================
   INDICADOR "CHATBOT ESTÁ DIGITANDO"
   ============================================================ */

function addTypingIndicator() {
    if (!messages) {
        return null;
    }

    const messageElement =
        document.createElement('div');

    messageElement.className =
        'message assistant';

    const bubble =
        document.createElement('div');

    bubble.className =
        'message-bubble';

    const typing =
        document.createElement('div');

    typing.className =
        'typing';

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
    if (
        element &&
        element.parentNode
    ) {
        element.parentNode.removeChild(element);
    }
}


/* ============================================================
   HABILITAR / DESABILITAR INPUT
   ============================================================ */

function setInputEnabled(enabled) {
    if (chatInput) {
        chatInput.disabled = !enabled;
    }

    if (sendButton) {
        sendButton.disabled = !enabled;
    }

    if (enabled) {
        chatInput?.removeAttribute('aria-busy');
    } else {
        chatInput?.setAttribute(
            'aria-busy',
            'true'
        );
    }
}


/* ============================================================
   ROLAR PARA A ÚLTIMA MENSAGEM
   ============================================================ */

function scrollToBottom() {
    if (!chatArea) {
        return;
    }

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

        if (chatInput) {
            chatInput.focus();
        }
    }
);