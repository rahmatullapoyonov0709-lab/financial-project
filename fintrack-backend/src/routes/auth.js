const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/authController');

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: 'auth-register',
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth-login',
});

const refreshLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'auth-refresh',
});

router.post('/register', registerLimiter, [
  body('name').trim().notEmpty().withMessage('Ism kerak').isLength({ min: 2, max: 100 }),
  body('email').trim().isEmail().withMessage('Email notogri').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Parol kamida 6 belgi'),
], validate, ctrl.register);

router.post('/login', loginLimiter, [
  body('email').trim().isEmail().withMessage('Email notogri'),
  body('password').notEmpty().withMessage('Parol kerak'),
], validate, ctrl.login);

router.post('/google', loginLimiter, [
  body('credential').isString().trim().notEmpty().withMessage('Google credential kerak'),
], validate, ctrl.loginWithGoogle);

router.post('/forgot-password', loginLimiter, [
  body('email').trim().isEmail().withMessage('Email notogri').normalizeEmail(),
], validate, ctrl.forgotPassword);

router.post('/reset-password', loginLimiter, [
  body('token').isString().trim().notEmpty().withMessage('Reset token kerak'),
  body('newPassword').isLength({ min: 6 }).withMessage('Yangi parol kamida 6 belgi'),
], validate, ctrl.resetPassword);

router.post('/refresh', refreshLimiter, [
  body('refreshToken').isString().trim().notEmpty().withMessage('refreshToken kerak'),
], validate, ctrl.refresh);

router.post('/logout', [
  body('refreshToken').isString().trim().notEmpty().withMessage('refreshToken kerak'),
], validate, ctrl.logout);

router.post('/logout-all', authenticate, ctrl.logoutAll);

router.get('/me', authenticate, ctrl.getMe);
router.put('/me', authenticate, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Ism 2-100 belgi bolishi kerak'),
  body('email').optional().trim().isEmail().withMessage('Email notogri').normalizeEmail(),
], validate, ctrl.updateMe);

router.put('/password', authenticate, [
  body('currentPassword').isString().trim().notEmpty().withMessage('Joriy parol kerak'),
  body('newPassword').isLength({ min: 6 }).withMessage('Yangi parol kamida 6 belgi'),
], validate, ctrl.changePassword);

module.exports = router;
