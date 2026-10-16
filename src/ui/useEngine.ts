import { useCallback, useEffect, useState } from 'react';
import { getFfmpegInfo, getQueueState, listenQueue, type FfmpegInfo, type JobState } from '../services/native';
export function useEngine() {
  const [info, setInfo] = useState<FfmpegInfo | null>(null),
    [jobs, setJobs] = useState<JobState[]>([]),
    [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [health, queue] = await Promise.all([getFfmpegInfo(), getQueueState()]);
      setInfo(health);
      setJobs(queue);
      setError('');
    } catch (reason) {
      setError(String(reason));
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    void refresh();
    void listenQueue((queue) => {
      if (mounted) setJobs(queue);
    })
      .then((stop) => {
        if (mounted) unsubscribe = stop;
        else stop();
      })
      .catch((reason) => setError(String(reason)));
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [refresh]);
  return { info, jobs, error, refresh };
}
export type EngineState = ReturnType<typeof useEngine>;
