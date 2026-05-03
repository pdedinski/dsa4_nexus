"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Settings,
  Users,
  LogOut,
  Sword,
  Shield,
  Scroll,
  FlaskConical,
  Package,
  Zap,
  Star,
  BookMarked,
  UserCircle,
  PawPrint,
} from "lucide-react";
import clsx from "clsx";
import { signOut } from "next-auth/react";

export interface SidebarUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAllowed: boolean;
  isEditor: boolean;
  isAdmin: boolean;
  isSuperuser: boolean;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  bestiary: PawPrint,
  character: Star,
  combat: Sword,
  core: Shield,
  equipment: Package,
  magic: FlaskConical,
  meta: BookMarked,
  talents: Zap,
};

const CATEGORIES = [
  { key: "bestiary", label: "Bestiary", files: ["beasts", "summoned_creatures"] },
  { key: "character", label: "Character", files: ["advantages", "disadvantages", "special_abilities"] },
  { key: "combat", label: "Combat", files: ["combat_maneuvers"] },
  { key: "core", label: "Core", files: ["cultures", "professions", "races"] },
  { key: "equipment", label: "Equipment", files: ["armor", "general_equipment", "weapons"] },
  { key: "magic", label: "Magic", files: ["spells"] },
  { key: "meta", label: "Meta", files: ["advancement_costs"] },
  {
    key: "talents",
    label: "Talents",
    files: [
      "artisan_talents",
      "combat_talents",
      "languages_scripts",
      "lore_talents",
      "nature_talents",
      "physical_talents",
      "social_talents",
    ],
  },
];

const FILE_LABELS: Record<string, string> = {
  beasts: "Creatures",
  summoned_creatures: "WdZ Summons",
  advantages: "Advantages",
  disadvantages: "Disadvantages",
  special_abilities: "Special Abilities",
  combat_maneuvers: "Combat Maneuvers",
  cultures: "Cultures",
  professions: "Professions",
  races: "Races",
  armor: "Armor",
  general_equipment: "General Equipment",
  weapons: "Weapons",
  spells: "Spells",
  advancement_costs: "Advancement Costs",
  artisan_talents: "Artisan",
  combat_talents: "Combat",
  languages_scripts: "Languages & Scripts",
  lore_talents: "Lore",
  nature_talents: "Nature",
  physical_talents: "Physical",
  social_talents: "Social",
};

export default function Sidebar({
  user,
  onNavigate,
}: {
  user: SidebarUser;
  /** Called after navigating via a sidebar link (e.g. to close the mobile drawer). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [codexOpen, setCodexOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["core"])
  );
  const [manageOpen, setManageOpen] = useState(false);

  const canManage = user.isAdmin || user.isSuperuser;

  function toggleCategory(key: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <aside className="w-60 shrink-0 bg-surface-sidebar border-r border-surface-border flex flex-col h-full overflow-hidden">
      {/* Logo / header */}
      <div className="px-4 py-5 border-b border-surface-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-muted border border-brand flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path
              d="M12 2L15 9H22L16.5 13.5L18.5 21L12 17L5.5 21L7.5 13.5L2 9H9Z"
              fill="#8b1a1a"
              stroke="#c9424d"
              strokeWidth="0.5"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-ink text-sm font-bold leading-none truncate">
            DSA Nexus
          </p>
          <p className="text-ink-faint text-xs leading-none mt-0.5 truncate">
            Das Schwarze Auge
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {/* Characters */}
        <div className="mb-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Characters
          </p>
          <Link
            href="/characters"
            onClick={() => onNavigate?.()}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === "/characters" || pathname.startsWith("/characters/")
                ? "bg-brand-muted text-ink font-medium"
                : "text-ink-muted hover:text-ink hover:bg-surface-card"
            )}
          >
            <UserCircle className="w-3.5 h-3.5 shrink-0" />
            My Characters
          </Link>
        </div>

        {/* CODEX section */}
        <div>
          <button
            onClick={() => setCodexOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-card transition-colors text-sm font-semibold uppercase tracking-wider"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Codex</span>
            {codexOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {codexOpen && (
            <div className="mt-1 space-y-0.5">
              {CATEGORIES.map(({ key, label, files }) => {
                const Icon = CATEGORY_ICONS[key] ?? Scroll;
                const isCatExpanded = expandedCategories.has(key);

                return (
                  <div key={key}>
                    <button
                      onClick={() => toggleCategory(key)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-card transition-colors text-sm"
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      {isCatExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>

                    {isCatExpanded && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-surface-border pl-3">
                        {files.map((fileKey) => {
                          const href = `/codex/${key}/${fileKey}`;
                          const active = pathname === href;
                          return (
                            <Link
                              key={fileKey}
                              href={href}
                              onClick={() => onNavigate?.()}
                              className={clsx(
                                "block px-2 py-1.5 rounded-md text-sm transition-colors",
                                active
                                  ? "bg-brand-muted text-ink font-medium"
                                  : "text-ink-muted hover:text-ink hover:bg-surface-card"
                              )}
                            >
                              {FILE_LABELS[fileKey] ?? fileKey}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Manage section — admin/superuser only */}
        {canManage && (
          <div className="pt-2">
            <button
              onClick={() => setManageOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-card transition-colors text-sm font-semibold uppercase tracking-wider"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Manage</span>
              {manageOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {manageOpen && (
              <div className="mt-1 ml-4 border-l border-surface-border pl-3 space-y-0.5">
                <Link
                  href="/manage/users"
                  onClick={() => onNavigate?.()}
                  className={clsx(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    pathname === "/manage/users"
                      ? "bg-brand-muted text-ink font-medium"
                      : "text-ink-muted hover:text-ink hover:bg-surface-card"
                  )}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  Manage Users
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-surface-border p-3 flex items-center gap-2 min-w-0">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="w-7 h-7 rounded-full shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-brand-muted border border-brand flex items-center justify-center shrink-0 text-xs text-ink font-bold">
            {(user.name ?? user.email ?? "?")[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-ink text-xs font-medium truncate">
            {user.name ?? user.email}
          </p>
          <p className="text-ink-faint text-xs truncate">
            {user.isSuperuser
              ? "Superuser"
              : user.isAdmin
              ? "Admin"
              : user.isEditor
              ? "Editor"
              : "Reader"}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
          title="Sign out"
          className="text-ink-faint hover:text-ink transition-colors p-1 shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
