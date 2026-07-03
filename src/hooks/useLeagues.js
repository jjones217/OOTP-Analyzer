import { useEffect, useState } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '../firebase';

const LEAGUES_PATH = 'leagues';

export function useLeagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const leaguesRef = ref(db, LEAGUES_PATH);
    const unsub = onValue(leaguesRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        setLeagues([]);
      } else {
        setLeagues(
          Object.entries(val).map(([id, data]) => ({ id, ...data }))
        );
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function addLeague(leagueData) {
    const leaguesRef = ref(db, LEAGUES_PATH);
    await push(leaguesRef, leagueData);
  }

  async function updateLeague(id, patch) {
    const leagueRef = ref(db, `${LEAGUES_PATH}/${id}`);
    await update(leagueRef, patch);
  }

  async function removeLeague(id) {
    const leagueRef = ref(db, `${LEAGUES_PATH}/${id}`);
    await remove(leagueRef);
  }

  return { leagues, loading, addLeague, updateLeague, removeLeague };
}
