const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/aiController');

router.use(authenticate);

router.post('/categorize', [
  body('description').isString().isLength({ min: 2 }).withMessage('Tavsif kerak'),
], validate, ctrl.categorize);
router.get('/settings', ctrl.getSettings);
router.put('/settings', [
  body('enabled').optional().isBoolean().withMessage('enabled boolean bolishi kerak'),
  body('reportPeriod').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('reportPeriod notogri'),
  body('deliveryTime').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('deliveryTime HH:mm formatida bolishi kerak'),
  body('timezone').optional().isString().isLength({ min: 2, max: 64 }).withMessage('timezone notogri'),
  body('language').optional().isIn(['uz', 'en', 'ru']).withMessage('language notogri'),
  body('model').optional().isString().isLength({ min: 3, max: 120 }).withMessage('model notogri'),
], validate, ctrl.updateSettings);
router.post('/reports/send-now', ctrl.sendReportNow);

module.exports = router;
