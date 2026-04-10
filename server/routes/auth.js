const express = require('express');
const router = express.Router();
const { signup, login, getDashboard } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

router.post('/signup', signup);
router.post('/login', login);
router.get('/dashboard', authMiddleware, getDashboard);

module.exports = router;
