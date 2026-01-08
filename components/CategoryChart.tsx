import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface CategoryChartProps {
    category: string;
    correct: number;
    total: number;
}

const CategoryChart: React.FC<CategoryChartProps> = ({ category, correct, total }) => {
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    const incorrect = total - correct;

    const chartData = [
        {
            name: category,
            correct: correct,
            incorrect: incorrect,
            percentage: percentage,
        },
    ];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-[#1B3139] uppercase tracking-tight">{category}</h4>
                <span className={`text-lg font-black ${percentage >= 70 ? 'text-green-600' : 'text-[#FF3621]'}`}>
                    {percentage}%
                </span>
            </div>
            <div className="relative">
                <ResponsiveContainer width="100%" height={40}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <XAxis type="number" hide domain={[0, total]} />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1B3139',
                                border: 'none',
                                borderRadius: '4px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                padding: '8px 12px',
                            }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                            cursor={{ fill: 'transparent' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'correct') return [`${value} corretas`, 'Corretas'];
                                if (name === 'incorrect') return [`${value} incorretas`, 'Incorretas'];
                                return [value, name];
                            }}
                        />
                        <Bar dataKey="correct" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="incorrect" stackId="a" fill="#FF3621" radius={[4, 0, 0, 4]} />
                    </BarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-black text-slate-600">
                        {correct}/{total}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default CategoryChart;

