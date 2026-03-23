const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/householdController');

router.use(authenticate);

router.get('/me', ctrl.getMyHousehold);
router.post('/invites', [
  body('email').trim().isEmail().withMessage('Email notogri'),
], validate, ctrl.inviteByEmail);
router.post('/invites/accept', [
  body('token').isString().trim().isLength({ min: 10 }).withMessage('Token notogri'),
], validate, ctrl.acceptInvite);
router.post('/join-by-code', [
  body('code').isString().trim().isLength({ min: 20 }).withMessage('Qoshilish kodi notogri'),
], validate, ctrl.joinByCode);
router.post('/join-code/regenerate', ctrl.regenerateJoinCode);
router.delete('/members/:userId', [
  param('userId').isUUID().withMessage('Azo ID notogri'),
], validate, ctrl.removeMember);

module.exports = router;
