export interface VolumeResult {
  totalVolume: string | null;
  totalFees: string | null;
}

export interface MonthlyVolumeResult {
  volume: string | null;
}

export interface TypeBreakdownRow {
  type: string;
  count: string;
  volume: string | null;
}

export interface DailyVolumeRow {
  date: string;
  count: string;
  volume: string;
}

export interface UserGrowthRow {
  date: string;
  count: string;
}
