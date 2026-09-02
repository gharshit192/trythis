const express = require('express');
const { publicBaseUrl, appUrl } = require('../utils/publicUrl');
const router = express.Router();
const Save = require('../models/Save');
const logger = require('../utils/logger');
const { renderSharePage } = require('../services/sharePage');


// GET /api/:shareId — Public API endpoint to fetch a shared save (no auth required)
router.get('/api/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const save = await Save.findOne({ shareId, status: 'active' }).populate('userId', 'firstName');

    if (!save) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Shared save not found' },
      });
    }

    res.json({
      status: 'success',
      data: {
        ...save.toObject(),
        sharer: {
          firstName: save.userId?.firstName || 'Someone',
        },
      },
    });
  } catch (error) {
    logger.error(`Fetch shared save error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'FETCH_ERROR', message: error.message },
    });
  }
});

// GET /:shareId — Public HTML preview page with OG meta tags

router.get('/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const save = await Save.findOne({ shareId, status: 'active' }).populate('userId', 'firstName');

    // Track view and create notification (fire-and-forget)
    if (save) {
      setImmediate(async () => {
        try {
          const Notification = require('../models/Notification');

          // Increment view count
          await Save.findByIdAndUpdate(save._id, {
            $inc: { 'shareStats.viewCount': 1 },
            $set: { 'shareStats.lastViewedAt': new Date() }
          });

          // Only create notification if not sent in last 6 hours
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
          const recentNotif = await Notification.findOne({
            userId: save.userId,
            type: 'shared_save_viewed',
            'metadata.saveId': save._id.toString(),
            createdAt: { $gte: sixHoursAgo }
          });

          if (!recentNotif) {
            // Get updated view count
            const updatedSave = await Save.findById(save._id).select('shareStats title');
            const viewCount = updatedSave.shareStats?.viewCount || 1;

            const body = viewCount === 1
              ? `Someone just opened your shared save "${save.title}".`
              : `Your save "${save.title}" has been viewed ${viewCount} times.`;

            await Notification.create({
              userId: save.userId,
              type: 'shared_save_viewed',
              title: viewCount === 1 ? 'Someone viewed your save' : `${viewCount} people viewed your save`,
              body,
              saveId: save._id,
              priority: 'low',
              read: false,
              dismissed: false,
              metadata: {
                saveId: save._id.toString(),
                saveTitle: save.title,
                viewCount
              }
            });
          }
        } catch (err) {
          logger.error('[share view tracking] failed:', err.message);
        }
      });
    }

    if (!save) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Shared Save Not Found</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5;">
            <div style="text-align: center; padding: 2rem;">
              <h1 style="margin: 0 0 0.5rem 0; color: #333;">Shared Save Not Found</h1>
              <p style="margin: 0; color: #666;">This save may have been removed or the link is invalid.</p>
              <a href="https://trythis.app" style="display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #0E7C7B; color: white; text-decoration: none; border-radius: 8px;">Try TryThis</a>
            </div>
          </body>
        </html>
      `);
    }

    const sharer = save.userId?.firstName || 'Someone';
    const html = renderSharePage({ save: save.toObject(), shareId, sharer, shareUrl: `${publicBaseUrl()}/s/${shareId}`, app: appUrl() });

    res.type('text/html').send(html);
  } catch (error) {
    logger.error(`Share page error: ${error.message}`);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5;">
          <div style="text-align: center; padding: 2rem;">
            <h1 style="margin: 0 0 0.5rem 0; color: #333;">Something went wrong</h1>
            <p style="margin: 0; color: #666;">Please try again later.</p>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;
