import { X } from 'lucide-react';

export function ColorPicker({ currentColor, onColorSelect, onClose }) {
  const colors = [
    { name: 'None', value: undefined },
    { name: 'Light Blue', value: '#E3F2FD' },
    { name: 'Light Green', value: '#E8F5E9' },
    { name: 'Light Yellow', value: '#FFF9C4' },
    { name: 'Light Orange', value: '#FFE0B2' },
    { name: 'Light Pink', value: '#FCE4EC' },
    { name: 'Light Purple', value: '#F3E5F5' },
    { name: 'Light Gray', value: '#F5F5F5' },
  ];

  return (
    <div className="bg-white border border-gray-300 rounded shadow-lg p-3 w-48">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm">Fill Color</span>
        <button
          onClick={onClose}
          className="h-5 w-5 p-0 flex items-center justify-center rounded hover:bg-gray-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {colors.map((color) => (
          <button
            key={color.name}
            onClick={() => onColorSelect(color.value)}
            className={`h-8 rounded border-2 ${
              currentColor === color.value
                ? 'border-blue-500'
                : 'border-gray-200 hover:border-gray-400'
            }`}
            style={{ backgroundColor: color.value || 'white' }}
            title={color.name}
          >
            {!color.value && <span className="text-xs text-gray-500">None</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
