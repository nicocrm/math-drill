import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router";
import { ClerkProvider } from "@clerk/react";
import "./globals.css";
import Home from "./pages/Home";
import AdminPage from "./pages/Admin";
import SessionPage from "./pages/Session";
import ResultsPage from "./pages/Results";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/session" element={<SessionPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </HashRouter>
    </ClerkProvider>
  </StrictMode>
);
