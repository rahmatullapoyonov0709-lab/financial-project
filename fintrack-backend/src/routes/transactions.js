const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/transactionsController');

router.use(authenticate);

router.get('/', ctrl.getTransactions);
router.get('/quote', ctrl.getTransactionQuote);

router.post('/', [
  body('type').isIn(['INCOME', 'EXPENSE']).withMessage('Turi kerak'),
  body('amount').isFloat({ gt: 0 }).withMessage('Summa kerak'),
  body('inputCurrency').optional().isIn(['UZS', 'USD', 'EUR', 'RUB']).withMessage('Valyuta notogri'),
  body('accountId').isUUID().withMessage('Hisob kerak'),
  body('categoryId').isUUID().withMessage('Kategoriya kerak'),
  body('date').optional().isDate(),
], validate, ctrl.createTransaction);

router.put('/:id', [
  param('id').isUUID(),
  body('type').optional().isIn(['INCOME', 'EXPENSE']),
  body('amount').optional().isFloat({ gt: 0 }),
  body('accountId').optional().isUUID(),
  body('categoryId').optional().isUUID(),
  body('date').optional().isDate(),
], validate, ctrl.updateTransaction);

router.delete('/:id', [
  param('id').isUUID(),
], validate, ctrl.deleteTransaction);

module.exports = router;
