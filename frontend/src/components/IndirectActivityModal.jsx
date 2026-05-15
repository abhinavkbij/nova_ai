import { useState } from 'react';
import { X } from 'lucide-react';
import { INDIRECT_ACTIVITIES } from '../data/mockData';

export default function IndirectActivityModal({ onClose, onSelect }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Select an Indirect Activity</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
          {INDIRECT_ACTIVITIES.map((activity) => (
            <button
              key={activity}
              onClick={() => setSelected(activity === selected ? null : activity)}
              className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all border
                ${selected === activity
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
            >
              {activity}
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button
            disabled={!selected}
            onClick={() => onSelect(selected)}
            className="w-full h-11 rounded-xl font-semibold text-sm transition-all
              disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
              enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
