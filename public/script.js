const socket = io();

// Elementos del DOM
const messageHistory = document.getElementById('messageHistory');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Muestra el historial de mensajes
socket.on('messageHistory', (history) => {
    messageHistory.textContent = history;
});

// Muestra respuestas parciales de la IA
socket.on('iaResponse', (data) => {
    if (data.final) {
        messageHistory.textContent += `IA: ${data.partial}\nFin\n`;
    } else {
        messageHistory.textContent += `IA (parcial): ${data.partial}\n`;
    }
});

// Envía mensajes al servidor
sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
        messageHistory.textContent += `Usuario: ${message}\n`;
        socket.emit('userMessage', message);
        messageInput.value = '';
    }
});
