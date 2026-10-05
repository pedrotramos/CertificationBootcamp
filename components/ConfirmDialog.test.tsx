// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

afterEach(cleanup);

function montar() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog title="Sair da prova?" message="Vai pausar." confirmLabel="Pausar e sair" cancelLabel="Continuar a prova" onConfirm={onConfirm} onCancel={onCancel} />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('é um diálogo modal nomeado e começa com foco no botão seguro', () => {
    montar();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Sair da prova?')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByText('Continuar a prova'));
  });

  it('confirmar e cancelar chamam os callbacks certos', () => {
    const { onConfirm, onCancel } = montar();
    fireEvent.click(screen.getByText('Pausar e sair'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Continuar a prova'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Esc cancela', () => {
    const { onCancel, onConfirm } = montar();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
