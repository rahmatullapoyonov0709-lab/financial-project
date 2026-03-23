const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/budgetsController');

router.use(authenticate);

router.get('/', ctrl.getBudgets);

router.post('/', [
  body('categoryId').isUUID().withMessage('Kategoriya kerak'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Oy kerak'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Yil kerak'),
  body('limitAmount').isFloat({ gt: 0 }).withMessage('Limit summasi kerak'),
], validate, ctrl.createBudget);

router.put('/:id', [
  param('id').isUUID(),
  body('limitAmount').isFloat({ gt: 0 }),
], validate, ctrl.updateBudget);

router.delete('/:id', [
  param('id').isUUID(),
], validate, ctrl.deleteBudget);

module.exports = router;
