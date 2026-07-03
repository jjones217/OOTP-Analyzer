import { useEffect, useState, useCallback } from 'react';
import { fetchLeagueSummary, fetchMyTeamBatStats, fetchMyTeamPitchStats } from '../api/statsplus';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function useLeagueData(league) {
  const [data, setData] = useState(null);
  const [batStats, setBatStats] = useState(null);
  const [pitchStats, setPitchStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    if (!league?.lgurl) return;
    setLoading(true);
    setError(null);
    try {
      const [summary, bat, pitch] = await Promise.all([
        fetchLeagueSummary(league.lgurl, league.myTeamId, league.token),
        fetchMyTeamBatStats(league.lgurl, league.myTeamId),
        fetchMyTeamPitchStats(league.lgurl, league.myTeamId),
      ]);
      setData(summary);
      setBatStats(bat);
      setPitchStats(pitch);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message ?? 'Failed to load league data');
    } finally {
      setLoading(false);
    }
  }, [league?.lgurl, league?.myTeamId, league?.token]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { data, batStats, pitchStats, loading, error, lastUpdated, refresh };
}
