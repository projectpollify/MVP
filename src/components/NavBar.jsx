const NavBar = ({ setCurrentPage }) => {
  const navItems = [
    { label: 'Home', page: 'landing' },
    { label: 'Onboarding', page: 'onboarding' },
    { label: 'Dashboard', page: 'dashboard' },
    { label: 'Pillars', page: 'pillar' },
    { label: 'NeuroPollinator', page: 'neuro' },
    { label: 'ThoughtPod', page: 'thoughtpod' },
    { label: 'NFTs', page: 'nfts' },
    { label: 'Create NFT', page: 'nft-creation' },
    { label: 'Marketplace', page: 'nft-marketplace' },
    { label: 'Staking', page: 'staking' },
    { label: 'Polls', page: 'pollhub' },
    { label: 'Create Poll', page: 'poll-creation' },
    { label: 'Poll Page', page: 'pollpage' },
    { label: 'Group Hub', page: 'grouphub' }
  ];

  return (
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
      {navItems.map(({ label, page }) => (
        <button key={page} onClick={() => setCurrentPage(page)}>
          {label}
        </button>
      ))}
    </nav>
  );
};

export default NavBar;
