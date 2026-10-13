// Decorate only manager-owned Rancher links; keep the host's navigation renderer.
export function observeNavigation(prefix, getTones) {
  const update = () => {
    for (const link of document.querySelectorAll('li.nav-type > a.type-link[href]')) {
      const path = new URL(link.href, document.baseURI).pathname;
      const marker = `/explorer/${prefix}/`;
      if (!path.includes(marker)) continue;
      const parts = path.split(marker)[1].split('/');
      const page = prefix==='dns-manager' && parts[0]==='zones' && parts[1] ? `zone:${decodeURIComponent(parts[1])}` : parts[0];
      const count = link.querySelector('[data-testid="type-count"]');
      if (count) {
        count.classList.add('rcui-nav-count');
        for (const tone of ['error','warning','success']) count.classList.toggle(tone, getTones()[page]===tone);
      }
      link.parentElement.classList.toggle('rcui-nav-after', page==='overview');
      link.parentElement.classList.toggle('rcui-nav-before', ['pending','pending-rollouts'].includes(page));
    }
  };
  const observer = new MutationObserver(update);
  // Observe additions/text counts only; our own attribute changes cannot loop.
  observer.observe(document.body, {childList:true,subtree:true,characterData:true});
  update();
  return {update,destroy:()=>observer.disconnect()};
}
