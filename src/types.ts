export interface GoalScorer {
  scorer: string;
  time: string;
  isPenalty: boolean;
}

export interface TeamDetails {
  goals: GoalScorer[];
  possession: string;
  shots: {
    offTarget: string;
    onTarget: string;
  };
  totalPasses: string;
}

export interface MatchDetails {
  home: TeamDetails;
  away: TeamDetails;
}

export const initialMatchDetails: MatchDetails = {
  home: {
    goals: [],
    possession: '',
    shots: {
      offTarget: '',
      onTarget: '',
    },
    totalPasses: '',
  },
  away: {
    goals: [],
    possession: '',
    shots: {
      offTarget: '',
      onTarget: '',
    },
    totalPasses: '',
  },
};
