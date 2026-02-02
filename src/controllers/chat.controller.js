const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

// Create or access chat
const createChat = async (req, res) => {
  try {
    const { userId, email } = req.body;

    // Check if either userId or email is provided
    if (!userId && !email) {
      return res.status(400).json({ message: 'Either userId or email must be provided' });
    }

    // If email is provided, find the user by email
    let targetUserId = userId;
    if (email) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ message: 'User with this email not found' });
      }
      targetUserId = user._id;
    }

    // Check if chat already exists
    let isChat = await Chat.find({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.user._id } } },
        { users: { $elemMatch: { $eq: targetUserId } } }
      ]
    }).populate('users', '-password').populate('latestMessage');

    isChat = await User.populate(isChat, {
      path: 'latestMessage.sender',
      select: 'name email'
    });

    if (isChat.length > 0) {
      res.send(isChat[0]);
    } else {
      const chatData = {
        chatName: 'sender',
        isGroupChat: false,
        users: [req.user._id, targetUserId]
      };

      const createdChat = await Chat.create(chatData);
      const fullChat = await Chat.findOne({ _id: createdChat._id }).populate('users', '-password');
      res.status(200).json(fullChat);
    }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

// Get all chats for a user
const getChats = async (req, res) => {
  try {
    Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
      .populate('users', '-password')
      .populate('admin', '-password')
      .populate('latestMessage')
      .sort({ updatedAt: -1 })
      .then(async (results) => {
        results = await User.populate(results, {
          path: 'latestMessage.sender',
          select: 'name email'
        });
        res.status(200).send(results);
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get messages for a chat
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name email')
      .populate('chat');
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    const { content, chatId } = req.body;

    if (!content || !chatId) {
      return res.status(400).json({ message: 'Invalid data passed into request' });
    }

    const newMessage = {
      sender: req.user._id,
      content: content,
      chat: chatId
    };

    let message = await Message.create(newMessage);
    message = await message.populate('sender', 'name');
    message = await message.populate('chat');
    message = await User.populate(message, {
      path: 'chat.users',
      select: 'name email'
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createChat,
  getChats,
  getMessages,
  sendMessage
};