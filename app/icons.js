const paths = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z',
  search: 'M16 10.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Zm-1.5 4L21 21',
  add: 'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm4 5v8m-4-4h8',
  edit: 'm5 16 1-4L16 2l5 5-10 10-4 1zM14 4l5 5M4 21h16',
  folder: 'M3 7h7l2 2h9v11H3zm0 0V5h7l2 2h7v2',
  helmet: 'M10 9V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4M10 6a7 7 0 0 0-5 7v2m9-9a7 7 0 0 1 5 7v2M4 15h16a2 2 0 0 1 0 4H4a2 2 0 0 1 0-4z',
  person: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-1a8 8 0 0 1 16 0v1',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  filter: 'M4 6h16M7 12h10m-7 6h4M8 4v4m8 2v4m-4 2v4',
  grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  star: 'm12 3 2.7 5.6 6.3.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.5l6.3-.9z',
  tools: 'm14 6 4 4m-8-4 4-4 7 7-4 4-3-3L5 20l-2-2 10-9z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  more: 'M5 12h.01M12 12h.01M19 12h.01'
};

export function icon(name) {
  return '<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="' + paths[name] + '"/></svg>';
}
