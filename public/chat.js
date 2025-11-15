// Chat functionality with Socket.io
let socket = null;
let currentUser = null;
let currentReceiverId = null;
let currentPropertyId = null;

// Initialize socket connection
function initializeSocket() {
    if (socket) return;
    
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to chat server');
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user.id) {
            socket.emit('user_connected', user.id);
            currentUser = user;
        }
    });
    
    socket.on('new_message', (message) => {
        console.log('New message received:', message);
        displayMessage(message);
    });
    
    socket.on('message_sent', (message) => {
        console.log('Message sent:', message);
        displayMessage(message);
    });
    
    socket.on('messages_history', (messages) => {
        console.log('Messages history loaded:', messages);
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            messages.forEach(msg => displayMessage(msg));
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
    
    socket.on('messages_error', (error) => {
        console.error('Chat error:', error);
        showAlert('চ্যাট লোড করতে সমস্যা হয়েছে', 'error');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from chat server');
    });
}

// Load message history
function loadMessageHistory(propertyId, userId1, userId2) {
    if (!socket) {
        initializeSocket();
        setTimeout(() => {
            socket.emit('get_messages', {
                propertyId: propertyId,
                userId1: userId1,
                userId2: userId2
            });
        }, 500);
    } else {
        socket.emit('get_messages', {
            propertyId: propertyId,
            userId1: userId1,
            userId2: userId2
        });
    }
}

// Send message
function sendMessage(propertyId, receiverId, messageText) {
    if (!socket) {
        initializeSocket();
    }
    
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    if (!user.id) {
        showAlert('প্রথমে লগইন করুন', 'error');
        return;
    }
    
    socket.emit('send_message', {
        propertyId: propertyId,
        senderId: user.id,
        receiverId: receiverId,
        message: messageText
    });
}

// Display message in chat
function displayMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    const isOwn = message.sender._id === (JSON.parse(localStorage.getItem('currentUser') || '{}').id);
    
    messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-sender">${message.sender.name}</div>
            <p>${message.message}</p>
            <small>${new Date(message.timestamp).toLocaleTimeString('bn-BD')}</small>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        initializeSocket();
        
        // Get property ID from URL or use default
        const urlParams = new URLSearchParams(window.location.search);
        currentPropertyId = urlParams.get('propertyId') || '1';
        currentReceiverId = urlParams.get('receiverId') || 'owner123';
        
        // Load existing messages
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user.id) {
            loadMessageHistory(currentPropertyId, user.id, currentReceiverId);
        }
        
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const messageInput = document.getElementById('messageInput');
            const message = messageInput.value.trim();
            
            if (message) {
                sendMessage(currentPropertyId, currentReceiverId, message);
                messageInput.value = '';
                messageInput.focus();
            }
        });
    }
});

// Show alert function (if not already defined in app.js)
function showAlert(message, type = 'info') {
    if (window.showAlert) {
        window.showAlert(message, type);
        return;
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 20px; cursor: pointer; float: right;';
    closeBtn.onclick = () => alertDiv.remove();
    
    alertDiv.appendChild(closeBtn);
    document.body.prepend(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}
