// ============================================================================
// Ikon sisi siswa — kumpulan SVG stroke line yang konsisten.
// Diekspor agar sidebar & halaman memakai ikon yang sama persis.
// ============================================================================

type IkonProps = { className?: string };

function dasar(className?: string) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

export function IkonDashboard({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function IkonNilai({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

export function IkonAbsensi({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}

export function IkonPengumuman({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M14 8a5 5 0 0 1 0 8" />
      <path d="M17 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function IkonJam({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IkonBuku({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2V5Z" />
      <path d="M8 3v18" />
    </svg>
  );
}

export function IkonTugas({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M15 4v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

export function IkonLab({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
      <path d="M13 5 11 19" />
    </svg>
  );
}

export function IkonKomputer({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function IkonGembok({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IkonKeluar({ className }: IkonProps) {
  return (
    <svg {...dasar(className)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}