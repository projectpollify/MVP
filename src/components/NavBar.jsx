const NavBar = ({ setCurrentPage }) => {
  return (
    <nav style={{ marginBottom: '20px' }}>
      <button onClick={() => setCurrentPage('landing')}>Home</button>
      <button onClick={() => setCurrentPage('onboarding')}>Onboarding</button>
      <button onClick={() => setCurrentPage('dashboard')}>Dashboard</button>
      <button onClick={() => setCurrentPage('pillar')}>Pillars</button>
      <button onClick={() => setCurrentPage('neuro')}>NeuroPollinator</button>
      <button onClick={() => setCurrentPage('thoughtpod')}>ThoughtPod</button>
      <button onClick={() => setCurrentPage('nfts')}>NFTs</button>
      <button onClick={() => setCurrentPage('nft-creation')}>Create NFT</button>
      <button onClick={() => setCurrentPage('nft-marketplace')}>Marketplace</button>
      <button onClick={() => setCurrentPage('staking')}>Staking</button>
      <button onClick={() => setCurrentPage('pollhub')}>Polls</button>
      <button onClick={() => setCurrentPage('poll-creation')}>Create Poll</button>
      <button onClick={() => setCurrentPage('pollpage')}>Poll Page</button>
      <button onClick={() => setCurrentPage('grouphub')}>Group Hub</button>
    </nav>
  );
};

export default NavBar;
