const stripHtmlTags = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
};

const sanitizeString = (str, maxLength = 500) => {
  if (!str || typeof str !== 'string') return '';
  const stripped = stripHtmlTags(str);
  return stripped.slice(0, maxLength).trim();
};

const validateSaveInput = (req, res, next) => {
  try {
    const { title, url, description, notes } = req.body;

    // Validate title
    if (title && typeof title !== 'string') {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'title must be a string' },
      });
    }
    if (title && title.length > 200) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'title must be less than 200 characters' },
      });
    }

    // Validate description
    if (description && typeof description !== 'string') {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'description must be a string' },
      });
    }
    if (description && description.length > 2000) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'description must be less than 2000 characters' },
      });
    }

    // Validate notes
    if (notes && typeof notes !== 'string') {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'notes must be a string' },
      });
    }
    if (notes && notes.length > 1000) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'notes must be less than 1000 characters' },
      });
    }

    // Validate URL if provided
    if (url && typeof url !== 'string') {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'url must be a string' },
      });
    }
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          status: 'error',
          error: { code: 'VALIDATION_ERROR', message: 'url must be a valid URL' },
        });
      }
    }

    // Sanitize strings to prevent XSS
    if (req.body.title) req.body.title = sanitizeString(req.body.title, 200);
    if (req.body.description) req.body.description = sanitizeString(req.body.description, 2000);
    if (req.body.notes) req.body.notes = sanitizeString(req.body.notes, 1000);

    next();
  } catch (error) {
    res.status(400).json({
      status: 'error',
      error: { code: 'VALIDATION_ERROR', message: error.message },
    });
  }
};

module.exports = {
  validateSaveInput,
  sanitizeString,
  stripHtmlTags,
};
