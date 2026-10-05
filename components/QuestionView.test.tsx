// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import QuestionView from './QuestionView';
import { Question } from '../types';

const question = {
  enunciado: 'Qual opção?',
  category: 'Delta',
  exam: 'Prova A',
  options: [
    { id: 'a', text: 'Primeira' },
    { id: 'b', text: 'Segunda' },
  ],
} as Question;

afterEach(cleanup);

describe('QuestionView acessível', () => {
  it('expõe as alternativas como radios e marca a selecionada', () => {
    render(<QuestionView question={question} selectedOptionId="b" onSelectOption={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
  });

  it('seleciona com Enter e Espaço pelo teclado', () => {
    const onSelect = vi.fn();
    render(<QuestionView question={question} onSelectOption={onSelect} />);
    const [primeira, segunda] = screen.getAllByRole('radio');
    fireEvent.keyDown(primeira, { key: 'Enter' });
    fireEvent.keyDown(segunda, { key: ' ' });
    expect(onSelect).toHaveBeenNthCalledWith(1, 'a');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'b');
  });
});
