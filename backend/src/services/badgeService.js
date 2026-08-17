// The number on the app icon.
//
// One number, one definition, used by both the push payload (so the icon is
// right the moment a notification lands, while the app is closed) and the
// /notifications/badge endpoint (so it stays right while the app is open).

const Notification = require('../models/Notification');

// "Unread" is pending + sent — the same rule the notifications list uses for its
// unreadCount, so the icon and the in-app bell can never disagree.
const unreadCount = async (userId) => {
  return Notification.countDocuments({
    userId,
    status: { $in: ['pending', 'sent'] },
  });
};

module.exports = { unreadCount };
