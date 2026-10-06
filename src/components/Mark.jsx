// The myDownloader glyph (a download arrow into a tray), drawn without its tile.
// Lives inside the green rounded square used in the header and the drawer.
export default function Mark({ size = 16 }) {
  return (
    <svg width={size} height={size * 320 / 272} viewBox="120 96 272 320" fill="none" aria-hidden="true">
      <path d="M256 124v170" stroke="#FFFFFF" strokeWidth="42" strokeLinecap="round" />
      <path d="M184 226l72 72 72-72" stroke="#FFFFFF" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M148 346v24a22 22 0 0 0 22 22h172a22 22 0 0 0 22-22v-24" stroke="#C4EEDC" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
