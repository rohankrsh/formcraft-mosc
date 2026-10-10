import { useStore } from 'zustand';
import { useFormStore } from './useFormStore';

export const useTemporalStore = () => {
  const temporal = useFormStore.temporal;
  const pastStates = useStore(temporal, (s) => s.pastStates);
  const futureStates = useStore(temporal, (s) => s.futureStates);

  return {
    undo: temporal.getState().undo,
    redo: temporal.getState().redo,
    clear: temporal.getState().clear,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
    pastCount: pastStates.length,
    futureCount: futureStates.length,
  };
};
