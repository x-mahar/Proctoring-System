import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Register from "./pages/Register";
import Proctoring from "./pages/Proctoring";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Register />} />
          <Route path="/proctoring" element={<Proctoring />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;