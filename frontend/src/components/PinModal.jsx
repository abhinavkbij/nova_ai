import { useState, useRef, useEffect } from 'react';
import { X, Eye, EyeOff, XCircle } from 'lucide-react';
import { validatePin } from '../api/technicians';

export default function PinModal({ technician, onClose, onSuccess }) {
  const [pin, setPin]         = useState(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const inputsRef             = useRef([]);

  const isComplete = pin.every((d) => d !== '');

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    setError('');
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 3) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!text) return;
    const newPin = ['', '', '', ''];
    for (let i = 0; i < text.length; i++) newPin[i] = text[i];
    setPin(newPin);
    inputsRef.current[Math.min(text.length, 3)]?.focus();
  };

  const submit = () => {
    if (!isComplete || loading) return;
    const enteredPin = pin.join('');
    setLoading(true);
    setError('');
    validatePin(technician.id, enteredPin)
      .then(() => onSuccess(technician))
      .catch((err) => {
        const msg = err?.response?.status === 401
          ? 'Incorrect PIN. Please try again.'
          : 'Unable to verify PIN. Check your connection.';
        setError(msg);
        setPin(['', '', '', '']);
        setTimeout(() => inputsRef.current[0]?.focus(), 0);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {/* Error toast — floats above modal at page top */}
      {error && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-white border border-red-400 rounded-xl px-4 py-3 shadow-xl">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm text-gray-800">{error}</span>
          <button onClick={() => setError('')} className="text-gray-400 hover:text-gray-600 ml-1 transition-colors" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <LockIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">PIN Authentication</p>
              <p className="text-xs text-gray-400 mt-0.5">Enter your 4-digit PIN</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Technician info */}
        <div className="mx-6 mb-6 bg-gray-50 rounded-xl px-4 py-4">
          <p className="font-bold text-gray-900 text-base">{technician.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{technician.role}</p>
          <p className="text-sm text-gray-500">{technician.shop}</p>
        </div>

        {/* PIN boxes */}
        <div className="flex justify-center gap-3 px-6 mb-3">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={1}
              value={pin[i]}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`
                w-14 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none
                transition-colors caret-transparent select-none
                ${error
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : pin[i]
                    ? 'border-blue-500 bg-white text-gray-900'
                    : 'border-gray-200 bg-white text-gray-400'
                }
              `}
            />
          ))}
        </div>

        {/* Show / Hide PIN toggle — only visible once all 4 digits are entered */}
        <div className="h-9 flex items-center justify-center mb-1">
          {isComplete && (
            <button
              onClick={() => setShowPin((s) => !s)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showPin
                ? <><EyeOff className="w-4 h-4" /> Hide PIN</>
                : <><Eye className="w-4 h-4" /> Show PIN</>
              }
            </button>
          )}
        </div>

        {/* Continue button */}
        <div className="px-6 pb-6">
          <button
            onClick={submit}
            disabled={!isComplete || loading}
            className={`
              w-full h-12 rounded-xl font-semibold text-sm transition-colors
              ${isComplete && !loading
                ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {loading ? 'Verifying…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LockIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
