import { Mark } from "./components/icons.tsx";
import { useBoardSession } from "./features/board/useBoardSession.ts";
import { Workspace } from "./features/editor/Workspace.tsx";

export function App() {
  const session = useBoardSession();
  if (!session)
    return (
      <div className="loading">
        <Mark />
        <p>Opening your canvas…</p>
      </div>
    );
  return <Workspace session={session} />;
}
