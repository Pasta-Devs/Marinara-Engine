// Impeccable depends on Puppeteer, but Marinara uses explicit Playwright/LHCI
// browser install steps. Keep Puppeteer's install hook from downloading Chrome.
module.exports = {
  skipDownload: true,
};
