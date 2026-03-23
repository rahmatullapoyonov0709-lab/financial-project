const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/transfersController');

router.use(authenticate);

router.get('/', ctrl.getTransfers);
router.get('/quote', [
  query('fromAccountId').isUUID().withMessage('Jonatuvchi hisob kerak'),
  query('toAccountId').isUUID().withMessage('Qabul qiluvchi hisob kerak'),
  query('amount').optional().isFloat({ gt: 0 }).withMessage('Summa notogri'),
], validate, ctrl.getTransferQuote);

router.post('/', [
  body('fromAccountId').isUUID().withMessage('Jonatuvchi hisob kerak'),
  body('toAccountId').isUUID().withMessage('Qabul qiluvchi hisob kerak'),
  body('fromAmount').isFloat({ gt: 0 }).withMessage('Summa kerak'),
  body('date').optional().isDate(),
  body('note').optional().isString().isLength({ max: 500 }),
], validate, ctrl.createTransfer);

router.delete('/:id', [
  param('id').isUUID(),
], validate, ctrl.deleteTransfer);

module.exports = router;
