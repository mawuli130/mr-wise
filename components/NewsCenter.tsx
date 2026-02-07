
import React, { useState, useEffect } from 'react';
import { fetchGhanaEducationNews } from '../services/geminiService';
import { NewsItem, NewsCategory } from '../types';
import Button from './Button';

const NewsCenter: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('WASSCE');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  const categories: { id: NewsCategory, label: string }[] = [
    { id: 'WASSCE', label: 'WASSCE News' },
    { id: 'BECE', label: 'BECE Updates' },
    { id: 'NABTEB', label: 'NABTEB / Tech' },
    { id: 'GES', label: 'GES Official' }
  ];

  const loadNews = async () => {
    setLoading(true);
    try {
      const data = await fetchGhanaEducationNews(activeCategory);
      setNews(data);
    } catch (error) {
      console.error("News fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, [activeCategory]);

  const shareNews = (item: NewsItem) => {
    const text = `*${item.title}*\n\n${item.summary}\n\nRead more: ${item.url}\n\n- Shared via Mr. Wise Legit Source`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500 pb-20">
      <div className="flex flex-wrap justify-center gap-3">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${activeCategory === cat.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100' : 'bg-white border-gray-100 text-gray-400 hover:border-emerald-200'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-4 border-4 border-emerald-200 border-b-transparent rounded-full animate-spin-slow"></div>
          </div>
          <p className="mt-6 font-black text-emerald-600 uppercase tracking-widest text-xs animate-pulse">Scouting Live Bulletins...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {news.length > 0 ? news.map(item => (
            <div key={item.id} className="bg-white rounded-[2rem] border-2 border-gray-100 p-8 shadow-xl hover:shadow-2xl transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black bg-emerald-600 text-white px-3 py-1 rounded-full uppercase tracking-tighter">{item.source}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase">{item.date}</span>
              </div>
              <h3 className="text-xl font-black text-gray-900 leading-tight mb-4 group-hover:text-emerald-700 transition-colors">{item.title}</h3>
              <p className="text-sm text-gray-500 font-medium mb-6 flex-1">{item.summary}</p>
              
              <div className="flex items-center gap-4 pt-4 border-t border-gray-50">
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[10px] font-black uppercase text-emerald-600 hover:underline flex items-center gap-2"
                >
                  Visit Source
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
                <button 
                  onClick={() => shareNews(item)}
                  className="ml-auto bg-emerald-50 text-emerald-700 p-3 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all"
                  title="Share to WhatsApp"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.539 2.016 2.069-.542c.979.58 1.991.96 3.219.96 3.181 0 5.767-2.586 5.768-5.766 0-3.18-2.586-5.721-5.768-5.721zm3.108 8.114c-.131.365-.75.714-1.031.758-.28.044-.614.072-1.748-.394-1.442-.593-2.37-2.062-2.441-2.158-.072-.096-.583-.776-.583-1.48s.365-1.05.51-1.201c.144-.15.315-.188.421-.188s.21.004.301.008c.096.004.225-.036.352.271.131.315.45.1.51.21.06.105.105.225.045.345-.06.12-.131.18-.18.271s-.096.162-.045.271c.06.105.271.44.58.714.394.345.725.45.834.495.105.045.225.045.315-.06.09-.105.394-.461.499-.615.105-.15.21-.128.345-.075s.856.405.991.48c.135.075.225.112.255.165.045.06.045.345-.09.71z"/></svg>
                </button>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-20 text-center">
              <p className="font-black text-gray-400 uppercase tracking-widest text-xs">No current bulletins found for this category.</p>
              <Button onClick={loadNews} variant="secondary" className="mt-6 px-10 border-2">Retry Search</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsCenter;
