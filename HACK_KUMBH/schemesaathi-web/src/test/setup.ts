import "@testing-library/jest-dom";

// Mock localStorage and sessionStorage if not present
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

Object.defineProperty(window, "sessionStorage", {
  value: localStorageMock,
});

// Mock SpeechSynthesis
const mockSpeechSynthesis = {
  speak: () => {},
  cancel: () => {},
  getVoices: () => [
    { lang: "mr-IN", name: "Marathi India" },
    { lang: "hi-IN", name: "Hindi India" },
    { lang: "en-IN", name: "English India" },
  ],
};

Object.defineProperty(window, "speechSynthesis", {
  value: mockSpeechSynthesis,
});
