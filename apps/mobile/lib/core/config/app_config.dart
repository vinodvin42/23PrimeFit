class AppConfig {
  static late final String apiBaseUrl;
  static late final bool authDevMode;
  static late final bool firebaseEnabled;
  static late final bool analyticsEnabled;
  static late final String sentryDsn;
  static late final bool wearableDemo;
  static late final bool streamClientEnabled;
  static late final bool agoraClientEnabled;
  static late final bool razorpayClientEnabled;

  static Future<void> init() async {
    const api = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://127.0.0.1:3001/api',
    );
    const dev = bool.fromEnvironment('AUTH_DEV_MODE', defaultValue: true);
    const firebase = bool.fromEnvironment(
      'FIREBASE_ENABLED',
      defaultValue: false,
    );
    const analytics = bool.fromEnvironment(
      'ANALYTICS_ENABLED',
      defaultValue: false,
    );
    const sentry = String.fromEnvironment('SENTRY_DSN', defaultValue: '');
    const wearable = bool.fromEnvironment(
      'WEARABLE_DEMO',
      defaultValue: true,
    );
    const streamClient = bool.fromEnvironment(
      'STREAM_CLIENT_ENABLED',
      defaultValue: false,
    );
    const agoraClient = bool.fromEnvironment(
      'AGORA_CLIENT_ENABLED',
      defaultValue: false,
    );
    const razorpayClient = bool.fromEnvironment(
      'RAZORPAY_CLIENT_ENABLED',
      defaultValue: false,
    );

    apiBaseUrl = api;
    authDevMode = dev;
    firebaseEnabled = firebase && !dev;
    analyticsEnabled = analytics;
    sentryDsn = sentry;
    wearableDemo = wearable;
    streamClientEnabled = streamClient;
    agoraClientEnabled = agoraClient;
    razorpayClientEnabled = razorpayClient;
  }
}
