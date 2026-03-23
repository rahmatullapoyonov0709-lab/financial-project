const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/accountsController');

router.use(authenticate);

router.get('/', ctrl.getAccounts);
router.get('/reconcile', ctrl.reconcileAccounts);

router.post('/', [
  body('name').trim().notEmpty().withMessage('Nom kerak'),
  body('type').isIn(['CASH', 'BANK_CARD', 'SAVINGS']).withMessage('Turi notogri'),
  body('currency').optional().isIn(['UZS', 'USD', 'EUR', 'RUB']),
  body('balance').optional().isFloat({ min: 0 }),
], validate, ctrl.createAccount);

router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().trim().notEmpty(),
  body('type').optional().isIn(['CASH', 'BANK_CARD', 'SAVINGS']),
  body('currency').optional().isIn(['UZS', 'USD', 'EUR', 'RUB']),
], validate, ctrl.updateAccount);

router.delete('/:id', [
  param('id').isUUID(),
], validate, ctrl.deleteAccount);

module.exports = router;
