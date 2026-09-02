const express = require('express');
const { publicBaseUrl, appUrl } = require('../utils/publicUrl');
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

// Everything the pipeline extracted, as HTML, in the same order the app shows
// it: the whole point of sharing a save is that the other person gets the
// recipe, the plan, the place — not a title and three bullets.
const sectionsHtml = (save, esc) => {
  const sd = save.aiAnalysis?.structuredData || {};
  const h = [];
  const section = (title, inner) => { if (inner) h.push(`<div class="key-points"><h3>${esc(title)}</h3>${inner}</div>`); };
  const list = (items, numbered) => {
    const xs = (items || []).filter(Boolean);
    if (!xs.length) return '';
    return `<${numbered ? 'ol' : 'ul'} style="margin:0;padding-left:${numbered ? '1.2rem' : '0'};list-style:${numbered ? 'decimal' : 'none'};">${xs.map((x) => `<li style="margin:0.4rem 0;color:#333;">${esc(String(x))}</li>`).join('')}</${numbered ? 'ol' : 'ul'}>`;
  };
  const facts = (pairs) => { const xs = pairs.filter(([, v]) => v != null && v !== ''); return xs.length ? `<p style="color:#555;margin:0 0 .5rem;">${xs.map(([k, v]) => `<strong>${esc(k)}:</strong> ${esc(String(v))}`).join(' · ')}</p>` : ''; };

  const r = sd.recipe;
  if (r?.isRecipe) section('Recipe', facts([['Time', r.cookingTime], ['Serves', r.servings], ['Cuisine', r.cuisine]]) + (r.ingredients?.length ? `<h4 style="margin:.6rem 0 .3rem;font-size:.85rem;">Ingredients</h4>${list(r.ingredients)}` : '') + (r.steps?.length ? `<h4 style="margin:.8rem 0 .3rem;font-size:.85rem;">Steps</h4>${list(r.steps, true)}` : ''));
  const p = sd.product;
  if (p && (p.name || p.price != null)) section('Product', facts([['Name', p.name], ['Brand', p.brand], ['Price', p.price != null ? `₹${p.price}` : null]]) + list(p.availableItems));
  const e = sd.event;
  if (e && (e.eventName || e.venue)) section('Event', facts([['What', e.eventName], ['Where', e.venue], ['When', e.eventDate ? new Date(e.eventDate).toDateString() : null], ['Tickets', e.price != null ? `₹${e.price}` : null]]));
  const pl = sd.place;
  if (pl && (pl.address || pl.cuisine || pl.priceRange)) section('The place', facts([['Cuisine', pl.cuisine], ['Price', pl.priceRange], ['Address', pl.address]]));
  const it = sd.itinerary;
  if (it && (it.highlights?.length || it.destination)) section('Trip', facts([['Destination', it.destination], ['Days', it.duration], ['Budget', it.estimatedCost], ['Best in', it.bestSeason]]) + list(it.highlights));
  const plan = save.tripPlan?.data;
  if (plan?.dailyPlan?.length) {
    const days = plan.dailyPlan.map((d) => `<h4 style="margin:.8rem 0 .2rem;font-size:.9rem;">Day ${d.day} — ${esc(d.theme || '')}${d.stayArea ? ` <span style="font-weight:400;color:#777;">(stay: ${esc(d.stayArea)})</span>` : ''}</h4>${list((d.stops || []).map((x) => `${x.place}${x.notes ? ` — ${x.notes}` : ''}`))}`).join('');
    const link = (x, label) => `<li style="margin:.3rem 0;"><a href="${esc(x.url)}" style="color:#0E7C7B;">${esc(label)}</a></li>`;
    const stays = (plan.destinations || []).flatMap((d) => (d.stays || []).map((x) => link(x, `${x.provider}${x.tier ? ` — ${x.tier}` : ''} (${d.name})`)));
    const there = (plan.destinations || []).flatMap((d) => (d.gettingThere || []).map((x) => link(x, `${x.mode}${x.provider ? ` via ${x.provider}` : ''} (${d.name})`)));
    section(plan.tripTitle || 'Day-by-day plan', facts([['Budget', plan.estimatedBudgetInr ? `about ₹${Number(plan.estimatedBudgetInr).toLocaleString('en-IN')}` : null]]) + days
      + (stays.length ? `<h4 style="margin:.9rem 0 .2rem;font-size:.85rem;">Stays</h4><ul style="list-style:none;padding:0;margin:0;">${stays.join('')}</ul>` : '')
      + (there.length ? `<h4 style="margin:.9rem 0 .2rem;font-size:.85rem;">Getting there</h4><ul style="list-style:none;padding:0;margin:0;">${there.join('')}</ul>` : ''));
  }
  if (save.source === 'voice') section('From a voice note', facts([['Who', (save.entities?.people || []).join(', ')], ['Where', save.entities?.place], ['About', save.entities?.topic]]) + (save.aiAnalysis?.transcription?.text ? `<p style="color:#555;font-style:italic;margin:.4rem 0 0;">“${esc(save.aiAnalysis.transcription.text.slice(0, 600))}”</p>` : ''));
  return h.join('');
};

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
    const title = escapeHtml(save.title || 'Untitled Save');
    const description = escapeHtml(save.description || save.aiAnalysis?.summary || 'Check this out on TryThis');
    const image = save.thumbnail || 'https://trythis.app/og-default.png';
    const shareUrl = `${publicBaseUrl()}/s/${shareId}`;

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
    const app = appUrl();
    const categoryLabel = save.category || 'Save';

    // Build key points HTML
    const keyPointsHtml = (save.aiAnalysis?.keyPoints || [])
      .slice(0, 10)
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
        border-left: 3px solid #0E7C7B;
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
        background: #0E7C7B;
        color: white;
      }

      .cta-button-primary:hover {
        background: #0A5A59;
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
          ${sectionsHtml(save, escapeHtml)}

          ${tagsHtml ? `<div class="tags"><span class="tags-label">Tags</span><div class="tags-container">${tagsHtml}</div></div>` : ''}

          ${save.url ? `<div class="cta-section">
            <a href="${escapeHtml(save.url)}" target="_blank" rel="noopener noreferrer" class="cta-button cta-button-primary">View Original</a>
            
          </div>` : `<div class="cta-section">
            
          </div>`}

          <div class="sharer">Shared by ${escapeHtml(sharer)} on TryThis</div>
        </div>
      </div>
    </div>
        <div style="max-width:560px;margin:0 auto;padding:8px 20px 40px;display:flex;flex-direction:column;gap:10px;">
        <a href="${app}/?open=${shareId}" style="display:block;text-align:center;padding:15px;border-radius:12px;background:#0E7C7B;color:#fff;font-weight:600;text-decoration:none;font-size:16px;">Open in Wanna Try</a>
        <a href="${app}/?signup=1" style="display:block;text-align:center;padding:14px;border-radius:12px;background:#fff;border:1px solid #E7E2DA;color:#15201E;font-weight:500;text-decoration:none;font-size:15px;">Create a free account</a>
        <p style="text-align:center;font-size:12.5px;color:#9BA5A2;margin:6px 0 0;">Shared from Wanna Try — save it, and it comes back when you can go.</p>
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
