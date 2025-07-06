
import { useState } from 'react';
import NavBar from './components/NavBar';

// Import all your pages
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import PillarInterface from './pages/PillarInterface';
import NeuroPollinator from './pages/NeuroPollinator';
import ThoughtPod from './pages/ThoughtPod';
import NFTs from './pages/NFTs';
import NFTCreation from './pages/NFTCreation';
import NFTMarketplace from './pages/NFTMarketplace';
import Staking from './pages/Staking';
import PollsHub from './pages/PollsHub';
import PollCreation from './pages/PollCreation';
import PollPage from './pages/PollPage';
import GroupHub from './pages/GroupHub';

function App() {
  const [currentPage, setCurrentPage] = useState('landing');

  return (
    <div>
      <NavBar setCurrentPage={setCurrentPage} />

      {currentPage === 'landing' && <Landing />}
      {currentPage === 'onboarding' && <Onboarding />}
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'pillar' && <PillarInterface />}
      {currentPage === 'neuro' && <NeuroPollinator />}
      {currentPage === 'thoughtpod' && <ThoughtPod />}
      {currentPage === 'nfts' && <NFTs />}
      {currentPage === 'nft-creation' && <NFTCreation />}
      {currentPage === 'nft-marketplace' && <NFTMarketplace />}
      {currentPage === 'staking' && <Staking />}
      {currentPage === 'pollhub' && <PollsHub />}
      {currentPage === 'poll-creation' && <PollCreation />}
      {currentPage === 'pollpage' && <PollPage />}
      {currentPage === 'grouphub' && <GroupHub />}
    </div>
  );
}

export default App;
