const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/categoriesController');

router.use(authenticate);

router.get('/', ctrl.getCategories);

router.post('/', [
  body('name').trim().notEmpty().withMessage('Nom kerak'),
  body('type').isIn(['INCOME', 'EXPENSE']).withMessage('Turi kerak'),
], validate, ctrl.createCategory);

module.exports = router;