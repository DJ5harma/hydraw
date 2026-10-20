import { Mark } from "./components/icons.tsx";
import { useBoardSession } from "./features/board/useBoardSession.ts";
import { Workspace } from "./features/editor/Workspace.tsx";

export function App() {
  const { session, error } = useBoardSession();
  if (error)
    return (
      <div className="loading" role="alert">
        <Mark />
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reload canvas</button>
      </div>
    );
  if (!session)
    return (
      <div className="loading">
        <Mark />
        <p>Opening your canvas…</p>
      </div>
    );
  return <Workspace session={session} />;
}
