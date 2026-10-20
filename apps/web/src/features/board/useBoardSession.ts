import { useEffect, useState } from "react";
import { openBoardSession } from "./session.ts";
import type { BoardSession } from "./session.ts";

type SessionState = { session: BoardSession | null; error: string | null };

export function useBoardSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    let local: BoardSession | null = null;
    void openBoardSession(controller.signal).then(
      (session) => {
        if (controller.signal.aborted) {
          session.storage?.close();
          return;
        }
        local = session;
        setState({ session, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            session: null,
            error: error instanceof Error ? error.message : "The canvas could not be opened.",
          });
      },
    );
    return () => {
      controller.abort();
      local?.storage?.close();
    };
  }, []);
  return state;
}
