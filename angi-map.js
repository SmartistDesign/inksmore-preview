/* ANGI learning profile. The source positions and six-metric demo are unchanged. */
(() => {
  'use strict';

  const root = document.querySelector('[data-angi-map]');
  if (!root) return;
  const svg = root.querySelector('[data-angi-canvas]');
  const stage = root.querySelector('.angi-stage');
  const card = root.querySelector('[data-angi-card]');
  const list = root.querySelector('[data-angi-list]');
  const status = root.querySelector('[data-angi-status]');
  const announcement = root.querySelector('[data-angi-announcement]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const NS = 'http://www.w3.org/2000/svg';
  const DATA_URL = new URL('assets/angi-profile-demo.json', document.currentScript.src);
  const W = 1100;
  let H = 700, cx = 550, cy = 350, screenScale = 1;
  let nodes = [], edges = [], domains = [], recommended = new Set();
  let nodeById, viewport, edgeLayer, nodeLayer;
  let activeId = null, pinnedId = null, hoverId = null, focusId = null;
  let domainFilter = null, nextOnly = false, listMode = false, explore = false;
  let hoverTimer, leaveTimer, cardHovered = false, returnFocus = null, suppressFocus = false;
  let visibleIds = new Set(), defaultLabels = new Set(), focusedConnections = new Set();
  let motionEnabled = !reducedMotion.matches, inView = false, entranceDone = false;
  let frame = 0, entranceStarted = null, entranceProgress = 1, lastFrame = 0;
  let pointer = null, drag = null, suppressClick = false;
  let zoom = 1, panX = 0, panY = 0;
  let resizeObserver, observer;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const el = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const shape = (tag, attributes = {}) => {
    const element = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  };
  const announce = text => { if (announcement) announcement.textContent = text; };
  const isMobile = () => !finePointer.matches || innerWidth < 680;
  const buttonState = (selector, on) => root.querySelector(selector)?.setAttribute('aria-pressed', String(on));

  function skillNeighbours(id, prerequisitesOnly = false) {
    const result = new Set([id]);
    for (const edge of edges) {
      if (edge.data.type === 'profile_link') continue;
      if (prerequisitesOnly) {
        if (edge.data.type === 'prerequisite' && edge.data.target === id) result.add(edge.data.source);
      } else if (edge.data.source === id) result.add(edge.data.target);
      else if (edge.data.target === id) result.add(edge.data.source);
    }
    return result;
  }

  function setFilter(domainId) {
    domainFilter = domainFilter === domainId ? null : domainId;
    nextOnly = false;
    buttonState('[data-angi-next]', false);
    clearSelection(false);
    updateVisibility();
    announce(domainFilter ? `${domains.find(item => item.id === domainFilter).label} and connected skills.` : 'All 42 skills shown.');
  }

  function renderFilters() {
    const filters = root.querySelector('[data-angi-filters]');
    filters.replaceChildren();
    const all = el('button', 'angi-filter', 'All skills');
    all.type = 'button';
    all.dataset.domain = 'all';
    all.setAttribute('aria-pressed', 'true');
    all.addEventListener('click', () => setFilter(null));
    filters.append(all);
    for (const domain of domains) {
      const button = el('button', 'angi-filter');
      button.type = 'button';
      button.dataset.domain = domain.id;
      button.setAttribute('aria-pressed', 'false');
      const dot = el('span', 'angi-filter-dot');
      dot.style.background = domain.color;
      dot.setAttribute('aria-hidden', 'true');
      button.append(dot, document.createTextNode(domain.label));
      button.addEventListener('click', () => setFilter(domain.id));
      filters.append(button);
    }
  }

  function wrapLabel(label) {
    if (label.length <= 18) return [label];
    const words = label.split(' ');
    let best = 1;
    for (let index = 1; index < words.length; index++) {
      if (Math.abs(words.slice(0, index).join(' ').length - words.slice(index).join(' ').length) <
          Math.abs(words.slice(0, best).join(' ').length - words.slice(best).join(' ').length)) best = index;
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }

  function renderGraph(data) {
    const defs = shape('defs');
    const arrow = shape('marker', {id: 'angi-prerequisite-arrow', viewBox: '0 0 8 8', refX: 7, refY: 4,
      markerWidth: 5, markerHeight: 5, orient: 'auto', markerUnits: 'strokeWidth'});
    arrow.append(shape('path', {d: 'M0 0 L8 4 L0 8 Z', fill: '#52706b'}));
    defs.append(arrow);
    viewport = shape('g', {class: 'angi-viewport'});
    edgeLayer = shape('g', {class: 'angi-edges', 'aria-hidden': 'true'});
    nodeLayer = shape('g', {class: 'angi-nodes'});
    viewport.append(edgeLayer, nodeLayer);
    svg.replaceChildren(defs, viewport);
    nodes = data.nodes.map(dataNode => ({
      data: dataNode, x: 0, y: 0, initialX: 0, initialY: 0, dx: 0, dy: 0,
      color: domains.find(domain => domain.id === dataNode.domain)?.color || '#3b6660',
      lines: wrapLabel(dataNode.label)
    }));
    nodeById = new Map(nodes.map(node => [node.data.id, node]));
    edges = data.edges.map(dataEdge => {
      const line = shape('line', {class: 'angi-edge', 'data-edge-id': dataEdge.id,
        'data-type': dataEdge.type, 'vector-effect': 'non-scaling-stroke'});
      line.style.pointerEvents = 'none';
      edgeLayer.append(line);
      return {data: dataEdge, line, source: nodeById.get(dataEdge.source), target: nodeById.get(dataEdge.target)};
    });
    for (const domain of domains) defaultLabels.add(nodes.find(node => node.data.domain === domain.id)?.data.id);
    for (const id of recommended) defaultLabels.add(id);
    for (const node of nodes) {
      const {data: item} = node;
      const learner = item.type === 'learner';
      const group = shape('g', {class: `angi-node${learner ? ' angi-learner' : ''}${recommended.has(item.id) ? ' is-recommended' : ''}${item.metrics?.mastery === null ? ' is-unexplored' : ''}`,
        'data-node-id': item.id, tabindex: 0, role: 'button', 'aria-pressed': 'false',
        'aria-label': learner ? `${item.label}, ${item.ageLabel}, Male. Open profile.` : `${item.label}, ${domains.find(domain => domain.id === item.domain).label}. Open skill metrics.`});
      group.style.setProperty('--angi-color', node.color);
      const hit = shape('circle', {class: 'angi-hit', fill: 'transparent', 'pointer-events': 'all'});
      const visual = shape('g', {class: 'angi-node-visual', 'pointer-events': 'none'});
      const dot = shape('circle', {class: 'angi-dot', fill: learner ? '#f5f2e9' : (item.metrics.mastery === null ? '#faf8f3' : node.color), stroke: node.color, 'vector-effect': 'non-scaling-stroke'});
      if (item.metrics?.mastery === null) dot.setAttribute('stroke-dasharray', '2.5 2.5');
      visual.append(dot);
      if (learner) {
        const name = shape('text', {class: 'angi-learner-name', 'text-anchor': 'middle', fill: '#263633'});
        name.textContent = item.label;
        const meta = shape('text', {class: 'angi-learner-meta', 'text-anchor': 'middle', fill: '#65736b'});
        meta.textContent = `${item.ageLabel} · Male`;
        visual.append(name, meta);
        node.name = name; node.meta = meta;
      } else {
        const track = shape('circle', {class: 'angi-progress-track', fill: 'none', stroke: node.color, 'stroke-opacity': '.14', 'vector-effect': 'non-scaling-stroke'});
        const progress = shape('circle', {class: 'angi-progress', fill: 'none', stroke: node.color, 'vector-effect': 'non-scaling-stroke'});
        if (item.metrics.mastery === null) { track.style.display = 'none'; progress.style.display = 'none'; }
        visual.append(track, progress);
        const label = shape('text', {class: 'angi-node-label', fill: '#3f514b', 'aria-hidden': 'true'});
        for (const line of node.lines) {
          const span = shape('tspan'); span.textContent = line; label.append(span);
        }
        visual.append(label);
        node.track = track; node.progress = progress; node.label = label;
      }
      group.append(hit, visual);
      nodeLayer.append(group);
      Object.assign(node, {group, hit, visual, dot});
      group.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse' || drag || isMobile()) return;
        hoverId = item.id;
        clearTimeout(leaveTimer); clearTimeout(hoverTimer);
        if (!pinnedId) hoverTimer = setTimeout(() => setActive(item.id, 'hover', group), 120);
      });
      group.addEventListener('pointerleave', event => {
        if (event.pointerType !== 'mouse') return;
        if (hoverId === item.id) hoverId = null;
        clearTimeout(hoverTimer);
        scheduleClose();
      });
      group.addEventListener('focus', () => {
        if (suppressFocus) return;
        focusId = item.id;
        pinnedId = null;
        setActive(item.id, 'focus', group);
      });
      group.addEventListener('blur', event => {
        if (focusId === item.id) focusId = null;
        if (!card.contains(event.relatedTarget)) scheduleClose();
      });
      group.addEventListener('click', event => {
        if (suppressClick) { event.preventDefault(); return; }
        pin(item.id, group);
      });
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pin(item.id, group); }
      });
    }
  }

  function renderList() {
    for (const domain of domains) {
      const group = el('section', 'angi-list-group');
      group.dataset.domain = domain.id;
      const heading = el('h3', '', domain.label);
      heading.style.setProperty('--angi-color', domain.color);
      const ul = el('ul');
      for (const node of nodes.filter(item => item.data.domain === domain.id)) {
        const li = el('li');
        const button = el('button', 'angi-list-skill', node.data.label);
        button.type = 'button';
        button.dataset.skillId = node.data.id;
        button.style.setProperty('--angi-color', domain.color);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => pin(node.data.id, button));
        button.addEventListener('focus', () => {
          if (suppressFocus) return;
          focusId = node.data.id; pinnedId = null;
          setActive(node.data.id, 'focus', button);
        });
        button.addEventListener('blur', event => {
          focusId = null;
          if (!card.contains(event.relatedTarget)) scheduleClose();
        });
        li.append(button); ul.append(li); node.listItem = li; node.listButton = button;
      }
      group.append(heading, ul); list.append(group);
    }
  }

  function updateVisibility() {
    const learnerId = nodes.find(node => node.data.type === 'learner').data.id;
    visibleIds = new Set([learnerId]);
    if (nextOnly) {
      for (const id of recommended) for (const neighbour of skillNeighbours(id, true)) visibleIds.add(neighbour);
    } else if (domainFilter) {
      for (const node of nodes.filter(item => item.data.domain === domainFilter)) {
        for (const neighbour of skillNeighbours(node.data.id)) visibleIds.add(neighbour);
      }
    } else nodes.forEach(node => visibleIds.add(node.data.id));
    for (const node of nodes) {
      const visible = visibleIds.has(node.data.id);
      node.group.style.display = visible ? '' : 'none';
      node.group.setAttribute('tabindex', visible ? '0' : '-1');
      if (node.listItem) node.listItem.hidden = !visible;
    }
    for (const group of list.querySelectorAll('.angi-list-group')) {
      group.hidden = ![...group.querySelectorAll('li')].some(item => !item.hidden);
    }
    root.querySelectorAll('.angi-filter').forEach(button => button.setAttribute('aria-pressed', String(!nextOnly && (button.dataset.domain === (domainFilter || 'all')))));
    updateHighlight();
    layoutLabels();
  }

  function updateHighlight() {
    const selected = nodeById.get(activeId);
    const learnerActive = selected?.data.type === 'learner';
    focusedConnections = new Set(activeId ? [activeId] : []);
    if (activeId) for (const edge of edges) {
      if (edge.data.source === activeId || edge.data.target === activeId) {
        focusedConnections.add(edge.data.source); focusedConnections.add(edge.data.target);
      }
    }
    for (const node of nodes) {
      const related = !activeId || focusedConnections.has(node.data.id);
      node.group.classList.toggle('is-active', node.data.id === activeId);
      node.group.classList.toggle('is-muted', !related);
      node.group.style.opacity = related ? '1' : '.25';
      node.group.setAttribute('aria-pressed', String(node.data.id === pinnedId));
      node.listButton?.setAttribute('aria-pressed', String(node.data.id === pinnedId));
    }
    for (const edge of edges) {
      const direct = !!activeId && (edge.data.source === activeId || edge.data.target === activeId);
      const visible = visibleIds.has(edge.data.source) && visibleIds.has(edge.data.target) &&
        (edge.data.defaultVisible || learnerActive || direct);
      edge.line.style.display = visible ? '' : 'none';
      edge.line.classList.toggle('is-active', direct);
      edge.line.classList.toggle('is-muted', !!activeId && !direct);
      edge.line.style.stroke = direct ? '#52706b' : (edge.data.type === 'profile_link' ? '#c6ccc2' : '#aebbb2');
      edge.line.style.strokeWidth = direct ? '1.45' : '1';
      edge.line.style.opacity = activeId ? (direct ? '.86' : '.19') : (edge.data.type === 'profile_link' ? '.48' : '.6');
      if (direct && edge.data.type === 'prerequisite') edge.line.setAttribute('marker-end', 'url(#angi-prerequisite-arrow)');
      else edge.line.removeAttribute('marker-end');
    }
    root.classList.toggle('is-pinned', !!pinnedId);
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${value}T12:00:00Z`));
  }

  function renderCard(node) {
    const item = node.data;
    card.replaceChildren();
    card.dataset.nodeId = item.id;
    card.style.setProperty('--angi-color', node.color);
    const close = el('button', 'angi-card-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Close skill card');
    close.addEventListener('click', () => clearSelection(true));
    const eyebrow = el('p', 'angi-card-domain', item.type === 'learner' ? 'Example learning profile' : domains.find(domain => domain.id === item.domain).label);
    const title = el('h3', 'angi-card-title', item.label);
    title.id = 'angi-current-skill';
    card.setAttribute('aria-labelledby', title.id);
    card.append(close, eyebrow, title);
    if (item.type === 'learner') {
      const details = el('dl', 'angi-profile-details');
      for (const [label, value] of [['Name', item.label], ['Age', item.ageLabel], ['Gender', 'Male']]) {
        const row = el('div', 'angi-metric'); row.append(el('dt', '', label), el('dd', '', value)); details.append(row);
      }
      card.append(details);
    } else {
      const m = item.metrics;
      if (m.mastery === null) card.append(el('span', 'angi-card-badge', 'Not explored'));
      const confidence = {high: 'High', medium: 'Medium', low: 'Limited', limited: 'Limited', not_assessed: 'Not assessed'};
      const metrics = el('dl', 'angi-metrics');
      const rows = [['Mastery', m.mastery === null ? '—' : `${m.mastery}%`], ['Confidence', confidence[m.assessmentConfidence] || 'Not assessed'],
        ['Questions', String(m.questionsPracticed)], ['Sessions', String(m.practiceSessions)],
        ['Independent', m.independentCompletionRate === null ? '—' : `${m.independentCompletionRate}%`], ['Last practiced', formatDate(m.lastPracticed)]];
      rows.forEach(([label, value], index) => {
        const row = el('div', 'angi-metric');
        const dt = el('dt', '', label), dd = el('dd', '', value);
        if (index === 1) dt.title = 'How much evidence supports this estimate.';
        row.append(dt, dd);
        if (index === 0 && m.mastery !== null) {
          const track = el('span', 'angi-mastery-track');
          track.setAttribute('aria-hidden', 'true');
          const bar = el('span', 'angi-mastery-value'); bar.style.width = `${m.mastery}%`;
          track.append(bar); row.append(track);
        }
        metrics.append(row);
      });
      card.append(metrics);
    }
    card.hidden = false;
  }

  function setActive(id, reason, origin) {
    if (!visibleIds.has(id)) return;
    clearTimeout(leaveTimer); clearTimeout(hoverTimer);
    activeId = id;
    returnFocus = origin || nodeById.get(id).group;
    const node = nodeById.get(id);
    // The selected dot and its hit target stay together while the card is open.
    node.dx = 0; node.dy = 0;
    renderCard(node);
    updateHighlight(); draw(); layoutLabels(); positionCard();
    if (reason !== 'hover') {
      const values = [...card.querySelectorAll('.angi-metric')].map(row =>
        `${row.querySelector('dt').textContent}: ${row.querySelector('dd').textContent.replace(/—/g, 'not available')}`);
      announce(`${node.data.label}${reason === 'pin' ? ' selected.' : '.'} ${values.join('. ')}.`);
    }
  }

  function pin(id, origin) {
    pinnedId = id; focusId = null;
    setActive(id, 'pin', origin);
  }

  function scheduleClose() {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (!pinnedId && !hoverId && !focusId && !cardHovered && !card.contains(document.activeElement)) clearSelection(false);
    }, 150);
  }

  function clearSelection(restoreFocus) {
    clearTimeout(leaveTimer); clearTimeout(hoverTimer);
    activeId = null; pinnedId = null; hoverId = null; focusId = null; cardHovered = false;
    card.hidden = true;
    if (nodeById) { updateHighlight(); layoutLabels(); }
    if (restoreFocus && returnFocus?.isConnected) {
      suppressFocus = true; returnFocus.focus({preventScroll: true}); suppressFocus = false;
      announce('Skill card closed.');
    }
    wake();
  }

  function positionCard() {
    if (card.hidden || listMode || !activeId) return;
    const node = nodeById.get(activeId);
    const rect = stage.getBoundingClientRect();
    const width = card.offsetWidth, height = card.offsetHeight;
    if (isMobile()) {
      card.style.left = '12px'; card.style.right = '12px';
      card.style.top = 'auto'; card.style.bottom = '12px';
      return;
    }
    const location = toClient(node.x, node.y);
    const px = location.x - rect.left, py = location.y - rect.top;
    let left = px + 22;
    if (left + width > rect.width - 16) left = px - width - 22;
    const top = clamp(py - 50, 16, Math.max(16, rect.height - height - 16));
    card.style.left = `${clamp(left, 16, Math.max(16, rect.width - width - 16))}px`;
    card.style.top = `${top}px`; card.style.right = 'auto'; card.style.bottom = 'auto';
  }

  function toClient(x, y) {
    const matrix = viewport.getScreenCTM();
    return new DOMPoint(x, y).matrixTransform(matrix);
  }
  function fromClient(x, y) {
    return new DOMPoint(x, y).matrixTransform(viewport.getScreenCTM().inverse());
  }

  function geometry() {
    const matrix = viewport.getScreenCTM();
    if (!matrix) return;
    screenScale = Math.max(.1, Math.hypot(matrix.a, matrix.b));
    for (const node of nodes) {
      const learner = node.data.type === 'learner';
      const radius = (learner ? (isMobile() ? 33 : 44) : (recommended.has(node.data.id) ? 7 : 5.5)) / screenScale;
      node.radius = radius;
      node.hit.setAttribute('r', learner ? radius + 2 / screenScale : (isMobile() ? 22 : 14) / screenScale);
      node.dot.setAttribute('r', radius);
      node.dot.style.strokeWidth = learner ? '1.1' : '1';
      if (learner) {
        node.name.style.fontSize = `${14 / screenScale}px`; node.name.setAttribute('y', 5 / screenScale);
        node.meta.style.fontSize = `${10.5 / screenScale}px`; node.meta.setAttribute('y', (isMobile() ? 50 : 62) / screenScale);
        node.meta.style.strokeWidth = `${4 / screenScale}px`;
      } else {
        const r = radius + 4 / screenScale;
        node.track.setAttribute('r', r); node.progress.setAttribute('r', r);
        node.progress.setAttribute('transform', 'rotate(-90)');
        const circumference = Math.PI * 2 * r;
        const amount = (node.data.metrics.mastery || 0) / 100;
        node.progress.setAttribute('stroke-dasharray', `${circumference * amount} ${circumference}`);
        node.track.style.strokeWidth = '.9'; node.progress.style.strokeWidth = '1.25';
        node.label.style.fontSize = `${12 / screenScale}px`;
        node.label.style.strokeWidth = `${4 / screenScale}px`;
      }
    }
  }

  function updateTransform() {
    viewport.setAttribute('transform', `translate(${cx + panX} ${cy + panY}) scale(${zoom}) translate(${-cx} ${-cy})`);
    geometry(); draw(); layoutLabels(); positionCard();
    const zoomIn = root.querySelector('[data-angi-zoom-in]');
    const zoomOut = root.querySelector('[data-angi-zoom-out]');
    if (zoomIn) zoomIn.disabled = zoom >= 2.4;
    if (zoomOut) zoomOut.disabled = zoom <= .75;
  }

  function resize() {
    if (!nodes.length || listMode) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    H = W * rect.height / rect.width;
    cx = W / 2; cy = H / 2;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const maxX = Math.max(...nodes.map(node => Math.abs(node.data.layout.x)));
    const maxY = Math.max(...nodes.map(node => Math.abs(node.data.layout.y)));
    const fit = Math.min((W / 2 - (isMobile() ? 50 : 100)) / maxX, (H / 2 - 85) / maxY);
    for (const node of nodes) {
      const movedX = node.initialX ? node.x - node.initialX : 0;
      const movedY = node.initialY ? node.y - node.initialY : 0;
      node.initialX = cx + node.data.layout.x * fit;
      node.initialY = cy + node.data.layout.y * fit;
      node.x = node.initialX + movedX; node.y = node.initialY + movedY;
      node.dx = 0; node.dy = 0;
    }
    updateTransform();
  }

  function layoutLabels() {
    if (!nodeById || !viewport || listMode || !viewport.getScreenCTM()) return;
    const rect = svg.getBoundingClientRect();
    const points = nodes.filter(node => visibleIds.has(node.data.id)).map(node => ({
      node, point: toClient(node.x, node.y), radius: node.data.type === 'learner' ? (isMobile() ? 37 : 48) : 9
    }));
    const occupied = points.filter(item => item.node.data.type === 'learner').map(item => ({
      left: item.point.x - (isMobile() ? 50 : 76), right: item.point.x + (isMobile() ? 50 : 76), top: item.point.y - item.radius, bottom: item.point.y + (isMobile() ? 55 : 68)
    }));
    const candidates = nodes.filter(node => node.label).sort((a, b) => {
      const priority = node => node.data.id === activeId ? 100 : recommended.has(node.data.id) ? 30 : defaultLabels.has(node.data.id) ? 20 : 0;
      return priority(b) - priority(a);
    });
    const intersects = (a, b) => a.left < b.right + 5 && a.right > b.left - 5 && a.top < b.bottom + 4 && a.bottom > b.top - 4;
    for (const node of candidates) {
      const selected = node.data.id === activeId;
      const wanted = visibleIds.has(node.data.id) && (selected || defaultLabels.has(node.data.id) ||
        domainFilter || nextOnly || zoom >= 1.4 || (activeId && focusedConnections.has(node.data.id)));
      node.label.style.display = wanted ? '' : 'none';
      if (!wanted) continue;
      const point = toClient(node.x, node.y);
      const width = Math.max(...node.lines.map(line => line.length)) * 6.35;
      const height = node.lines.length * 15;
      const candidates = [
        {left: point.x + 17, top: point.y - height / 2},
        {left: point.x - width - 17, top: point.y - height / 2},
        {left: point.x - width / 2, top: point.y + 17},
        {left: point.x - width / 2, top: point.y - height - 17}
      ].map(box => ({...box, right: box.left + width, bottom: box.top + height}));
      const fits = box => box.left >= rect.left + 10 && box.right <= rect.right - 10 && box.top >= rect.top + 10 && box.bottom <= rect.bottom - 10;
      let box = candidates.find(box => fits(box) && !occupied.some(other => intersects(box, other)) && !points.some(other =>
        other.node !== node && intersects(box, {left: other.point.x - other.radius, right: other.point.x + other.radius,
          top: other.point.y - other.radius, bottom: other.point.y + other.radius})));
      if (!box && selected) box = candidates.find(fits) || candidates[0];
      if (!box) { node.label.style.display = 'none'; continue; }
      occupied.push(box);
      const x = (box.left - point.x) / screenScale;
      const y = (box.top - point.y + 11.5) / screenScale;
      [...node.label.children].forEach((span, index) => {
        span.setAttribute('x', x); span.setAttribute('y', y + index * 15 / screenScale);
      });
    }
  }

  function draw() {
    const ease = 1 - Math.pow(1 - entranceProgress, 3);
    for (const node of nodes) {
      node.drawX = cx + (node.x - cx) * (.92 + .08 * ease) + node.dx;
      node.drawY = cy + (node.y - cy) * (.92 + .08 * ease) + node.dy;
      node.group.setAttribute('transform', `translate(${node.x} ${node.y})`);
      node.visual.setAttribute('transform', `translate(${node.drawX - node.x} ${node.drawY - node.y})`);
    }
    for (const edge of edges) {
      const a = edge.source, b = edge.target;
      const dx = b.drawX - a.drawX, dy = b.drawY - a.drawY;
      const length = Math.max(1, Math.hypot(dx, dy));
      const start = Math.min((a.radius || 6) + 3 / screenScale, length / 2);
      const end = Math.min((b.radius || 6) + 4 / screenScale, length / 2);
      edge.line.setAttribute('x1', a.drawX + dx / length * start);
      edge.line.setAttribute('y1', a.drawY + dy / length * start);
      edge.line.setAttribute('x2', b.drawX - dx / length * end);
      edge.line.setAttribute('y2', b.drawY - dy / length * end);
    }
    viewport.style.opacity = String(.25 + .75 * ease);
  }

  function canAnimate() { return motionEnabled && !reducedMotion.matches && inView && !document.hidden && !listMode; }

  function tick(now) {
    frame = 0;
    if (!canAnimate()) return;
    const delta = lastFrame ? Math.min(50, now - lastFrame) : 16;
    lastFrame = now;
    const smoothing = 1 - Math.exp(-delta / 90);
    let unsettled = false;
    if (entranceStarted !== null) {
      entranceProgress = Math.min(1, (now - entranceStarted) / 700);
      if (entranceProgress < 1) unsettled = true;
      else { entranceStarted = null; entranceDone = true; }
    }
    for (const node of nodes) {
      let tx = 0, ty = 0;
      if (pointer && node.data.type !== 'learner' && node.data.id !== activeId && node.data.id !== focusId &&
          visibleIds.has(node.data.id) && !drag && entranceStarted === null) {
        const dx = pointer.x - node.x, dy = pointer.y - node.y;
        const distance = Math.hypot(dx, dy) * screenScale;
        if (distance < 125 && distance > .01) {
          const amplitude = 4 * Math.pow(1 - distance / 125, 2) / screenScale;
          const angle = Math.atan2(dy, dx);
          tx = Math.cos(angle) * amplitude; ty = Math.sin(angle) * amplitude;
        }
      }
      node.dx += (tx - node.dx) * smoothing; node.dy += (ty - node.dy) * smoothing;
      if (Math.abs(tx - node.dx) * screenScale > .025 || Math.abs(ty - node.dy) * screenScale > .025) unsettled = true;
      else { node.dx = tx; node.dy = ty; }
    }
    draw();
    if (unsettled) frame = requestAnimationFrame(tick);
    else lastFrame = 0;
  }

  function wake() {
    if (canAnimate() && !frame) frame = requestAnimationFrame(tick);
  }

  function settleMotion() {
    cancelAnimationFrame(frame); frame = 0; lastFrame = 0;
    pointer = null;
    nodes.forEach(node => { node.dx = 0; node.dy = 0; });
    if (entranceStarted !== null) { entranceStarted = null; entranceProgress = 1; entranceDone = true; }
    if (nodes.length) draw();
  }

  function syncMotionButton() {
    const button = root.querySelector('[data-angi-motion]');
    const enabled = motionEnabled && !reducedMotion.matches;
    button?.setAttribute('aria-pressed', String(enabled));
    button?.setAttribute('aria-label', enabled ? 'Pause map motion' : 'Enable map motion');
    button?.setAttribute('title', enabled ? 'Pause map motion' : 'Enable map motion');
    button?.classList.toggle('is-paused', !enabled);
  }

  function reset() {
    zoom = 1; panX = 0; panY = 0;
    for (const node of nodes) { node.x = node.initialX; node.y = node.initialY; node.dx = 0; node.dy = 0; }
    clearSelection(false); updateTransform(); announce('Map view reset.');
  }

  function wireInteractions() {
    card.addEventListener('pointerenter', () => { cardHovered = true; clearTimeout(leaveTimer); });
    card.addEventListener('pointerleave', () => { cardHovered = false; scheduleClose(); });
    card.addEventListener('focusin', () => clearTimeout(leaveTimer));
    card.addEventListener('focusout', event => { if (!card.contains(event.relatedTarget)) scheduleClose(); });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activeId) { event.preventDefault(); clearSelection(true); }
    });
    root.querySelector('[data-angi-next]')?.addEventListener('click', () => {
      nextOnly = !nextOnly; domainFilter = null;
      buttonState('[data-angi-next]', nextOnly); clearSelection(false); updateVisibility();
      announce(nextOnly ? 'Three next steps and their prerequisite foundations.' : 'All 42 skills shown.');
    });
    root.querySelector('[data-angi-list-toggle]')?.addEventListener('click', event => {
      clearSelection(false); settleMotion();
      listMode = !listMode; list.hidden = !listMode;
      root.classList.toggle('is-list-view', listMode);
      event.currentTarget.setAttribute('aria-pressed', String(listMode));
      event.currentTarget.textContent = listMode ? 'Map view' : 'List view';
      card.style.left = ''; card.style.right = ''; card.style.top = ''; card.style.bottom = '';
      if (listMode) list.prepend(card);
      else { stage.append(card); resize(); }
      announce(listMode ? 'Skills shown as a list, grouped by domain.' : 'Interactive map shown.');
    });
    root.querySelector('[data-angi-motion]')?.addEventListener('click', () => {
      motionEnabled = !motionEnabled;
      if (!motionEnabled) settleMotion();
      syncMotionButton();
      announce(reducedMotion.matches ? 'Map motion remains off to respect your reduced motion preference.' : motionEnabled ? 'Map motion enabled.' : 'Map motion paused.');
    });
    root.querySelector('[data-angi-explore]')?.addEventListener('click', event => {
      explore = !explore;
      root.classList.toggle('is-exploring', explore);
      svg.style.touchAction = explore ? 'none' : 'pan-y';
      event.currentTarget.textContent = explore ? 'Done' : 'Explore map';
      event.currentTarget.setAttribute('aria-pressed', String(explore));
      announce(explore ? 'Map exploration enabled. Drag a skill or the background. Tap Done to scroll the page.' : 'Map exploration finished. Page scrolling enabled.');
    });
    root.querySelector('[data-angi-zoom-in]')?.addEventListener('click', () => { zoom = Math.min(2.4, +(zoom + .25).toFixed(2)); updateTransform(); });
    root.querySelector('[data-angi-zoom-out]')?.addEventListener('click', () => { zoom = Math.max(.75, +(zoom - .25).toFixed(2)); updateTransform(); });
    root.querySelector('[data-angi-reset]')?.addEventListener('click', reset);
    svg.style.touchAction = 'pan-y';
    svg.addEventListener('pointerdown', event => {
      if (drag || event.button !== 0 || (event.pointerType !== 'mouse' && !explore)) return;
      const group = event.target.closest('[data-node-id]');
      const node = group ? nodeById.get(group.dataset.nodeId) : null;
      if (node?.data.type === 'learner') return;
      const point = fromClient(event.clientX, event.clientY);
      drag = {pointerId: event.pointerId, node, startX: event.clientX, startY: event.clientY,
        worldX: point.x, worldY: point.y, x: node?.x, y: node?.y, panX, panY, moved: false};
    });
    svg.addEventListener('pointermove', event => {
      if (drag && drag.pointerId === event.pointerId) {
        if (event.pointerType === 'mouse' && event.buttons === 0) { finishDrag(event); return; }
        const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;
        if (!drag.moved) {
          drag.moved = true; clearTimeout(hoverTimer); clearSelection(false);
          svg.setPointerCapture(event.pointerId); root.classList.add('is-dragging');
        }
        event.preventDefault();
        if (drag.node) {
          drag.node.x = clamp(drag.x + dx / screenScale, cx - W, cx + W);
          drag.node.y = clamp(drag.y + dy / screenScale, cy - H, cy + H);
          drag.node.dx = 0; drag.node.dy = 0;
          draw(); layoutLabels();
        } else {
          const scale = svg.getBoundingClientRect().width / W;
          panX = clamp(drag.panX + dx / scale, -W * .9, W * .9);
          panY = clamp(drag.panY + dy / scale, -H * .9, H * .9);
          updateTransform();
        }
        return;
      }
      if (event.pointerType === 'mouse' && finePointer.matches && canAnimate()) {
        pointer = fromClient(event.clientX, event.clientY); wake();
      }
    });
    const finishDrag = event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const moved = drag.moved; drag = null;
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
      root.classList.remove('is-dragging');
      if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
      pointer = null; wake();
    };
    svg.addEventListener('pointerup', finishDrag);
    svg.addEventListener('pointercancel', finishDrag);
    svg.addEventListener('lostpointercapture', finishDrag);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    svg.addEventListener('pointerleave', () => { pointer = null; wake(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) settleMotion(); });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) { motionEnabled = false; settleMotion(); }
      syncMotionButton();
    });
    syncMotionButton();
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`Profile data returned ${response.status}`);
      const data = await response.json();
      if (data.schemaVersion !== '2.1' || data.nodes.length !== 43 || data.edges.length !== 96) throw new Error('Unexpected ANGI profile data.');
      domains = data.domains; recommended = new Set(data.recommendedSkillIds);
      renderFilters(); renderGraph(data); renderList();
      updateVisibility(); wireInteractions(); resize();
      root.classList.add('is-ready');
      if (status) status.hidden = true;
      resizeObserver = new ResizeObserver(() => resize()); resizeObserver.observe(stage);
      observer = new IntersectionObserver(entries => {
        const entry = entries[0]; inView = entry.isIntersecting;
        if (!inView) { settleMotion(); return; }
        if (!entranceDone && canAnimate()) {
          entranceStarted = performance.now(); entranceProgress = 0; draw(); wake();
        } else { entranceDone = true; entranceProgress = 1; draw(); }
      }, {threshold: .15});
      observer.observe(stage);
    } catch (error) {
      if (status) { status.hidden = false; status.textContent = 'The learning map could not load. Please refresh to try again.'; }
      console.error('ANGI learning profile:', error);
    }
  }
  init();
})();
