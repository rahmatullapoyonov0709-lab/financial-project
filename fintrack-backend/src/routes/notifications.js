const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notificationsController');

router.use(authenticate);

router.get('/', ctrl.listNotifications);
router.put('/read-all', ctrl.markAllNotificationsRead);
router.put('/:id/read', ctrl.markNotificationRead);
router.delete('/:id', ctrl.deleteNotification);

module.exports = router;
