import type { Profile, Round, RoundDraftHole } from '../types';

export type DiagnosticResult = {
  strengths: string[];
  weaknesses: string[];
  weekly_plan: string;
  raw_analysis: string;
  recommended_categories: string[];
};

export type DebriefHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AnalyzeRoundRequest = {
  action: 'analyze_round';
  round: Round;
  profile: Profile;
  previousRounds: Round[];
  scorecard?: RoundDraftHole[];
};

export type AnalyzeRoundResponse = {
  result: DiagnosticResult;
};

export type PostRoundDebriefRequest = {
  action: 'post_round_debrief';
  round: Round;
  profile: Profile;
  userMessage: string;
  history: DebriefHistoryMessage[];
};

export type PostRoundDebriefResponse = {
  reply: string;
};
