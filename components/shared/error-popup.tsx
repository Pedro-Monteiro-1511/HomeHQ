"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ErrorPopup() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    function showError() {
      setOpen(true);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => setOpen(false), 5000);
    }

    function inspect(nodes: NodeList | Node[]) {
      for (const node of Array.from(nodes)) {
        if (!(node instanceof Element)) continue;
        if (node.matches(".feedback.error") || node.querySelector(".feedback.error")) {
          showError();
          return;
        }
      }
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => inspect(mutation.addedNodes));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("error", showError);
    window.addEventListener("unhandledrejection", showError);
    window.addEventListener("homehq:error", showError);
    return () => {
      observer.disconnect();
      window.removeEventListener("error", showError);
      window.removeEventListener("unhandledrejection", showError);
      window.removeEventListener("homehq:error", showError);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  if (!open) return null;
  return <div className="error-popup" role="alertdialog" aria-modal="true" aria-label="Erro">
    <span><AlertTriangle size={20} /></span>
    <div><strong>Erro</strong><p>Tente novamente mais tarde.</p></div>
    <button className="icon-button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={17} /></button>
  </div>;
}

export function notifyAppError() {
  window.dispatchEvent(new Event("homehq:error"));
}
