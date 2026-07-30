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
