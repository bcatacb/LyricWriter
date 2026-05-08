import React, { useEffect } from "react";
import axios from "axios";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { SettingsProvider } from "@/lib/settings";
import AppHeader from "@/components/AppHeader";
import StudioPage from "@/pages/StudioPage";
import LibraryPage from "@/pages/LibraryPage";
import SongDetailPage from "@/pages/SongDetailPage";
import StylesPage from "@/pages/StylesPage";
import SettingsPage from "@/pages/SettingsPage";
import SharePage from "@/pages/SharePage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function Chrome() {
    const loc = useLocation();
    const hideChrome = loc.pathname.startsWith("/share/");
    return (
        <>
            {!hideChrome && <AppHeader />}
            <main className="relative z-10">
                <Routes>
                    <Route path="/" element={<StudioPage />} />
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/song/:id" element={<SongDetailPage />} />
                    <Route path="/styles" element={<StylesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/share/:slug" element={<SharePage />} />
                </Routes>
            </main>
            {!hideChrome && (
                <footer className="border-t border-[#222] mt-16 py-6 px-6">
                    <div className="max-w-[1600px] mx-auto text-[10px] font-mono tracking-[0.3em] uppercase text-[#444] text-center">
                        LYRICIST ▸ BEAT-TO-BARS ENGINE
                    </div>
                </footer>
            )}
        </>
    );
}

function App() {
    // Wake-up call for the server (Render free tier cold starts)
    useEffect(() => {
        if (BACKEND_URL) {
            axios.get(`${BACKEND_URL}/api/ping`).catch(() => {});
        }
    }, []);

    return (
        <div className="App min-h-screen text-[#EDEDED]">
            <SettingsProvider>
                <BrowserRouter>
                    <Chrome />
                </BrowserRouter>
                <Toaster
                    position="top-right"
                    theme="dark"
                    toastOptions={{
                        className: "!bg-[#121212] !border !border-[#222] !text-[#EDEDED] !rounded-none !font-mono !text-xs",
                    }}
                />
            </SettingsProvider>
        </div>
    );
}

export default App;
