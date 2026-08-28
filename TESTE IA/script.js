/* ============================================================
   ELEMENTOS DA INTERFACE
   ============================================================ */

const chatForm =
    document.getElementById('chatForm');

const chatInput =
    document.getElementById('chatInput');

const sendButton =
    document.getElementById('sendButton');

const messages =
    document.getElementById('messages');

const welcome =
    document.getElementById('welcome');

const chatArea =
    document.getElementById('chatArea');



/* ============================================================
   BANCO DE DADOS LOCAL (MEMÓRIA DO CHAT)
   ============================================================ */

const chatDatabase = {
    history: [],
    saveMessage(role, content) {
        this.history.push({ role, content, timestamp: new Date().toISOString() });
        // Aqui você pode expandir para salvar no localStorage se desejar persistência real no navegador:
        // localStorage.setItem('chat_database', JSON.stringify(this.history));
    },
    getHistory() {
        return this.history;
    }
};



/* ============================================================
   PREENCHER CAIXA DE TEXTO
   ============================================================ */

window.fillPrompt = function(text) {

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

    chatInput.style.height =
        Math.min(
            chatInput.scrollHeight,
            130
        ) + 'px';

}


if (chatInput) {

    chatInput.addEventListener(
        'input',
        autoResizeInput
    );

}



/* ============================================================
   ENTER ENVIA A MENSAGEM
   SHIFT + ENTER = NOVA LINHA
   ============================================================ */

if (chatInput) {

    chatInput.addEventListener(
        'keydown',
        function(event) {

            if (
                event.key === 'Enter' &&
                !event.shiftKey
            ) {

                event.preventDefault();

                chatForm.requestSubmit();

            }

        }
    );

}



/* ============================================================
   ENVIO DO FORMULÁRIO (DIRETO PARA A AZURE OPENAI)
   ============================================================ */

if (chatForm) {

    chatForm.addEventListener(
        'submit',
        async function(event) {

            event.preventDefault();

            const message =
                chatInput.value.trim();

            if (!message) {
                return;
            }

            addMessage(
                message,
                'user'
            );

            // Salva a mensagem do usuário no banco de dados de memória
            chatDatabase.saveMessage('user', message);

            chatInput.value = '';

            autoResizeInput();

            if (welcome) {

                welcome.classList.add(
                    'hidden'
                );

            }

            setInputEnabled(false);

            const typingElement =
                addTypingIndicator();

            try {
                // Cole a sua chave da Azure aqui
                const AZURE_API_KEY = ""; 
                
                const azureEndpoint = "https://seila.openai.azure.com/openai/v1/chat/completions";

                const response = await fetch(azureEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${AZURE_API_KEY}`
                    },
                    body: JSON.stringify({
                        "messages": [
                            {
                                "role": "system",
                                "content": "Você é um assistente estrito de RPG e criação de mundos. Responda apenas a pedidos sobre criação de histórias, personagens, mundos ou pedidos de ajuda relacionados a isso. Se o usuário falar sobre qualquer outro assunto, recuse educadamente."
                            },
                            {
                                "role": "user",
                                "content": "I am going to Paris, what should I see?"
                            },
                            {
                                "role": "assistant",
                                "content": "Me desculpe caro aventureiro, mas receio não poder te ajudar com esse pedido... Tem algum outro desejo em mente?🧙‍♂️"
                            },
                            {
                                "role": "user",
                                "content": message
                            }
                        ],
                        "max_completion_tokens": 13107,
                        "temperature": 1,
                        "top_p": 1,
                        "stop": [],
                        "frequency_penalty": 0,
                        "presence_penalty": 0,
                        "model": "gpt-4.1-mini"
                    })
                });

                if (!response.ok) {
                    throw new Error(
                        'Erro HTTP: ' +
                        response.status
                    );
                }

                const data = await response.json();

                removeTypingIndicator(
                    typingElement
                );

                let assistantMessage =
                    data.choices && data.choices[0] && data.choices[0].message 
                        ? data.choices[0].message.content 
                        : null;

                if (
                    typeof assistantMessage ===
                    'string'
                ) {

                    // Verificação de segurança adicional no Front-end para garantir a mensagem padrão caso o modelo fuja da regra
                    const lowerMsg = message.toLowerCase();
                    const allowedKeywords = ['história', 'historia', 'personagem', 'personagens', 'mundo', 'mundos', 'ajuda', 'rpg', 'criação', 'criacao'];
                    const isAllowed = allowedKeywords.some(keyword => lowerMsg.includes(keyword));

                    // Se a mensagem não parecer com os temas permitidos (e não for uma saudação simples), podemos forçar a frase de bloqueio se necessário, 
                    // mas o system prompt na Azure já cuidará disso. Caso queira garantir via código JS local também:
                    // (Opcional, mantemos o fluxo do modelo guiado pelo system prompt, mas salvamos no banco)

                    addMessage(
                        assistantMessage,
                        'assistant'
                    );

                    // Salva a resposta do assistente no banco de dados de memória
                    chatDatabase.saveMessage('assistant', assistantMessage);

                } else {

                    const fallbackMsg = 'Não consegui obter uma resposta do modelo.';
                    addMessage(
                        fallbackMsg,
                        'assistant'
                    );
                    chatDatabase.saveMessage('assistant', fallbackMsg);

                }

            } catch (error) {

                console.error(
                    'Erro ao conversar com a Azure:',
                    error
                );

                removeTypingIndicator(
                    typingElement
                );

                const errorMsg = 'Não foi possível conectar à API da Azure.';
                addMessage(
                    errorMsg,
                    'assistant'
                );
                chatDatabase.saveMessage('assistant', errorMsg);

            } finally {

                setInputEnabled(true);

                chatInput.focus();

            }

        }
    );

}



/* ============================================================
   CRIAR MENSAGEM
   ============================================================ */

function addMessage(
    text,
    sender
) {

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

    messageElement.appendChild(
        bubble
    );

    messages.appendChild(
        messageElement
    );

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

    bubble.appendChild(
        typing
    );

    messageElement.appendChild(
        bubble
    );

    messages.appendChild(
        messageElement
    );

    scrollToBottom();

    return messageElement;

}



/* ============================================================
   REMOVER INDICADOR
   ============================================================ */

function removeTypingIndicator(
    element
) {

    if (
        element &&
        element.parentNode
    ) {

        element.parentNode.removeChild(
            element
        );

    }

}



/* ============================================================
   HABILITAR / DESABILITAR INPUT
   ============================================================ */

function setInputEnabled(
    enabled
) {

    if (chatInput) {

        chatInput.disabled =
            !enabled;

    }

    if (sendButton) {

        sendButton.disabled =
            !enabled;

    }

    if (enabled) {

        chatInput?.removeAttribute(
            'aria-busy'
        );

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

    setTimeout(
        function() {

            chatArea.scrollTo({
                top:
                    chatArea.scrollHeight,

                behavior:
                    'smooth'
            });

        },
        50
    );

}



/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

document.addEventListener(
    'DOMContentLoaded',
    function() {

        autoResizeInput();

        if (chatInput) {

            chatInput.focus();

        }

    }
);