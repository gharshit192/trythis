/**
 * Friday 6pm Notification Test Script
 *
 * This script:
 * 1. Creates a test user (or uses existing)
 * 2. Creates a Goa travel save (if not exists)
 * 3. Triggers Friday 6pm notification manually
 * 4. Displays results
 */

const http = require('http');
const User = require('./backend/src/models/User');
const Save = require('./backend/src/models/Save');
const Notification = require('./backend/src/models/Notification');
const realtimeNotificationTrigger = require('./backend/src/services/realtimeNotificationTrigger');
const connectDB = require('./backend/src/config/database');
const logger = require('./backend/src/utils/logger');

async function runTest() {
  try {
    console.log('\n🔔 FRIDAY 6PM NOTIFICATION TEST');
    console.log('================================\n');

    // Connect to DB
    console.log('📡 Connecting to database...');
    await connectDB();
    console.log('✅ Connected\n');

    // Create or get test user
    console.log('👤 Setting up test user...');
    let user = await User.findOne({ email: 'friday-test@trythis.dev' });

    if (!user) {
      user = new User({
        name: 'Friday Test User',
        email: 'friday-test@trythis.dev',
        password: 'hashed_password_dummy',
        status: 'active',
        timezoneOffset: 330, // IST (UTC+5:30)
      });
      await user.save();
      console.log(`✅ Created test user: ${user._id}\n`);
    } else {
      console.log(`✅ Using existing test user: ${user._id}\n`);
    }

    // Create or get Goa travel save
    console.log('🗺️  Setting up Goa travel save...');
    let save = await Save.findOne({
      userId: user._id,
      title: /goa/i
    });

    if (!save) {
      save = new Save({
        userId: user._id,
        type: 'url',
        sourceType: 'url',
        title: 'Goa Weekend Itinerary - Top Things to Do',
        description: 'Perfect weekend getaway - beaches, temples, and local food',
        url: 'https://example.com/goa-itinerary',
        category: 'travel',
        status: 'active',
        processingStatus: 'done',
        metadata: {
          extractedLocation: {
            lat: 15.4909,
            lng: 73.8278,
            city: 'Goa'
          }
        },
        engagement: {
          views: 0,
          visited: false,
          saved: true
        }
      });
      await save.save();
      console.log(`✅ Created Goa travel save: ${save._id}\n`);
    } else {
      console.log(`✅ Using existing Goa save: ${save._id}\n`);
    }

    // Trigger notification for Friday 6pm
    console.log('🎯 Triggering Friday 6pm (18:00) notification...\n');

    const notifications = await realtimeNotificationTrigger.testTriggerForTime(
      user._id.toString(),
      {
        dayOfWeek: 5,  // Friday
        hour: 18,      // 6pm
        userLocation: {
          lat: 15.4909,
          lng: 73.8278
        }
      }
    );

    console.log(`\n📊 Results:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Notifications Created: ${notifications.length}\n`);

    if (notifications.length > 0) {
      for (let i = 0; i < notifications.length; i++) {
        const notif = notifications[i];
        console.log(`\n📬 Notification ${i + 1}:`);
        console.log(`   ID:           ${notif._id}`);
        console.log(`   Type:         ${notif.type}`);
        console.log(`   Title:        ${notif.title}`);
        console.log(`   Message:      ${notif.message}`);
        console.log(`   Priority:     ${notif.priority}`);
        console.log(`   Score:        ${notif.relevanceScore}`);
        console.log(`   Status:       ${notif.status}`);
        console.log(`   Related Save: ${notif.relatedSaveId}`);

        if (notif.metadata) {
          console.log(`   Metadata:`);
          console.log(`     - Rule ID: ${notif.metadata.ruleId || 'N/A'}`);
          console.log(`     - Day of Week: ${notif.metadata.dayOfWeek || 'N/A'}`);
          console.log(`     - Hour: ${notif.metadata.hour || 'N/A'}`);
          console.log(`     - Distance: ${notif.metadata.distanceKm ? notif.metadata.distanceKm + ' km' : 'N/A'}`);
        }
      }
    } else {
      console.log('\n⚠️  No notifications created');
      console.log('   Checking possible reasons...\n');

      // Debug info
      console.log('   Debug Info:');
      console.log(`   - User ID: ${user._id}`);
      console.log(`   - Save ID: ${save._id}`);
      console.log(`   - Save Category: ${save.category}`);
      console.log(`   - Save Status: ${save.status}`);
      console.log(`   - Processing Status: ${save.processingStatus}`);
      console.log(`   - Day of Week: 5 (Friday)`);
      console.log(`   - Hour: 18 (6pm)`);
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Show in database
    const allNotifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`\n📈 Latest 5 notifications in DB for this user:`);
    if (allNotifications.length > 0) {
      allNotifications.forEach((n, i) => {
        console.log(`\n  ${i + 1}. ${n.type}`);
        console.log(`     Title: ${n.title}`);
        console.log(`     Created: ${n.createdAt}`);
        console.log(`     Status: ${n.status}`);
      });
    } else {
      console.log('  None found');
    }

    console.log('\n✅ Test complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runTest();
