"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChartColumn,
  Clock3,
  LayoutDashboard,
  List,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Brand } from "./brand";

export function PublicNav({ base = "" }: { base?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-nav">
      <div className="nav-inner">
        <Brand href={base || "/"} />
        <button
          className="icon-button public-menu-button"
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav
          className={open ? "is-open" : ""}
          aria-label="Public navigation"
          onClick={() => setOpen(false)}
        >
          <Link href={base || "/"}>Overview</Link>
          <Link href={`${base}/activity`}>Activity</Link>
          <Link href={`${base}/subjects`}>Subjects</Link>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <Link className="nav-login" href="/manage/login">
            Workspace <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}
const links = [
  ["/manage", "Overview", LayoutDashboard],
  ["/manage/sessions", "Sessions", Clock3],
  ["/manage/subjects", "Subjects", BookOpen],
  ["/manage/analytics", "Analytics", ChartColumn],
  ["/manage/settings", "Settings", Settings],
] as const;
export function ManageNav({
  preference,
  avatarUrl,
  displayName,
  username,
  isAdmin = false,
}: {
  preference?: string;
  avatarUrl?: string | null;
  displayName?: string | null;
  username: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <aside className="manage-nav">
      <div className="manage-nav-top">
        <Brand href="/manage" />
        <button
          className="icon-button manage-menu-button"
          type="button"
          aria-label={
            open ? "Close workspace navigation" : "Open workspace navigation"
          }
          aria-expanded={open}
          aria-controls="manage-nav-content"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <div
        id="manage-nav-content"
        className={`manage-nav-content ${open ? "is-open" : ""}`}
      >
        <p className="nav-overline">WORKSPACE</p>
        <nav aria-label="Management navigation">
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/manage/admin"
              aria-current={pathname === "/manage/admin" ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Users size={18} />
              People
            </Link>
          )}
        </nav>
        <div className="manage-nav-footer">
          <Link
            className="manage-account-chip"
            href="/manage/settings"
            onClick={() => setOpen(false)}
          >
            <span className="manage-account-avatar">
              {avatarUrl ? (
                <Image
                  unoptimized
                  src={avatarUrl}
                  width={48}
                  height={48}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                displayName?.slice(0, 1).toUpperCase() || "?"
              )}
            </span>
            <span className="manage-account-details">
              <strong>{displayName || "My account"}</strong>
              <small>
                {isAdmin ? "Administrator" : "Member"} · @{username}
              </small>
            </span>
          </Link>
          <ThemeToggle preference={preference} />
          <Link
            href={`/u/${username}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <List size={16} /> View public site
          </Link>
        </div>
      </div>
    </aside>
  );
}
