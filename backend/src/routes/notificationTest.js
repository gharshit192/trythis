// Development-only notification testing endpoints.
// Allows manual triggering of notifications for testing without waiting for cron.

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const realtimeNotificationTrigger = require('../services/realtimeNotificationTrigger');

router.use(authMiddleware);

/**
 * Test notification trigger for a specific day/time.
 *
 * Usage:
 *   POST /notifications/test/time
 *   {
 *     "dayOfWeek": 5,        // 0=Sunday, 5=Friday
 *     "hour": 18,             // 0-23
 *     "userLocation": {       // optional
 *       "lat": 15.4909,
 *       "lng": 73.8278
 *     }
 *   }
 *
 * Example - Friday 6pm:
 *   POST /notifications/test/time
 *   { "dayOfWeek": 5, "hour": 18 }
 */
router.post('/test/time', async (req, res) => {
  try {
    const { dayOfWeek, hour, userLocation } = req.body;
    const userId = req.user.id;

    if (dayOfWeek === undefined || hour === undefined) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'INVALID_INPUT',
          message: 'dayOfWeek and hour are required. dayOfWeek: 0-6 (Sun-Sat), hour: 0-23',
        },
      });
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'INVALID_DAY',
          message: 'dayOfWeek must be 0-6 (Sunday=0, Friday=5, Saturday=6)',
        },
      });
    }

    if (hour < 0 || hour > 23) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'INVALID_HOUR',
          message: 'hour must be 0-23',
        },
      });
    }

    logger.info(`[notificationTest] Testing notifications for user ${userId} at day=${dayOfWeek}, hour=${hour}`);

    const notifications = await realtimeNotificationTrigger.testTriggerForTime(userId, {
      dayOfWeek,
      hour,
      userLocation,
    });

    res.json({
      status: 'success',
      data: {
        userId,
        testParams: {
          dayOfWeek,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
          hour,
          time: `${String(hour).padStart(2, '0')}:00`,
          userLocation,
        },
        created: {
          count: notifications.length,
          notifications: notifications.map((n) => ({
            _id: n._id,
            type: n.type,
            title: n.title,
            message: n.message,
            priority: n.priority,
            relevanceScore: n.relevanceScore,
            relatedSaveId: n.relatedSaveId,
          })),
        },
      },
    });
  } catch (error) {
    logger.error(`[notificationTest] time endpoint failed: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: {
        code: 'TEST_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Get test parameters and examples.
 * Helps understand how to use the test endpoints.
 *
 * GET /notifications/test/help
 */
router.get('/test/help', (req, res) => {
  res.json({
    status: 'success',
    data: {
      endpoint: 'POST /notifications/test/time',
      description: 'Test notifications for a specific day and hour',
      examples: {
        fridayEvening6pm: {
          url: 'POST /notifications/test/time',
          body: {
            dayOfWeek: 5,
            hour: 18,
            description: 'Friday 6pm — weekend planning triggers (travel, experience)',
          },
        },
        saturdayMorning10am: {
          url: 'POST /notifications/test/time',
          body: {
            dayOfWeek: 6,
            hour: 10,
            description: 'Saturday 10am — brunch time (cafe, restaurant)',
          },
        },
        sundayEvening7pm: {
          url: 'POST /notifications/test/time',
          body: {
            dayOfWeek: 0,
            hour: 19,
            description: 'Sunday 7pm — week-ahead planning (fitness, experience)',
          },
        },
        withLocation: {
          url: 'POST /notifications/test/time',
          body: {
            dayOfWeek: 5,
            hour: 18,
            userLocation: {
              lat: 15.4909,
              lng: 73.8278,
              description: 'Goa coordinates — tests nearby rediscovery',
            },
          },
        },
      },
      dayOfWeek: {
        0: 'Sunday',
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday',
      },
      triggers: {
        'Friday 5-9pm': { type: 'time_behavioral', categories: ['travel', 'experience'], example: 'dayOfWeek: 5, hour: 18' },
        'Saturday 8am-12pm': { type: 'time_behavioral', categories: ['cafe', 'restaurant'], example: 'dayOfWeek: 6, hour: 10' },
        'Sunday 8-11am': { type: 'time_behavioral', categories: ['cafe'], example: 'dayOfWeek: 0, hour: 9' },
        'Sunday 6-10pm': { type: 'time_behavioral', categories: ['fitness', 'experience'], example: 'dayOfWeek: 0, hour: 19' },
        'Weekday lunch 12-2pm': { type: 'time_behavioral', categories: ['restaurant', 'cafe'], example: 'dayOfWeek: 1, hour: 13' },
        'Nearby location': { type: 'nearby_rediscovery', requires: 'userLocation', example: 'Include lat/lng' },
        'Forgotten intent': { type: 'forgotten_intent', requires: 'saves 30+ days old', example: 'works automatically' },
        'Seasonal': { type: 'seasonal', depends: 'current month', example: 'runs automatically' },
      },
    },
  });
});

module.exports = router;
