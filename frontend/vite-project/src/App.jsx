import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Register from "./pages/Register";
import Proctoring from "./pages/Proctoring";
import './App.css';

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 text-white">
        <Router>
          <Routes>
            <Route path="/" element={<Register />} />
            <Route path="/proctoring" element={<Proctoring />} />
          </Routes>
        </Router>
      </div>
    </div>
  );
}

export default App;
