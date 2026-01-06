
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ResultsChartProps {
  score: number;
  total: number;
}

const ResultsChart: React.FC<ResultsChartProps> = ({ score, total }) => {
  // Filter out zero values to ensure a perfect circle when score is 0 or 100%
  const data = [
    { name: 'Acertos', value: score, color: '#FF3621' },
    { name: 'Erros', value: total - score, color: '#1B3139' },
  ].filter(item => item.value > 0);
  
  return (
    <div className="h-full w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={85}
            outerRadius={110}
            paddingAngle={data.length > 1 ? 2 : 0}
            dataKey="value"
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1B3139', 
              border: 'none', 
              borderRadius: '4px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              padding: '8px 12px'
            }}
            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
            cursor={{ fill: 'transparent' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResultsChart;
