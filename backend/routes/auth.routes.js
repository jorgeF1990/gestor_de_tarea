const express = require('express');
const {
  login,
  register,
  recuperarPassword,
  resetPassword
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/recuperar', recuperarPassword);
router.post('/reset/:token', resetPassword);

module.exports = router;