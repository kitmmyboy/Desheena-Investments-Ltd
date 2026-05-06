import 'dart:io';
import 'package:pushy_flutter/pushy_flutter.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    // 1. Initialize Pushy
    Pushy.listen();

    // 2. Initialize local notifications for foreground display
    const androidSettings =
        AndroidInitializationSettings('@drawable/splash');
    const iosSettings = DarwinInitializationSettings(
      requestSoundPermission: true,
      requestBadgePermission: true,
      requestAlertPermission: true,
    );
    
    await _localNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
    );

    // 3. Create a high-importance notification channel for Android (required for sound)
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'collection_reminders',
        'Collection Reminders',
        description: 'Notifications for upcoming waste collections',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }

    // 4. Handle incoming notifications
    Pushy.setNotificationListener((Map<String, dynamic> data) async {
      String title = data['title'] ?? 'Desheena Waste';
      String message = data['message'] ?? 'New notification';
      
      _showLocalNotification(title, message);
    });
  }

  static Future<void> _showLocalNotification(String title, String message) async {
    await _localNotifications.show(
      DateTime.now().millisecond,
      title,
      message,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'collection_reminders',
          'Collection Reminders',
          channelDescription: 'Notifications for upcoming waste collections',
          importance: Importance.max,
          priority: Priority.high,
          playSound: true,
        ),
        iOS: DarwinNotificationDetails(
          presentSound: true,
          presentAlert: true,
          presentBadge: true,
        ),
      ),
    );
  }

  static Future<void> registerDeviceToken() async {
    try {
      // Register for Pushy token
      final token = await Pushy.register();
      final user = Supabase.instance.client.auth.currentUser;

      if (token != null && user != null) {
        // Upsert token to fcm_tokens table (we can still use this table for Pushy tokens)
        await Supabase.instance.client.from('fcm_tokens').upsert({
          'user_id': user.id,
          'token': token,
          'device_type': Platform.isAndroid ? 'android' : 'ios',
          'last_seen': DateTime.now().toIso8601String(),
        });
        debugPrint('Pushy device token: $token');
      }
    } catch (e) {
      debugPrint('Error registering Pushy token: $e');
    }
  }
}
