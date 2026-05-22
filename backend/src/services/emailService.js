const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Email transporter setup
// For MVP: use Mailtrap (free tier) or local SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || 'demo',
    pass: process.env.SMTP_PASS || 'demo',
  },
});

const sendNotificationEmail = async (user, notification) => {
  try {
    if (!user.email) {
      logger.warn(`No email for user ${user._id}, skipping notification email`);
      return false;
    }

    const emailContent = `
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>${notification.title}</h2>
      <p>${notification.message}</p>

      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 0 0 10px 0; color: #666;">Category: <strong>${notification.category}</strong></p>
        <p style="margin: 0; color: #666;">Priority: <strong>${notification.priority}</strong></p>
      </div>

      <a href="${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/save/${notification.relatedSaveId}"
         style="display: inline-block; background: #1a472a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px;">
        View in TryThis
      </a>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 12px; color: #999; margin: 0;">
        You received this because you have notifications enabled for ${notification.category} saves.
        <a href="${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/settings" style="color: #1a472a;">
          Update preferences
        </a>
      </p>
    </div>
  </body>
</html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@trythis.app',
      to: user.email,
      subject: notification.title,
      html: emailContent,
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`✅ Notification email sent to ${user.email}: ${notification.title}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to send notification email: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendNotificationEmail,
  transporter,
};
