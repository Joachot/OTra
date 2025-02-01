const express = require('express');
const WebSocket = require('ws');
const { exec } = require('child_process');

const app = express();
const port = 3000;

// Servir el archivo HTML
app.use(express.static('public'));

// Iniciar el servidor HTTP
const server = app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

// Configuración de WebSocket
const wss = new WebSocket.Server({ server });

// Variables globales
let chatHistory = []; // Historial de chat compartido entre todos los usuarios
let isProcessing = false; // Estado global de si Ollama está procesando
let clients = []; // Lista de clientes conectados
let userCount = 0; // Contador para asignar ids únicos a los usuarios

// Función para enviar mensajes a todos los clientes
function broadcast(message) {
  clients.forEach(client => {
    if (client.send) {
      client.send(JSON.stringify(message));
    }
  });
}

// Función para actualizar la lista de usuarios conectados
function updateUserList() {
  const userList = clients.map((client, index) => `user${index + 1}`);
  broadcast({ type: 'updateUserList', data: userList });
}

wss.on('connection', ws => {
  console.log('Nuevo cliente conectado');
  const userId = `user${++userCount}`; // Asignar ID único al cliente
  clients.push(ws); // Agregar el cliente a la lista

  // Enviar el historial de chat y el estado de procesamiento a los nuevos clientes
  ws.send(JSON.stringify({ type: 'history', data: chatHistory }));
  ws.send(JSON.stringify({ type: 'status', data: isProcessing }));
  ws.send(JSON.stringify({ type: 'userId', data: userId })); // Enviar el ID de usuario al cliente

  // Actualizar la lista de usuarios conectados
  updateUserList();

  ws.on('message', message => {
    console.log(`Mensaje recibido de ${userId}:`, message);

    // Si Ollama ya está procesando, no permitir más mensajes
    if (isProcessing) {
      return;
    }

    // Asegurarse de que el mensaje sea tratado como texto
    const userMessage = String(message); // Convertir a texto

    // Agregar el mensaje del usuario al historial y difundirlo
    chatHistory.push({ user: userId, message: userMessage });
    broadcast({ type: 'message', user: userId, message: userMessage });

    // Iniciar el proceso de Ollama
    isProcessing = true;
    broadcast({ type: 'status', data: isProcessing }); // Notificar a todos los clientes

    const process = exec(`echo "${userMessage}" | ollama run llama3.1:8b`, { maxBuffer: 1024 * 500 });

    let responseData = ""; // Variable para almacenar la respuesta completa

    process.stdout.on('data', (chunk) => {
      console.log(`Ollama está respondiendo: ${chunk}`);

      // Enviar cada fragmento de la respuesta a todos los clientes
      responseData += chunk;
      broadcast({ type: 'response', user: 'Ollama', message: responseData });
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log('Ollama ha terminado de responder.');
        chatHistory.push({ user: 'Ollama', message: responseData }); // Guardar respuesta completa
        broadcast({ type: 'status', data: false }); // Notificar que Ollama ha terminado
        isProcessing = false; // Cambiar el estado a no procesando
      } else {
        // No hacer nada en caso de error
      }
    });
  });

  // Cuando el cliente se desconecta
  ws.on('close', () => {
    console.log('Cliente desconectado');
    clients = clients.filter(client => client !== ws); // Eliminar cliente de la lista

    // Actualizar la lista de usuarios conectados
    updateUserList();
  });
});
