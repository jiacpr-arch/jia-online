# Recovered source baseline

Production deployment: dpl_GA4tZJzTEFyiWGrUXTXnPEqap1MN.
Source archive MD5: 39e6a63bf9d938825597302f2133ba82, matching the deployed bootstrap script.
Recovered the source archive and 30 public assets. A new package-lock.json records the dependency resolution used during recovery; it is not an original production lockfile.
Build now uses local source: npm ci, then npm run build. The original build downloaded and overwrote source from Supabase and production assets; that automatic recovery step has been removed from the build command so future GitLab edits remain authoritative.
Historical fetch scripts are retained for reference; running them can overwrite current local source/assets.
This repository begins new recovery history. No GitLab destination has been configured or pushed.
