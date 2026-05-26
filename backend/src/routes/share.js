const express = require('express');
const router = express.Router();
const Save = require('../models/Save');
const logger = require('../utils/logger');

// Escape HTML to prevent injection
const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

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
              <a href="https://trythis.app" style="display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #1B3A2F; color: white; text-decoration: none; border-radius: 8px;">Try TryThis</a>
            </div>
          </body>
        </html>
      `);
    }

    const sharer = save.userId?.firstName || 'Someone';
    const title = escapeHtml(save.title || 'Untitled Save');
    const description = escapeHtml(save.description || save.aiAnalysis?.summary || 'Check this out on TryThis');
    const image = save.thumbnail || 'https://trythis.app/og-default.png';
    const shareUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/s/${shareId}`;

    // Category-to-emoji mapping
    const categoryEmoji = {
      'food': '🍽️',
      'travel': '✈️',
      'shopping': '🛍️',
      'experience': '🎯',
      'tech': '💻',
      'fashion': '👗',
      'beauty': '✨',
      'fitness': '💪',
      'cafes': '☕',
      'restaurants': '🍽️',
      'hotels': '🏨',
      'recipes': '👨‍🍳',
      'events': '🎉',
      'entertainment': '🎬',
    };

    const emoji = categoryEmoji[save.category] || '📌';
    const categoryLabel = save.category || 'Save';

    // Build key points HTML
    const keyPointsHtml = (save.aiAnalysis?.keyPoints || [])
      .slice(0, 3)
      .map(point => `<li style="margin: 0.5rem 0; color: #555;">${escapeHtml(point)}</li>`)
      .join('');

    // Build tags HTML
    const tagsHtml = (save.tags || [])
      .slice(0, 6)
      .map(tag => `<span style="display: inline-block; margin: 0.25rem; padding: 0.25rem 0.75rem; background: #e8e8e8; color: #333; border-radius: 16px; font-size: 0.85rem;">#${escapeHtml(tag)}</span>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />

    <!-- Open Graph meta tags -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="TryThis" />

    <!-- Twitter card meta tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />

    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #fafafa;
        color: #333;
      }

      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 1rem;
      }

      .card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        margin: 1rem 0;
      }

      .card-image {
        width: 100%;
        height: 300px;
        object-fit: cover;
        background: #e8e8e8;
      }

      .card-content {
        padding: 1.5rem;
      }

      .category-badge {
        display: inline-block;
        margin-bottom: 0.5rem;
        padding: 0.375rem 0.75rem;
        background: #f0f0f0;
        border-radius: 6px;
        font-size: 0.85rem;
        color: #666;
      }

      .title {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0.5rem 0 1rem 0;
        line-height: 1.4;
      }

      .description {
        font-size: 0.95rem;
        color: #666;
        line-height: 1.5;
        margin: 1rem 0;
      }

      .sharer {
        font-size: 0.85rem;
        color: #999;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
      }

      .key-points {
        margin: 1rem 0;
        padding: 1rem;
        background: #f9f9f9;
        border-radius: 8px;
        border-left: 3px solid #1B3A2F;
      }

      .key-points h3 {
        font-size: 0.9rem;
        color: #333;
        margin-bottom: 0.5rem;
        font-weight: 600;
      }

      .key-points ul {
        list-style: none;
        margin: 0;
      }

      .tags {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
      }

      .tags-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #666;
        margin-bottom: 0.5rem;
        display: block;
      }

      .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .cta-section {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
        display: flex;
        gap: 0.75rem;
        flex-direction: column;
      }

      .cta-button {
        display: inline-block;
        padding: 0.875rem 1.5rem;
        border-radius: 8px;
        text-decoration: none;
        text-align: center;
        font-weight: 500;
        font-size: 0.95rem;
        transition: all 0.2s ease;
      }

      .cta-button-primary {
        background: #1B3A2F;
        color: white;
      }

      .cta-button-primary:hover {
        background: #142a22;
      }

      .cta-button-secondary {
        background: #e8e8e8;
        color: #333;
      }

      .cta-button-secondary:hover {
        background: #d8d8d8;
      }

      @media (max-width: 600px) {
        .container {
          padding: 0;
        }

        .card {
          border-radius: 0;
          margin: 0;
        }

        .card-content {
          padding: 1.25rem;
        }

        .card-image {
          height: 250px;
        }

        .title {
          font-size: 1.25rem;
        }

        .cta-section {
          flex-direction: column;
        }

        .cta-button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        ${image ? `<img src="${escapeHtml(image)}" alt="${title}" class="card-image" />` : ''}
        <div class="card-content">
          <div class="category-badge">${emoji} ${categoryLabel}</div>
          <h1 class="title">${title}</h1>

          ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}

          ${keyPointsHtml ? `<div class="key-points"><h3>Key Points</h3><ul>${keyPointsHtml}</ul></div>` : ''}

          ${tagsHtml ? `<div class="tags"><span class="tags-label">Tags</span><div class="tags-container">${tagsHtml}</div></div>` : ''}

          ${save.url ? `<div class="cta-section">
            <a href="${escapeHtml(save.url)}" target="_blank" rel="noopener noreferrer" class="cta-button cta-button-primary">View Original</a>
            <a href="https://trythis.app" target="_blank" rel="noopener noreferrer" class="cta-button cta-button-secondary">Try TryThis</a>
          </div>` : `<div class="cta-section">
            <a href="https://trythis.app" target="_blank" rel="noopener noreferrer" class="cta-button cta-button-primary">Try TryThis</a>
          </div>`}

          <div class="sharer">Shared by ${escapeHtml(sharer)} on TryThis</div>
        </div>
      </div>
    </div>
  </body>
</html>`;

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
