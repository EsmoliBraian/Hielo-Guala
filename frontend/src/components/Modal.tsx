import { useEffect } from "react";
import type { ReactNode } from "react";
import { IconX } from "./icons";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Locks the page behind the modal — otherwise scrolling the list underneath
  // while a modal is open causes visible layout glitches. The scroll container
  // is `.app-content` on desktop and `body` itself on mobile (see styles.css),
  // so both need to be locked.
  useEffect(() => {
    const appContent = document.querySelector<HTMLElement>(".app-content");
    const previousBodyOverflow = document.body.style.overflow;
    const previousAppContentOverflow = appContent?.style.overflow;

    document.body.style.overflow = "hidden";
    if (appContent) appContent.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (appContent) appContent.style.overflow = previousAppContentOverflow ?? "";
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel animate-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="btn btn-ghost btn-sm modal-close" onClick={onClose} aria-label="Cerrar">
            <IconX width={16} height={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
