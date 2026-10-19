type IconName =
  | "select"
  | "rectangle"
  | "hand"
  | "undo"
  | "redo"
  | "download"
  | "upload"
  | "recover"
  | "minus"
  | "plus"
  | "trash"
  | "layers"
  | "arrow"
  | "check";
const paths: Record<IconName, React.ReactNode> = {
  upload: <path d="M12 15V3m-5 5 5-5 5 5M4 16v4h16v-4" />,
  recover: (
    <>
      <path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  select: <path d="m5 3 13 9-6 1-3 6-4-16Z" />,
  rectangle: <rect x="4" y="4" width="16" height="16" rx="3" />,
  hand: (
    <path d="M8 11V5a2 2 0 0 1 4 0v5-6a2 2 0 0 1 4 0v6-4a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-1-7-4l-3-5c-1-2 1-4 3-2l2 3" />
  ),
  undo: (
    <>
      <path d="m8 4-5 5 5 5" />
      <path d="M3 9h11a6 6 0 0 1 0 12" />
    </>
  ),
  redo: (
    <>
      <path d="m16 4 5 5-5 5" />
      <path d="M21 9H10a6 6 0 0 0 0 12" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M5 12h14M12 5v14" />,
  trash: (
    <>
      <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function Mark() {
  return (
    <svg aria-hidden="true" width="30" height="30" viewBox="0 0 30 30" fill="none">
      <rect width="30" height="30" rx="9" fill="#174b3c" />
      <path d="M9 8v14m12-14v14M9 15h12" stroke="#d9f7a3" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
