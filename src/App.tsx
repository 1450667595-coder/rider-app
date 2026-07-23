import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Records from "@/pages/Records";
import Income from "@/pages/Income";
import Predict from "@/pages/Predict";
import Goals from "@/pages/Goals";
import Analytics from "@/pages/Analytics";
import Achievements from "@/pages/Achievements";
import Weekly from "@/pages/Weekly";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/records" element={<Records />} />
          <Route path="/income" element={<Income />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/weekly" element={<Weekly />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/achievements" element={<Achievements />} />
        </Route>
      </Routes>
    </Router>
  );
}