import {currentAuth} from './auth.js';

const root = document.querySelector('#screen');
const accountScope = () => currentAuth()?.user?.id || 'demo';
const workspaceOrigin = () => {
  const origin = history.state?.workspaceOrigin;
  return origin?.target === location.hash && origin.account === accountScope() ? origin : null;
};

export function workspaceState() {
  const state = history.state?.workspace;
  return state?.hash === location.hash && state.account === accountScope() ? state : null;
}

function remember(link) {
  const filters = root.querySelector('#feed-filter');
  const draft = root.querySelector('#bid-form, #customer-form, #worker-profile');
  const focus = link.dataset.viewKey || link.getAttribute('href');
  return {
    hash: location.hash,
    account: accountScope(),
    scroll: window.scrollY,
    focus,
    filters: filters ? Array.from(new FormData(filters)) : null,
    draft: draft ? {id: draft.id, values: Array.from(new FormData(draft)),
      expanded: Array.from(draft.querySelectorAll('details'), panel => panel.open)} : null,
    galleries: Object.fromEntries(Array.from(root.querySelectorAll('[data-gallery]'), node =>
      [node.dataset.gallery, node.scrollLeft])),
    openBid: root.querySelector('.bid-details')?.open,
    openBio: root.querySelector('.bio-toggle')?.getAttribute('aria-expanded') === 'true'
  };
}

export function openWorkspaceLink(event, link) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.target || !link.hash || link.hash === location.hash) return;
  if (link.matches('.screen-heading a, [data-workspace-back]')) {
    event.preventDefault();
    if (workspaceOrigin()) history.back();
    else location.replace(link.hash);
    return;
  }
  if (!link.matches('#screen a, #bottom-nav a, #workspace-saved, #switch-role')) return;
  const target = link.hash;
  if (target === '#admin' || target === '#catalog') return;
  event.preventDefault();
  openWorkspaceRoute(target, link);
}

export function openWorkspaceRoute(target, trigger) {
  const workspace = remember(trigger);
  history.replaceState({...history.state, workspace}, '');
  location.hash = target;
  history.replaceState({workspaceOrigin: {target: location.hash, source: workspace.hash, account: workspace.account}}, '');
}

export function replaceWorkspaceRoute(target) {
  const state = {...history.state};
  if (workspaceOrigin()) {
    state.workspaceOrigin = {...state.workspaceOrigin, target};
  }
  delete state.workspace;
  history.replaceState(state, '', target);
}

export function finishWorkspaceEdit(target) {
  if (workspaceOrigin()?.source === target) {
    history.back();
    return true;
  }
  replaceWorkspaceRoute(target);
  return false;
}

export function restoreWorkspace() {
  const snapshot = workspaceState();
  if (!snapshot) return false;
  for (const gallery of root.querySelectorAll('[data-gallery]')) {
    const left = snapshot.galleries?.[gallery.dataset.gallery];
    if (left) gallery.scrollLeft = left;
  }
  const draft = root.querySelector('#bid-form, #customer-form, #worker-profile');
  if (draft && snapshot.draft?.id === draft.id) {
    const values = new URLSearchParams(snapshot.draft.values);
    for (const field of draft.querySelectorAll('input[name], select[name], textarea[name]')) {
      if (field.type === 'checkbox') field.checked = values.getAll(field.name).includes(field.value);
      else if (!field.readOnly && values.has(field.name)) field.value = values.get(field.name);
    }
    draft.querySelectorAll('details').forEach((panel, index) => {panel.open = snapshot.draft.expanded[index];});
  }
  const bid = root.querySelector('.bid-details');
  if (bid && snapshot.openBid) bid.open = true;
  const bio = root.querySelector('.bio-toggle');
  if (bio && snapshot.openBio && bio.getAttribute('aria-expanded') === 'false') bio.click();
  const link = [...document.querySelectorAll('#screen a, #screen button[data-view-key], #bottom-nav a, #workspace-saved, #switch-role')]
    .find(node => (node.dataset.viewKey || node.getAttribute('href')) === snapshot.focus);
  link?.focus({preventScroll: true});
  window.scrollTo(0, snapshot.scroll);
  return true;
}

export function replaceWorkspaceParams(params, preserveView = false) {
  const hash = location.hash.split('?')[0] || '#market';
  const next = hash + (params.size ? '?' + params : '');
  const state = {...history.state};
  if (workspaceOrigin()) state.workspaceOrigin = {...state.workspaceOrigin, target: next};
  if (preserveView) state.workspace = {...remember(document.activeElement), hash: next};
  else if (state.workspace?.hash !== next) delete state.workspace;
  history.replaceState(state, '', next);
}
