let pendingInstall;
const button = document.querySelector('#install-app');
const help = document.querySelector('#install-help');
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function update() { button.hidden = installed(); }
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); pendingInstall = event; update();
});
window.addEventListener('appinstalled', () => { pendingInstall = null; update(); help.hidden = true; });
button.addEventListener('click', async () => {
  if (pendingInstall) {
    const prompt = pendingInstall; pendingInstall = null;
    await prompt.prompt(); await prompt.userChoice; update();
  } else {
    help.hidden = !help.hidden;
    help.querySelector('p').textContent = /iPad|iPhone|iPod/.test(navigator.userAgent)
      ? 'В Safari нажмите «Поделиться», затем «На экран Домой» и «Добавить».'
      : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран». Если такого пункта нет, откройте сайт в Chrome или Safari.';
    button.setAttribute('aria-expanded', String(!help.hidden));
  }
});
help.querySelector('button').addEventListener('click', () => { help.hidden = true; button.setAttribute('aria-expanded', 'false'); button.focus(); });
update();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(() => {});
