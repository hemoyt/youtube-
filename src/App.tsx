import { Routes, Route } from "react-router-dom";
import Studio from "./pages/Studio";
import Landing from "./pages/Landing";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/studio" element={<Studio />} />
    </Routes>
  );
}
