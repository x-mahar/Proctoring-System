import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Register from "./pages/Register";
import Proctoring from "./pages/Proctoring";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/proctoring" element={<Proctoring />} />
      </Routes>
    </Router>
  );
}

export default App;
