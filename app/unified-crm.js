import { accountKey } from "./account-storage.js";
export function mountUnifiedCRM(screen, { jobs, people, offers }) {
  const scope = accountKey("workspace");
  screen.innerHTML =
    '<iframe id="crm-workspace" title="Работы — объекты, задачи, команда и документы"></iframe>';
  const frame = screen.querySelector("iframe");
  const send = () =>
    frame.contentWindow?.postMessage(
      { type: "belkhi-crm-init", jobs, people, offers },
      location.origin,
    );
  const receive = (e) => {
    if (e.source !== frame.contentWindow || e.origin !== location.origin)
      return;
    if (e.data?.type === "belkhi-crm-ready") send();
    if (
      e.data?.type === "belkhi-crm-offer" &&
      offers.some((o) => o.id === e.data.id)
    )
      location.hash = "sent/" + encodeURIComponent(e.data.id);
    if (
      e.data?.type === "belkhi-crm-legacy" &&
      jobs.some((j) => j.id === e.data.id)
    )
      location.hash = "crm/" + encodeURIComponent(e.data.id);
  };
  window.addEventListener("message", receive);
  frame.src = "workspace-crm/?scope=" + encodeURIComponent(scope);
  new MutationObserver(function (_, observer) {
    if (!frame.isConnected) {
      window.removeEventListener("message", receive);
      observer.disconnect();
    }
  }).observe(screen, { childList: true });
}
