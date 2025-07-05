
// src/App.jsx

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import PillarInterface from "./pages/PillarInterface";
import NeuroPollinator from "./pages/NeuroPollinator";
import ThoughtPod from "./pages/ThoughtPod";
import NFTs from "./pages/NFTs";
import NFTMarketplace from "./pages/NFTMarketplace";
import NFTCreation from "./pages/NFTCreation";
import Staking from "./pages/Staking";
import PollsHub from "./pages/PollsHub";
import PollCreation from "./pages/PollCreation";
import PollPage from "./pages/PollPage";
import GroupHub from "./pages/GroupHub";
import GroupPage from "./pages/GroupPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pillars" element={<PillarInterface />} />
        <Route path="/neuro-pollinator" element={<NeuroPollinator />} />
        <Route path="/thought-pod" element={<ThoughtPod />} />
        <Route path="/nfts" element={<NFTs />} />
        <Route path="/nft-marketplace" element={<NFTMarketplace />} />
        <Route path="/nft-creation" element={<NFTCreation />} />
        <Route path="/staking" element={<Staking />} />
        <Route path="/polls" element={<PollsHub />} />
        <Route path="/poll-creation" element={<PollCreation />} />
        <Route path="/poll-page" element={<PollPage />} />
        <Route path="/groups" element={<GroupHub />} />
        <Route path="/group-page" element={<GroupPage />} />
      </Routes>
    </Router>
  );
}

export default App;
