import React from "react";

interface ButtonWithdrawalProps {
  onClick: () => void;
  disabled?: boolean;
}

const ButtonWithdrawal: React.FC<ButtonWithdrawalProps> = ({ onClick, disabled = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-gradient-to-r from-[#6B48FF] to-[#A64DFF] text-white font-semibold rounded-lg flex items-center justify-center px-4 py-2
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:opacity-80'}
        transition-opacity duration-200
      `}
    >
      <svg
        className="w-4 h-4 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
      Вывести
    </button>
  );
};

export default ButtonWithdrawal;