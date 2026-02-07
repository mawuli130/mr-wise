
import React, { useEffect, useState, useRef } from 'react';
import { getAllStudents } from '../services/firebaseService';
import { AppUser } from '../types';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const AdminDashboard: React.FC = () => {
  const [students, setStudents] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllStudents();
        setStudents(data);
      } catch (e) {
        console.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && chartRef.current && students.length > 0) {
      const electiveCounts: { [key: string]: number } = {};
      
      students.forEach(s => {
        if (s.electiveSubjects && Array.isArray(s.electiveSubjects)) {
          s.electiveSubjects.forEach(elective => {
            electiveCounts[elective] = (electiveCounts[elective] || 0) + 1;
          });
        }
      });

      const labels = Object.keys(electiveCounts);
      const data = Object.values(electiveCounts);

      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: 'pie',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: [
                '#059669', '#10b981', '#34d399', '#6ee7b7', 
                '#1e3a8a', '#1d4ed8', '#3b82f6', '#60a5fa',
                '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd',
                '#f59e0b', '#fbbf24', '#fb7185', '#fda4af'
              ],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  font: { weight: 'bold', size: 10 },
                  padding: 20,
                  boxWidth: 12
                }
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    return ` ${label}: ${value} Students`;
                  }
                }
              }
            }
          }
        });
      }
    }
  }, [loading, students]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20">
      <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 font-black text-emerald-600 uppercase text-[10px] animate-pulse">Calculating Stats...</p>
    </div>
  );

  const totalElectiveSelections = students.reduce((acc, s) => acc + (s.electiveSubjects?.length || 0), 0);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl text-center">
          <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Students</h4>
          <p className="text-4xl font-black text-gray-900">{students.length}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl text-center">
          <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Elective Choices</h4>
          <p className="text-4xl font-black text-gray-900">{totalElectiveSelections}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl text-center">
          <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Unique Electives</h4>
          <p className="text-4xl font-black text-gray-900">
            {new Set(students.flatMap(s => s.electiveSubjects || [])).size}
          </p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl text-center">
          <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Core Groups</h4>
          <p className="text-4xl font-black text-gray-900">{new Set(students.map(s => s.coreSubject)).size}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3.5rem] border shadow-2xl flex flex-col items-center">
          <h3 className="text-xl font-black text-gray-900 uppercase mb-4">Elective Analysis</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-8 tracking-widest">Tracking Course Interest Levels</p>
          <div className="w-full h-[400px]">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3.5rem] border shadow-2xl overflow-hidden flex flex-col">
          <h3 className="text-xl font-black text-gray-900 uppercase mb-8">Student Directory</h3>
          <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                  <th className="pb-4 px-2">Student</th>
                  <th className="pb-4 px-2">Electives</th>
                  <th className="pb-4 px-2">Core</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map(s => (
                  <tr key={s.uid} className="text-xs group hover:bg-emerald-50 transition-colors">
                    <td className="py-4 px-2">
                      <div className="font-black text-gray-900">{s.name}</div>
                      <div className="text-[10px] text-emerald-600">@{s.nickname || 'none'}</div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex flex-wrap gap-1">
                        {s.electiveSubjects?.map(subj => (
                          <span key={subj} className="text-[8px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase">
                            {subj}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-2 font-bold text-gray-400">{s.coreSubject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
