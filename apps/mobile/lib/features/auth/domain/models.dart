class UserProfile {
  const UserProfile({
    required this.id,
    this.dateOfBirth,
    this.sex,
    this.heightCm,
    this.weightKg,
    this.goals = const [],
    this.lifestyleDisorders = const [],
    this.activityLevel,
    this.onboardingComplete = false,
  });

  final String id;
  final String? dateOfBirth;
  final String? sex;
  final double? heightCm;
  final double? weightKg;
  final List<String> goals;
  final List<String> lifestyleDisorders;
  final String? activityLevel;
  final bool onboardingComplete;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      dateOfBirth: json['dateOfBirth'] as String?,
      sex: json['sex'] as String?,
      heightCm: (json['heightCm'] as num?)?.toDouble(),
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      goals: (json['goals'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      lifestyleDisorders:
          (json['lifestyleDisorders'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      activityLevel: json['activityLevel'] as String?,
      onboardingComplete: json['onboardingComplete'] as bool? ?? false,
    );
  }
}

class AppUser {
  const AppUser({
    required this.id,
    required this.firebaseUid,
    this.email,
    this.displayName,
    required this.role,
    this.profile,
  });

  final String id;
  final String firebaseUid;
  final String? email;
  final String? displayName;
  final String role;
  final UserProfile? profile;

  bool get needsOnboarding => !(profile?.onboardingComplete ?? false);

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      firebaseUid: json['firebaseUid'] as String,
      email: json['email'] as String?,
      displayName: json['displayName'] as String?,
      role: json['role'] as String? ?? 'CLIENT',
      profile: json['profile'] is Map<String, dynamic>
          ? UserProfile.fromJson(json['profile'] as Map<String, dynamic>)
          : null,
    );
  }
}

class DashboardCard {
  const DashboardCard({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.status,
    required this.phase,
  });

  final String id;
  final String title;
  final String subtitle;
  final String status;
  final int phase;

  factory DashboardCard.fromJson(Map<String, dynamic> json) {
    return DashboardCard(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String,
      status: json['status'] as String? ?? 'placeholder',
      phase: json['phase'] as int? ?? 0,
    );
  }
}

class DashboardToday {
  const DashboardToday({
    required this.greeting,
    required this.date,
    required this.profileComplete,
    required this.cards,
    required this.goals,
    this.weightKg,
  });

  final String greeting;
  final String date;
  final bool profileComplete;
  final List<DashboardCard> cards;
  final List<String> goals;
  final double? weightKg;

  factory DashboardToday.fromJson(Map<String, dynamic> json) {
    return DashboardToday(
      greeting: json['greeting'] as String? ?? 'Hello',
      date: json['date'] as String? ?? '',
      profileComplete: json['profileComplete'] as bool? ?? false,
      cards: (json['cards'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(DashboardCard.fromJson)
          .toList(),
      goals: (json['goals'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      weightKg: (json['weightKg'] as num?)?.toDouble(),
    );
  }
}
