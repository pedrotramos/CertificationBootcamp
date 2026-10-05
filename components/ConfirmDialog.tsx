import React, { useEffect, useRef } from 'react';
import Button from './Button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo modal de confirmação: foco no botão principal, Esc cancela. */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Foco no botão seguro (continuar na prova), para Enter não sair sem querer
    dialogRef.current?.querySelector('button')?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="w-full max-w-md bg-white rounded-xl p-6 space-y-4 shadow-2xl">
        <h2 id="confirm-title" className="text-lg font-black text-[#1B3139] uppercase tracking-tight">{title}</h2>
        <p id="confirm-message" className="text-sm text-slate-600">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
