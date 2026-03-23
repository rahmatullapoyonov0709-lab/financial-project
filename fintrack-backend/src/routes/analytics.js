const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.use(authenticate);

router.get('/summary', ctrl.getSummary);
router.get('/by-category', ctrl.getByCategory);
router.get('/by-period', ctrl.getByPeriod);
router.get('/budget-vs-actual', ctrl.getBudgetVsActual);
router.get('/calendar', ctrl.getCalendar);

module.exports = router;
