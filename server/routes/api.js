const express = require('express');
const router = express.Router();
const { convertImage } = require('../controllers/extractController');

router.post('/convert', convertImage);

module.exports = router;