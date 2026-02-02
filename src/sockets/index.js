const { Server } = require('socket.io');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('setup', (userData) => {
      socket.emit('connected');
    });

    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`User ${socket.id} joined room ${room}`);
    });

    socket.on('send_message', async (messageData) => {
      const { chatId, content, sender } = messageData;
      
      try {
        const Message = require('../models/Message');
        const Chat = require('../models/Chat');
        
        const message = await Message.create({
          sender: sender._id,
          content: content,
          chat: chatId
        });

        const populatedMessage = await message.populate('sender', 'name email');
        await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

        socket.to(chatId).emit('receive_message', populatedMessage);
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });

    socket.on('typing', (room) => {
      socket.to(room).emit('typing');
    });

    socket.on('stop_typing', (room) => {
      socket.to(room).emit('stop_typing');
    });
  });

  return io;
};

module.exports = initializeSocket;