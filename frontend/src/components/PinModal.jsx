import { useState } from 'react';
import { X, Delete } from 'lucide-react';

export default function PinModal({ technician, onClose, onSuccess }) {
  const [digits, setDigits] = useState([]);

  const press = (d) => {
    if (digits.length < 4) setDigits([...digits, d]);
  };

  const backspace = () => setDigits(digits.slice(0, -1));

  const submit = () => {
    if (digits.length === 4) onSuccess(technician);
  };

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">PIN Authentication</p>
              <p className="text-xs text-gray-400">Enter your 4-digit PIN</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Technician info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="font-semibold text-gray-900">{technician.name}</p>
          <p className="text-sm text-gray-500">{technician.role}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{technician.shop}</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 px-6 pt-5 pb-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all duration-150
                ${i < digits.length
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-300'
                }`}
            >
              {i < digits.length ? '●' : '○'}
            </div>
          ))}
        </div>

        {/* Keypad */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-3 gap-2">
            {keys.map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                className="h-12 rounded-xl text-lg font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 active:bg-blue-50 active:text-blue-700 transition-colors border border-gray-100"
              >
                {k}
              </button>
            ))}
            <div /> {/* empty cell */}
            <button
              onClick={() => press(0)}
              className="h-12 rounded-xl text-lg font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 active:bg-blue-50 active:text-blue-700 transition-colors border border-gray-100"
            >
              0
            </button>
            <button
              onClick={backspace}
              className="h-12 rounded-xl text-gray-500 bg-gray-50 hover:bg-gray-100 active:bg-red-50 active:text-red-500 transition-colors border border-gray-100 flex items-center justify-center"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={submit}
            disabled={digits.length < 4}
            className="mt-4 w-full h-12 rounded-xl font-semibold text-sm transition-all
              disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
              enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700 enabled:active:bg-blue-800"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
