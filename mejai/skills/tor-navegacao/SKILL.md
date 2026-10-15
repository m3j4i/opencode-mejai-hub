---
name: tor-navegacao
description: Use Torch through Tor for deepweb, Tor-network and onion searches; browse onion sources on demand.
---
Discover server tor through habilidades. Start it and poll status until ready=true. Use tor.fetch for simple pages and tor-browser for JavaScript, tabs and downloads; it uses a separate proxied browser profile.

If Tor or the page fails, inspect and report the real error. Never retry an onion URL through a direct connection. Obtain exact onion addresses from the user or a verifiable source, preferably the site's own published address.

Verify the route using https://check.torproject.org/api/ip and IsTor=true. This kit provides a Tor proxy client, not Tor Browser's complete fingerprint protections. Account login identifies that account to the site. Do not promise absolute anonymity or universal access.

Only tor.fetch and tor-browser use Tor. Exa, Brave and the ordinary browser do not. Do not send private onion content to external search services without authorization. After downloads finish, close tabs and stop Tor. Data and cache stay in dados/tor and dados/tor-browser; downloads stay in downloads/tor.

For search requests mentioning deepweb, dark web, rede Tor or rede onion, discover browser_search on server tor-browser and call it with engine="torch". In this profile auto also selects Torch. The user prefers Torch; do not substitute another search engine when it fails. Read tor-search.json for the configured published onion endpoint. Return only observed links and verify the source content.
