export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #161c30 0%, #0a0c16 100%)" }}
    >
      {children}
    </div>
  );
}
