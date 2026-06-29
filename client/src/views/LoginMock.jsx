import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginMock() {
  const [input, setInput] = useState("");
  const { setToken } = useAuth();
  const navigate = useNavigate();

  function handleSave() {
    const t = input.trim();
    if (!t) return;
    setToken(t);
    navigate("/trips", { replace: true });
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">Smart Trip Planner</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Enter your JWT access token to get started</p>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono resize-none h-28 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Paste your JWT token here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={handleSave}
          disabled={!input.trim()}
          className="mt-4 w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Save Token
        </button>
      </div>
    </div>
  );
}
