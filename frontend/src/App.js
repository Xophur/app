import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import QuizPage from "@/pages/QuizPage";
import ResultsPage from "@/pages/ResultsPage";

function App() {
  return (
    <div className="App min-h-screen bg-[#050505] noise-overlay">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<QuizPage />} />
          <Route path="/results/:resultId" element={<ResultsPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
