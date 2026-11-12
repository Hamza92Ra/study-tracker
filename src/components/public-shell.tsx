import { PublicNav } from "./nav";
import Link from "next/link";
export function PublicShell({
  children,
  base = "",
}: {
  children: React.ReactNode;
  base?: string;
}) {
  return (
    <div className="page">
      <PublicNav base={base} />
      {children}
      <footer className="footer">
        <div className="container footer-inner">
          <span>Study Ledger · A thoughtful record of learning.</span>
          <Link href="/manage/login">Workspace sign in</Link>
        </div>
      </footer>
    </div>
  );
}
