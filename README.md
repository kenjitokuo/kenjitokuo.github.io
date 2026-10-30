# Academic profile website

The page loads researchmap public data from `data/researchmap-cache.json`
first. It then tries the researchmap Web API from the visitor's browser.
Each successful category response replaces its saved counterpart. On
connection failure the existing saved data are kept visible.

The GitHub Actions workflow `Refresh researchmap data` checks for
updates once a week or when manually run. An API failure does not erase
previously saved categories. GitHub-hosted runners might also be blocked
by researchmap; if so, refresh the snapshot locally in Japan.

## Initial snapshot and manual refresh

An empty starter JSON does not contain actual research achievements.
Until it is successfully populated, international visitors whose access
to the researchmap API is blocked cannot see the achievements.

On a computer that can access the researchmap API, install Node.js 22+,
clone the repository, and run:

```sh
node scripts/update-researchmap-cache.mjs
git add data/researchmap-cache.json
git commit -m "Update saved researchmap data"
git push origin main
```

The site then serves the updated JSON worldwide through GitHub Pages.
Live refresh in an individual browser does not automatically change
the shared JSON; use the updater or the GitHub Action to do that.

Source: researchmap public Web API. Check researchmap's API terms of use.
