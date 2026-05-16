import { createContext, useContext, useState, useCallback, useRef } from 'react';

const NovaContext = createContext(null);

export function NovaProvider({ children }) {
  const [screenContext, setScreenContext] = useState({ screen: 'home' });
  const actionHandlerRef = useRef(null);

  const updateContext = useCallback((ctx) => {
    setScreenContext((prev) => ({ ...prev, ...ctx }));
  }, []);

  // Pages register a handler; Nova calls it when an action fires.
  // Returns an unregister function for use in useEffect cleanup.
  const registerActionHandler = useCallback((fn) => {
    actionHandlerRef.current = fn;
    return () => {
      if (actionHandlerRef.current === fn) actionHandlerRef.current = null;
    };
  }, []);

  const dispatchAction = useCallback((action) => {
    actionHandlerRef.current?.(action);
  }, []);

  return (
    <NovaContext.Provider value={{ screenContext, updateContext, registerActionHandler, dispatchAction }}>
      {children}
    </NovaContext.Provider>
  );
}

export function useNova() {
  return useContext(NovaContext);
}
