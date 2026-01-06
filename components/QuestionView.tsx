
import React from 'react';
import { Question, Option } from '../types';
import Card from './Card';

interface QuestionViewProps {
  question: Question;
  selectedOptionId?: string;
  onSelectOption: (optionId: string) => void;
}

const QuestionView: React.FC<QuestionViewProps> = ({
  question,
  selectedOptionId,
  onSelectOption
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <span className="px-3 py-1 bg-slate-100 text-[#1B3139] border border-slate-200 rounded text-[10px] font-black uppercase tracking-widest">
          CATEGORIA: {question.category}
        </span>
        <h2
          className="text-2xl md:text-3xl font-extrabold text-[#1B3139] leading-tight"
          dangerouslySetInnerHTML={{ __html: question.enunciado }}
        />
        {question.enunciadoImageUrl && (
          <div className="bg-white p-2 border border-slate-200 rounded">
            <img
              src={question.enunciadoImageUrl}
              alt="Contexto Técnico"
              className="w-full rounded shadow-sm grayscale-0 hover:grayscale-0 transition-all"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {question.options.map((option) => (
          <Card
            key={option.id}
            onClick={() => onSelectOption(option.id)}
            className={`p-6 flex flex-col items-start text-left gap-4 border-2 rounded transition-all ${selectedOptionId === option.id
              ? 'border-[#FF3621] bg-[#FF3621]/5'
              : 'border-slate-100 hover:border-slate-300'
              }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedOptionId === option.id ? 'border-[#FF3621] bg-[#FF3621]' : 'border-slate-300'}`}>
                {selectedOptionId === option.id && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <p className={`text-base font-bold ${selectedOptionId === option.id ? 'text-[#FF3621]' : 'text-[#1B3139]'}`}>
                {option.text}
              </p>
              {option.imageUrl && (
                <div className="bg-white p-1 rounded border border-slate-100">
                  <img
                    src={option.imageUrl}
                    alt={option.text}
                  />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default QuestionView;
