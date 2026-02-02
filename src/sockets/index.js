const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      // Check for token in handshake auth first
      let token = socket.handshake.auth.token;
      
      // If not in auth, try to get from cookies
      if (!token) {
        const cookieHeader = socket.handshake.headers.cookie || '';
        const match = cookieHeader.match(/(^| )token=([^;]+)/);
        if (match) {
          token = match.pop();
        }
      }
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
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