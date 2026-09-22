// Toolbar button: opens the start page in the current tab.
const api = globalThis.browser || globalThis.chrome;

api.action.onClicked.addListener((tab) => {
  const url = api.runtime.getURL('newtab.html');
  if (tab?.id != null) api.tabs.update(tab.id, { url });
  else api.tabs.create({ url });
});
