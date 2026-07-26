class ExerciseItem {
  const ExerciseItem({
    required this.id,
    required this.name,
    this.equipment,
    this.level,
    this.category,
    this.primaryMuscles = const [],
    this.instructions = const [],
    this.imageUrls = const [],
    this.videoUrls = const [],
  });

  final String id;
  final String name;
  final String? equipment;
  final String? level;
  final String? category;
  final List<String> primaryMuscles;
  final List<String> instructions;
  final List<String> imageUrls;
  final List<String> videoUrls;

  factory ExerciseItem.fromJson(Map<String, dynamic> json) {
    return ExerciseItem(
      id: json['id'] as String,
      name: json['name'] as String,
      equipment: json['equipment'] as String?,
      level: json['level'] as String?,
      category: json['category'] as String?,
      primaryMuscles:
          (json['primaryMuscles'] as List?)?.map((e) => '$e').toList() ??
              const [],
      instructions:
          (json['instructions'] as List?)?.map((e) => '$e').toList() ??
              const [],
      imageUrls:
          (json['imageUrls'] as List?)?.map((e) => '$e').toList() ?? const [],
      videoUrls:
          (json['videoUrls'] as List?)?.map((e) => '$e').toList() ?? const [],
    );
  }
}

class ProgramSummary {
  const ProgramSummary({
    required this.id,
    required this.slug,
    required this.title,
    required this.description,
    required this.level,
    required this.durationMin,
    required this.daysPerWeek,
    this.goalTags = const [],
  });

  final String id;
  final String slug;
  final String title;
  final String description;
  final String level;
  final int durationMin;
  final int daysPerWeek;
  final List<String> goalTags;

  factory ProgramSummary.fromJson(Map<String, dynamic> json) {
    return ProgramSummary(
      id: json['id'] as String,
      slug: json['slug'] as String,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      level: json['level'] as String? ?? 'beginner',
      durationMin: json['durationMin'] as int? ?? 40,
      daysPerWeek: json['daysPerWeek'] as int? ?? 3,
      goalTags:
          (json['goalTags'] as List?)?.map((e) => '$e').toList() ?? const [],
    );
  }
}

class WorkoutSessionSummary {
  const WorkoutSessionSummary({
    required this.id,
    required this.title,
    required this.status,
    required this.dayIndex,
    this.scheduledFor,
  });

  final String id;
  final String title;
  final String status;
  final int dayIndex;
  final String? scheduledFor;

  factory WorkoutSessionSummary.fromJson(Map<String, dynamic> json) {
    return WorkoutSessionSummary(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String? ?? 'PLANNED',
      dayIndex: json['dayIndex'] as int? ?? 0,
      scheduledFor: json['scheduledFor'] as String?,
    );
  }
}

class MyWorkouts {
  const MyWorkouts({
    required this.sessions,
    required this.catalog,
    this.todaySession,
    this.activeProgramTitle,
  });

  final List<WorkoutSessionSummary> sessions;
  final List<ProgramSummary> catalog;
  final WorkoutSessionSummary? todaySession;
  final String? activeProgramTitle;

  factory MyWorkouts.fromJson(Map<String, dynamic> json) {
    final assignments = json['assignments'] as List? ?? [];
    String? programTitle;
    if (assignments.isNotEmpty) {
      final first = assignments.first;
      if (first is Map && first['program'] is Map) {
        programTitle = (first['program'] as Map)['title'] as String?;
      }
    }
    return MyWorkouts(
      sessions: (json['sessions'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(WorkoutSessionSummary.fromJson)
          .toList(),
      catalog: (json['catalog'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ProgramSummary.fromJson)
          .toList(),
      todaySession: json['todaySession'] is Map<String, dynamic>
          ? WorkoutSessionSummary.fromJson(
              json['todaySession'] as Map<String, dynamic>,
            )
          : null,
      activeProgramTitle: programTitle,
    );
  }
}

class SessionExercise {
  const SessionExercise({
    required this.sets,
    required this.reps,
    required this.restSec,
    required this.exercise,
  });

  final int sets;
  final String reps;
  final int restSec;
  final ExerciseItem exercise;

  factory SessionExercise.fromJson(Map<String, dynamic> json) {
    return SessionExercise(
      sets: json['sets'] as int? ?? 3,
      reps: '${json['reps'] ?? '8-12'}',
      restSec: json['restSec'] as int? ?? 60,
      exercise: ExerciseItem.fromJson(
        json['exercise'] as Map<String, dynamic>,
      ),
    );
  }
}

class SessionDetail {
  const SessionDetail({
    required this.id,
    required this.title,
    required this.status,
    required this.exercises,
  });

  final String id;
  final String title;
  final String status;
  final List<SessionExercise> exercises;

  factory SessionDetail.fromJson(Map<String, dynamic> json) {
    return SessionDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String? ?? 'PLANNED',
      exercises: (json['exercises'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(SessionExercise.fromJson)
          .toList(),
    );
  }
}

class NutritionToday {
  const NutritionToday({
    required this.calories,
    required this.proteinG,
    required this.carbsG,
    required this.fatG,
    required this.targetCalories,
    required this.logs,
  });

  final double calories;
  final double proteinG;
  final double carbsG;
  final double fatG;
  final double targetCalories;
  final List<NutritionLogItem> logs;

  factory NutritionToday.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'] as Map<String, dynamic>? ?? {};
    final target = json['target'] as Map<String, dynamic>? ?? {};
    return NutritionToday(
      calories: (totals['calories'] as num?)?.toDouble() ?? 0,
      proteinG: (totals['proteinG'] as num?)?.toDouble() ?? 0,
      carbsG: (totals['carbsG'] as num?)?.toDouble() ?? 0,
      fatG: (totals['fatG'] as num?)?.toDouble() ?? 0,
      targetCalories: (target['calories'] as num?)?.toDouble() ?? 2000,
      logs: (json['logs'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(NutritionLogItem.fromJson)
          .toList(),
    );
  }
}

class NutritionLogItem {
  const NutritionLogItem({
    required this.id,
    required this.mealType,
    required this.name,
    required this.calories,
    required this.servings,
  });

  final String id;
  final String mealType;
  final String name;
  final double calories;
  final double servings;

  factory NutritionLogItem.fromJson(Map<String, dynamic> json) {
    final food = json['food'] as Map<String, dynamic>? ?? {};
    final servings = (json['servings'] as num?)?.toDouble() ?? 1;
    return NutritionLogItem(
      id: json['id'] as String? ?? '',
      mealType: json['mealType'] as String? ?? 'meal',
      name: food['name'] as String? ?? 'Food',
      calories: ((food['calories'] as num?)?.toDouble() ?? 0) * servings,
      servings: servings,
    );
  }
}

class RecoveryToday {
  const RecoveryToday({
    this.sleepHours,
    this.stressScore,
    this.steps,
    this.restingHr,
    this.activeKcal,
    this.hrvMs,
    this.vo2Max,
    this.spo2,
    this.trainingLoad,
    this.recoveryScore,
    this.source,
    this.insights = const [],
    this.providers = const [],
  });

  final double? sleepHours;
  final int? stressScore;
  final int? steps;
  final int? restingHr;
  final int? activeKcal;
  final int? hrvMs;
  final double? vo2Max;
  final double? spo2;
  final double? trainingLoad;
  final int? recoveryScore;
  final String? source;
  final List<String> insights;
  final List<WearableProvider> providers;

  factory RecoveryToday.fromJson(Map<String, dynamic> json) {
    return RecoveryToday(
      sleepHours: (json['sleepHours'] as num?)?.toDouble(),
      stressScore: json['stressScore'] as int?,
      steps: json['steps'] as int?,
      restingHr: json['restingHr'] as int?,
      activeKcal: json['activeKcal'] as int?,
      hrvMs: json['hrvMs'] as int?,
      vo2Max: (json['vo2Max'] as num?)?.toDouble(),
      spo2: (json['spo2'] as num?)?.toDouble(),
      trainingLoad: (json['trainingLoad'] as num?)?.toDouble(),
      recoveryScore: json['recoveryScore'] as int?,
      source: json['source'] as String?,
      insights:
          (json['insights'] as List?)?.map((e) => '$e').toList() ?? const [],
      providers: (json['providers'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(WearableProvider.fromJson)
          .toList(),
    );
  }
}

class WearableProvider {
  const WearableProvider({
    required this.id,
    required this.label,
    this.status,
  });

  final String id;
  final String label;
  final String? status;

  factory WearableProvider.fromJson(Map<String, dynamic> json) {
    return WearableProvider(
      id: json['id'] as String,
      label: json['label'] as String,
      status: json['status'] as String?,
    );
  }
}

class RecoveryHistoryPoint {
  const RecoveryHistoryPoint({
    required this.dateKey,
    this.sleepHours,
    this.steps,
    this.hrvMs,
    this.recoveryScore,
    this.stressScore,
  });

  final String dateKey;
  final double? sleepHours;
  final int? steps;
  final int? hrvMs;
  final int? recoveryScore;
  final int? stressScore;

  factory RecoveryHistoryPoint.fromJson(Map<String, dynamic> json) {
    return RecoveryHistoryPoint(
      dateKey: json['dateKey'] as String,
      sleepHours: (json['sleepHours'] as num?)?.toDouble(),
      steps: json['steps'] as int?,
      hrvMs: json['hrvMs'] as int?,
      recoveryScore: json['recoveryScore'] as int?,
      stressScore: json['stressScore'] as int?,
    );
  }
}
