export type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  handicap: number;
  play_frequency: string;
  goal: string;
  onboarding_complete: boolean;
  created_at: string;
};

export type Round = {
  id: string;
  user_id: string;
  played_at: string;
  course_id: string | null;
  course_name: string | null;
  course_provider: string | null;
  provider_course_id: string | null;
  tee_key: string | null;
  tee_set_id: string | null;
  tee_name: string | null;
  tee_color: string | null;
  total_score: number;
  par: number;
  holes: 9 | 18;
  putts: number | null;
  gir: number | null;
  fairways_hit: number | null;
  fairways_total: number | null;
  penalties: number | null;
  notes: string | null;
  created_at: string;
};

export type RoundInsert = Omit<Round, 'id' | 'created_at'>;

export type RoundHole = {
  id: string;
  round_id: string;
  user_id: string;
  hole_number: number;
  par: number;
  score: number;
  putts: number | null;
  gir: boolean | null;
  fairway_hit: boolean | null;
  penalty: number;
  created_at: string;
};

export type RoundHoleInsert = Omit<RoundHole, 'id' | 'created_at'>;

export type RoundWithHoles = Round & {
  scorecard: RoundHole[];
};

export type RoundDraftHole = {
  hole_number: number;
  par: number;
  score: number;
  putts: number;
  gir: boolean;
  fairway_hit: boolean | null;
  penalty: number;
  completed: boolean;
};

export type RoundAggregate = {
  holes: 9 | 18;
  par: number;
  total_score: number;
  putts: number;
  gir: number;
  fairways_hit: number;
  fairways_total: number;
  penalties: number;
  front_nine_score: number;
  back_nine_score: number | null;
  front_nine_to_par: number;
  back_nine_to_par: number | null;
  average_putts_per_hole: number;
  gir_percentage: number;
  fairway_percentage: number | null;
  score_to_par: number;
};

export type Diagnostic = {
  id: string;
  user_id: string;
  round_id: string | null;
  strengths: string[];
  weaknesses: string[];
  weekly_plan: string;
  raw_analysis: string;
  recommended_categories: string[];
  created_at: string;
};

export type Drill = {
  id: string;
  title: string;
  description: string;
  youtube_url: string | null;
  category: 'putting' | 'short_game' | 'approach' | 'driving' | 'mental';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
};

export type OnboardingData = {
  display_name: string;
  handicap: number;
  play_frequency: string;
  goal: string;
};
