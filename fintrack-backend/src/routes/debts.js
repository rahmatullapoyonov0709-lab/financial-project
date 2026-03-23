const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/debtsController');

router.use(authenticate);

router.get('/', ctrl.getDebts);

router.post('/', [
  body('personName').trim().notEmpty().withMessage('Ism kerak'),
  body('type').isIn(['LENT', 'BORROWED']).withMessage('Turi kerak'),
  body('amount').isFloat({ gt: 0 }).withMessage('Summa kerak'),
  body('currency').optional().isIn(['UZS', 'USD', 'EUR', 'RUB']),
], validate, ctrl.createDebt);

router.put('/:id', [
  param('id').isUUID(),
  body('personName').optional().trim().notEmpty(),
  body('amount').optional().isFloat({ gt: 0 }),
  body('description').optional().isString(),
  body('dueDate').optional().isDate(),
  body('status').optional().isIn(['OPEN', 'CLOSED']),
], validate, ctrl.updateDebt);

router.delete('/:id', [
  param('id').isUUID(),
], validate, ctrl.deleteDebt);

module.exports = router;
