// TOWER settings. Edit this file, save, refresh the page. No rebuild needed.
window.TOWER_CONFIG = {
  name: "TOWER",
  ticker: "$TOWER",

  // Your token's mint address. Leave empty to show "announced at launch"
  // and hide the live featured flight.
  contractAddress: "",

  // Social links. Empty strings are hidden. "#" is a placeholder link.
  links: {
    twitter: "https://x.com/Solana_tower",
    telegram: "",
    website: "",
    dexscreener: "",
    buy: ""
  },

  // false = no network calls at all (authored demo flights only).
  liveData: true,

  // Solana RPC. The default is a free keyless endpoint that allows browser
  // requests (api.mainnet-beta.solana.com rejects them). It covers the mint
  // and fee checks; holder concentration needs your own RPC URL (e.g. a free
  // Helius key). Anything here is public in the browser, so only use a free,
  // rate-limited key.
  rpcUrl: "https://solana-rpc.publicnode.com",

  // How often the featured flight refreshes (seconds).
  refreshSeconds: 30,

  // The 5-second opening animation. It plays once per browser session and is
  // skipped for reduced-motion visitors. Add ?intro=1 to the URL to replay it.
  intro: true
};
