import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/analytics/analytics.dart';
import 'package:primefit_mobile/core/network/api_client.dart';
import 'package:primefit_mobile/core/offline/offline_outbox.dart';
import 'package:primefit_mobile/features/workouts/domain/workout_models.dart';

final fitnessRepositoryProvider = Provider<FitnessRepository>((ref) {
  return FitnessRepository(ref.watch(dioProvider));
});

class FoodSearchItem {
  const FoodSearchItem({
    required this.id,
    required this.name,
    required this.calories,
    required this.proteinG,
    required this.carbsG,
    required this.fatG,
    required this.servingLabel,
    this.brand,
    this.imageUrl,
    this.source,
    this.barcode,
  });

  final String id;
  final String name;
  final double calories;
  final double proteinG;
  final double carbsG;
  final double fatG;
  final String servingLabel;
  final String? brand;
  final String? imageUrl;
  final String? source;
  final String? barcode;

  factory FoodSearchItem.fromJson(Map<String, dynamic> json) {
    return FoodSearchItem(
      id: json['id'] as String,
      name: json['name'] as String,
      calories: (json['calories'] as num?)?.toDouble() ?? 0,
      proteinG: (json['proteinG'] as num?)?.toDouble() ?? 0,
      carbsG: (json['carbsG'] as num?)?.toDouble() ?? 0,
      fatG: (json['fatG'] as num?)?.toDouble() ?? 0,
      servingLabel: json['servingLabel'] as String? ?? 'serving',
      brand: json['brand'] as String?,
      imageUrl: json['imageUrl'] as String?,
      source: json['source'] as String?,
      barcode: json['barcode'] as String?,
    );
  }
}

class RecipeItem {
  const RecipeItem({
    required this.slug,
    required this.title,
    required this.summary,
    required this.calories,
    required this.proteinG,
    required this.prepMin,
    required this.cookMin,
    this.tags = const [],
    this.ingredients = const [],
    this.instructions = const [],
  });

  final String slug;
  final String title;
  final String summary;
  final double calories;
  final double proteinG;
  final int prepMin;
  final int cookMin;
  final List<String> tags;
  final List<String> ingredients;
  final List<String> instructions;

  factory RecipeItem.fromJson(Map<String, dynamic> json) {
    return RecipeItem(
      slug: json['slug'] as String,
      title: json['title'] as String,
      summary: json['summary'] as String? ?? '',
      calories: (json['calories'] as num?)?.toDouble() ?? 0,
      proteinG: (json['proteinG'] as num?)?.toDouble() ?? 0,
      prepMin: json['prepMin'] as int? ?? 0,
      cookMin: json['cookMin'] as int? ?? 0,
      tags: (json['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      ingredients:
          (json['ingredients'] as List?)?.map((e) => '$e').toList() ??
              const [],
      instructions:
          (json['instructions'] as List?)?.map((e) => '$e').toList() ??
              const [],
    );
  }
}

class MealPlanSummary {
  const MealPlanSummary({
    required this.slug,
    required this.title,
    required this.description,
    required this.dailyKcal,
  });

  final String slug;
  final String title;
  final String description;
  final int dailyKcal;

  factory MealPlanSummary.fromJson(Map<String, dynamic> json) {
    return MealPlanSummary(
      slug: json['slug'] as String,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      dailyKcal: json['dailyKcal'] as int? ?? 2000,
    );
  }
}

class FitnessRepository {
  FitnessRepository(this._dio);

  final Dio _dio;

  Future<MyWorkouts> myWorkouts() async {
    final res = await _dio.get<Map<String, dynamic>>('/workouts/mine');
    return MyWorkouts.fromJson(res.data!);
  }

  Future<SessionDetail> session(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/workouts/sessions/$id');
    return SessionDetail.fromJson(res.data!);
  }

  Future<void> startSession(String id) async {
    await _dio.post('/workouts/sessions/$id/start');
  }

  Future<void> addFoodLog({
    required String foodItemId,
    required String mealType,
    double servings = 1,
    OfflineOutbox? outbox,
  }) async {
    final body = {
      'foodItemId': foodItemId,
      'mealType': mealType,
      'servings': servings,
    };
    try {
      await _dio.post('/nutrition/logs', data: body);
      await Analytics.foodLogged();
      if (outbox != null) await outbox.flush();
    } on DioException catch (e) {
      if (outbox != null &&
          (e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout)) {
        await outbox.enqueue(
          type: 'nutrition_log',
          path: '/nutrition/logs',
          body: body,
        );
        return;
      }
      rethrow;
    }
  }

  /// Sends a food-photo recognition result. Callers may supply edited macros
  /// before saving; the backend also returns a rules-based fallback result.
  Future<Map<String, dynamic>> logMealFromPhoto({
    String? imageUrl,
    String? hint,
    String? recognizedName,
    double? calories,
    double? proteinG,
    double? carbsG,
    double? fatG,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/vision/food',
      data: {
        if (imageUrl != null) 'imageUrl': imageUrl,
        if (hint != null) 'hint': hint,
        if (recognizedName != null) 'recognizedName': recognizedName,
        if (calories != null) 'calories': calories,
        if (proteinG != null) 'proteinG': proteinG,
        if (carbsG != null) 'carbsG': carbsG,
        if (fatG != null) 'fatG': fatG,
      },
    );
    return response.data ?? const {};
  }

  Future<void> completeSession(
    String id, {
    int perceivedEffort = 7,
    String? notes,
    OfflineOutbox? outbox,
  }) async {
    final body = <String, dynamic>{
      'perceivedEffort': perceivedEffort,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };
    try {
      await _dio.post('/workouts/sessions/$id/complete', data: body);
      await Analytics.firstWorkout();
      if (outbox != null) await outbox.flush();
    } on DioException catch (e) {
      if (outbox != null &&
          (e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout)) {
        await outbox.enqueue(
          type: 'workout_complete',
          path: '/workouts/sessions/$id/complete',
          body: body,
        );
        return;
      }
      rethrow;
    }
  }

  Future<void> assignProgram(String slug) async {
    await _dio.post('/workouts/assign/$slug');
  }

  Future<List<ExerciseItem>> searchExercises(String q) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/exercises',
      queryParameters: {'q': q, 'limit': 30},
    );
    final items = res.data?['items'] as List? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(ExerciseItem.fromJson)
        .toList();
  }

  Future<NutritionToday> nutritionToday() async {
    final res = await _dio.get<Map<String, dynamic>>('/nutrition/today');
    return NutritionToday.fromJson(res.data!);
  }

  Future<List<FoodSearchItem>> searchFoods(String q) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/nutrition/search',
      queryParameters: {'q': q},
    );
    final items = res.data?['items'] as List? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(FoodSearchItem.fromJson)
        .toList();
  }

  Future<FoodSearchItem> lookupBarcode(String code) async {
    final res = await _dio.get<Map<String, dynamic>>('/nutrition/barcode/$code');
    return FoodSearchItem.fromJson(res.data!);
  }

  Future<void> deleteFoodLog(String id) async {
    await _dio.delete('/nutrition/logs/$id');
  }

  Future<HydrationToday> hydrationToday() async {
    final res = await _dio.get<Map<String, dynamic>>('/nutrition/hydration/today');
    return HydrationToday.fromJson(res.data!);
  }

  Future<void> logHydration(int amountMl) async {
    await _dio.post<Map<String, dynamic>>(
      '/nutrition/hydration',
      data: {'amountMl': amountMl},
    );
  }

  Future<List<Map<String, dynamic>>> listSupplements() async {
    final res = await _dio.get<List<dynamic>>('/nutrition/supplements');
    return (res.data ?? []).whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> createSupplement({
    required String name,
    String? dosage,
    String? schedule,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/nutrition/supplements',
      data: {
        'name': name,
        if (dosage != null && dosage.isNotEmpty) 'dosage': dosage,
        if (schedule != null && schedule.isNotEmpty) 'schedule': schedule,
      },
    );
    return res.data!;
  }

  Future<void> deactivateSupplement(String id) async {
    await _dio.patch<Map<String, dynamic>>(
      '/nutrition/supplements/$id/deactivate',
    );
  }

  Future<void> logSupplementTaken(String id) async {
    await _dio.post<Map<String, dynamic>>('/nutrition/supplements/$id/log');
  }

  Future<void> unlogSupplementTaken(String id) async {
    await _dio.delete('/nutrition/supplements/$id/log');
  }

  Future<List<RecipeItem>> listRecipes([String? q]) async {
    final res = await _dio.get<List<dynamic>>(
      '/nutrition/recipes',
      queryParameters: q == null || q.isEmpty ? null : {'q': q},
    );
    return (res.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(RecipeItem.fromJson)
        .toList();
  }

  Future<List<MealPlanSummary>> listMealPlans() async {
    final res = await _dio.get<List<dynamic>>('/nutrition/meal-plans');
    return (res.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(MealPlanSummary.fromJson)
        .toList();
  }

  Future<void> assignMealPlan(String slug) async {
    await _dio.post('/nutrition/meal-plans/$slug/assign');
  }

  Future<RecoveryToday> recoveryToday() async {
    final res = await _dio.get<Map<String, dynamic>>('/recovery/today');
    return RecoveryToday.fromJson(res.data!);
  }

  Future<List<RecoveryHistoryPoint>> recoveryHistory({int days = 7}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/recovery/history',
      queryParameters: {'days': days},
    );
    final items = res.data?['items'] as List? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(RecoveryHistoryPoint.fromJson)
        .toList();
  }

  Future<RecoveryToday> syncWearableDemo({String provider = 'health_connect'}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/recovery/sync/demo',
      data: {'provider': provider},
    );
    return RecoveryToday.fromJson(res.data!);
  }

  Future<RecoveryToday> syncWearableNative(Map<String, dynamic> payload) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/recovery/sync',
      data: payload,
    );
    return RecoveryToday.fromJson(res.data!);
  }

  Future<Map<String, dynamic>> startWearableOauth(String provider) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/recovery/oauth/$provider/start',
    );
    return res.data ?? {};
  }

  Future<Map<String, dynamic>> completeWearableOauth(
    String provider, {
    String? code,
    String? state,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/recovery/oauth/$provider/complete',
      data: {'code': code, 'state': state},
    );
    return res.data ?? {};
  }

  Future<Map<String, dynamic>> ensureChatThread() async {
    final res = await _dio.post<Map<String, dynamic>>('/chat/threads', data: {});
    return res.data!;
  }

  Future<List<Map<String, dynamic>>> chatMessages(String threadId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/chat/threads/$threadId/messages',
    );
    return (res.data?['messages'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<Map<String, dynamic>> sendChatMessage(
    String threadId,
    String body,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/chat/threads/$threadId/messages',
      data: {'body': body},
    );
    return res.data!;
  }

  Future<List<Map<String, dynamic>>> listConsultations() async {
    final res = await _dio.get<List<dynamic>>('/consultations');
    return (res.data ?? []).whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> bookConsultation({
    required String topic,
    required String scheduledAt,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/consultations',
      data: {
        'topic': topic,
        'scheduledAt': scheduledAt,
        'amountInr': 999,
      },
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> payConsultation(String id) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/consultations/$id/pay',
    );
    return res.data!;
  }

  Future<List<Map<String, dynamic>>> listNotifications() async {
    final res = await _dio.get<List<dynamic>>('/notifications');
    return (res.data ?? []).whereType<Map<String, dynamic>>().toList();
  }

  Future<List<Map<String, dynamic>>> listChallenges() async {
    final res = await _dio.get<List<dynamic>>('/community/challenges');
    return (res.data ?? []).whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> joinChallenge(String id) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/community/challenges/$id/join',
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> logChallengeProgress(
    String id,
    int delta,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/community/challenges/$id/progress',
      data: {'delta': delta},
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> challengeLeaderboard(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/community/challenges/$id/leaderboard',
    );
    return res.data!;
  }

  Future<List<Map<String, dynamic>>> listAchievements() async {
    final res = await _dio.get<List<dynamic>>('/community/achievements');
    return (res.data ?? []).whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> communityStreak() async {
    final res = await _dio.get<Map<String, dynamic>>('/community/streak');
    return res.data!;
  }

  Future<Map<String, dynamic>> aiDashboard() async {
    final res = await _dio.get<Map<String, dynamic>>('/ai/dashboard');
    return res.data!;
  }

  Future<Map<String, dynamic>> generateAiInsights() async {
    final res = await _dio.post<Map<String, dynamic>>('/ai/insights/generate');
    return res.data!;
  }

  Future<Map<String, dynamic>> calculateBiologicalAge() async {
    final res = await _dio.post<Map<String, dynamic>>('/ai/biological-age');
    return res.data!;
  }

  Future<Map<String, dynamic>> intelligenceToday() async {
    final res = await _dio.get<Map<String, dynamic>>('/intelligence/today');
    return res.data!;
  }

  Future<Map<String, dynamic>> runIntelligence() async {
    final res = await _dio.post<Map<String, dynamic>>('/intelligence/run');
    return res.data!;
  }

  Future<Map<String, dynamic>> createOutcomeLabel({
    required String kind,
    String? note,
    String? userId,
    String? dateKey,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/intelligence/outcomes',
      data: {
        'kind': kind,
        if (note != null) 'note': note,
        if (userId != null) 'userId': userId,
        if (dateKey != null) 'dateKey': dateKey,
      },
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> cricketDashboard() async {
    final res = await _dio.get<Map<String, dynamic>>('/cricket/dashboard');
    return res.data!;
  }

  Future<Map<String, dynamic>> upsertCricketProfile(
    Map<String, dynamic> body,
  ) async {
    final res = await _dio.put<Map<String, dynamic>>(
      '/cricket/profile',
      data: body,
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> logCricketSession(
    Map<String, dynamic> body,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/cricket/sessions',
      data: body,
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> cricketLoad() async {
    final res = await _dio.get<Map<String, dynamic>>('/cricket/load');
    return res.data!;
  }

  Future<Map<String, dynamic>> femaleHealthToday() async {
    final res = await _dio.get<Map<String, dynamic>>('/female-health/today');
    return res.data!;
  }

  Future<Map<String, dynamic>> healthspanToday() async {
    final res = await _dio.get<Map<String, dynamic>>('/healthspan/today');
    return res.data!;
  }

  Future<void> setConsent(String purpose, bool granted) async {
    await _dio.put(
      '/consent',
      data: {'purpose': purpose, 'granted': granted},
    );
  }

  Future<List<Map<String, dynamic>>> listBloodReports() async {
    final res = await _dio.get<List<dynamic>>('/ai/blood-reports');
    return (res.data ?? []).whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> uploadBloodReport({
    required String fileName,
    String? title,
    Map<String, num>? markers,
    String? imageBase64,
    String? mimeType,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/ai/blood-reports',
      data: {
        'fileName': fileName,
        if (title != null) 'title': title,
        if (markers != null) 'markers': markers,
        if (imageBase64 != null) 'imageBase64': imageBase64,
        if (mimeType != null) 'mimeType': mimeType,
      },
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> searchRemoteRecipes([String q = '']) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/nutrition/recipes-remote',
      queryParameters: {'q': q},
    );
    return res.data ?? {'items': [], 'source': 'unavailable'};
  }

  Future<Map<String, dynamic>> importRemoteRecipe(
    Map<String, dynamic> recipe,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/nutrition/recipes-remote/import',
      data: recipe,
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> consultationMeeting(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/consultations/$id/meeting',
    );
    return res.data!;
  }

  Future<Map<String, dynamic>> confirmConsultationPayment(
    String id, {
    String? razorpayOrderId,
    String? razorpayPaymentId,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/consultations/$id/confirm-payment',
      data: {
        if (razorpayOrderId != null) 'razorpayOrderId': razorpayOrderId,
        if (razorpayPaymentId != null) 'razorpayPaymentId': razorpayPaymentId,
      },
    );
    return res.data!;
  }

  Future<List<Map<String, dynamic>>> listProgressPhotos() async {
    final res = await _dio.get<List<dynamic>>('/progress/photos');
    return (res.data ?? []).whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> createProgressPhoto({
    String pose = 'front',
    String? caption,
    double? weightKg,
    String? imageBase64,
    String? contentType,
    String? fileName,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/progress/photos',
      data: {
        'pose': pose,
        if (caption != null) 'caption': caption,
        if (weightKg != null) 'weightKg': weightKg,
        if (imageBase64 != null) 'imageBase64': imageBase64,
        if (contentType != null) 'contentType': contentType,
        if (fileName != null) 'fileName': fileName,
      },
    );
    return res.data!;
  }

  Future<void> deleteProgressPhoto(String id) async {
    await _dio.delete('/progress/photos/$id');
  }
}

final progressPhotosProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(fitnessRepositoryProvider).listProgressPhotos();
});

final myWorkoutsProvider = FutureProvider.autoDispose<MyWorkouts>((ref) {
  return ref.watch(fitnessRepositoryProvider).myWorkouts();
});

final nutritionTodayProvider =
    FutureProvider.autoDispose<NutritionToday>((ref) {
  return ref.watch(fitnessRepositoryProvider).nutritionToday();
});

final hydrationTodayProvider =
    FutureProvider.autoDispose<HydrationToday>((ref) {
  return ref.watch(fitnessRepositoryProvider).hydrationToday();
});

final supplementsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(fitnessRepositoryProvider).listSupplements();
});

final recoveryTodayProvider = FutureProvider.autoDispose<RecoveryToday>((ref) {
  return ref.watch(fitnessRepositoryProvider).recoveryToday();
});

final recoveryHistoryProvider =
    FutureProvider.autoDispose<List<RecoveryHistoryPoint>>((ref) {
  return ref.watch(fitnessRepositoryProvider).recoveryHistory();
});

final recipesProvider = FutureProvider.autoDispose<List<RecipeItem>>((ref) {
  return ref.watch(fitnessRepositoryProvider).listRecipes();
});

final mealPlansProvider =
    FutureProvider.autoDispose<List<MealPlanSummary>>((ref) {
  return ref.watch(fitnessRepositoryProvider).listMealPlans();
});

final intelligenceTodayProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(fitnessRepositoryProvider).intelligenceToday();
});

final cricketDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(fitnessRepositoryProvider).cricketDashboard();
});

final femaleHealthTodayProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(fitnessRepositoryProvider).femaleHealthToday();
});

final healthspanTodayProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(fitnessRepositoryProvider).healthspanToday();
});
