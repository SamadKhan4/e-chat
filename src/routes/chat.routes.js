const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { createChat, getChats, getMessages, sendMessage } = require('../controllers/chat.controller');

const router = express.Router();

router.route('/').post(protect, createChat);
router.route('/').get(protect, getChats);
router.route('/:chatId/messages').get(protect, getMessages);
router.route('/message').post(protect, sendMessage);

module.exports = router;