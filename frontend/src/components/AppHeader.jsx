import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { WaveformIcon, VinylRecordIcon, PaintBrushIcon, GearSixIcon, CircleDashedIcon } from "@phosphor-icons/react";

const links = [
    { to: "/", label: "Studio", icon: WaveformIcon },
    { to: "/library", label: "Songbook", icon: VinylRecordIcon },
    { to: "/styles", label: "Styles", icon: PaintBrushIcon },
    { to: "/settings", label: "Providers", icon: GearSixIcon },
];

export default function AppHeader() {
    const loc = useLocation();
    return (
        <header
            className="sticky top-0 z-30 border-b border-[#222] bg-[#0A0A0A]/80 backdrop-blur-xl"
            data-testid="app-header"
        >
            <div className="max-w-[1600px] mx-auto flex items-center justify-between px-6 py-4">
                <Link to="/" className="flex items-center gap-3" data-testid="app-logo-link">
                    <div className="w-8 h-8 border border-[#39FF14] flex items-center justify-center neon-pulse">
                        <CircleDashedIcon size={18} color="#39FF14" weight="bold" />
                    </div>
                    <div>
                        <div className="font-display font-black text-lg uppercase tracking-tight leading-none text-[#EDEDED]">
                            Lyricist
                        </div>
                        <div className="font-mono text-[10px] tracking-[0.3em] text-[#666] uppercase mt-0.5">
                            beat-to-bars engine
                        </div>
                    </div>
                </Link>

                <nav className="flex items-center gap-1" data-testid="main-nav">
                    {links.map(({ to, label, icon: Icon }) => {
                        const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
                        return (
                            <NavLink
                                key={to}
                                to={to}
                                data-testid={`nav-${label.toLowerCase()}`}
                                className={() =>
                                    [
                                        "px-4 py-2 flex items-center gap-2 border text-xs font-mono tracking-[0.2em] uppercase transition-all",
                                        active
                                            ? "border-[#39FF14] text-[#39FF14] bg-[#39FF14]/5"
                                            : "border-transparent text-[#A0A0A0] hover:text-[#EDEDED] hover:border-[#333]",
                                    ].join(" ")
                                }
                            >
                                <Icon size={14} weight={active ? "bold" : "regular"} />
                                {label}
                            </NavLink>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
