const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://e-chat-frontend.vercel.app',
        'https://e-chat-production.up.railway.app'
      ],
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      console.log('=== Socket Authentication Debug ===');
      console.log('Socket ID:', socket.id);
      console.log('Handshake headers keys:', Object.keys(socket.handshake.headers));
      console.log('Handshake auth:', socket.handshake.auth);
      console.log('Handshake query:', socket.handshake.query);
      
      // Check for token in handshake auth first
      let token = socket.handshake.auth.token;
      console.log('Token from auth:', !!token);
      
      // If not in auth, try to get from query params (fallback)
      if (!token) {
        token = socket.handshake.query.token;
        console.log('Token from query:', !!token);
      }
      
      // If not in query params, try to get from cookies
      if (!token) {
        const cookieHeader = socket.handshake.headers.cookie || '';
        console.log('Cookie header:', cookieHeader);
        const match = cookieHeader.match(/(^| )token=([^;]+)/);
        if (match) {
          token = match[2];
          console.log('Token extracted from cookie');
        }
      }
      
      console.log('Final token present:', !!token);
      
      if (!token) {
        console.log('No token found in any source');
        return next(new Error('Authentication error: No token provided'));
      }
      
      // Log token length for debugging (don't log actual token for security)
      console.log('Token length:', token.length);
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully, user ID:', decoded.id);
      
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        console.log('User not found in database');
        return next(new Error('Authentication error: User not found'));
      }
      
      socket.user = user;
      console.log('Socket authenticated successfully for user:', user.email);
      next();
    } catch (error) {
      console.error('Socket authentication FAILED:', error.message);
      console.error('Error stack:', error.stack);
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

        // Emit to all users in the chat room except sender
        socket.to(chatId).emit('receive_message', populatedMessage);
        
        // Also emit back to sender for confirmation
        socket.emit('message_sent', populatedMessage);
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