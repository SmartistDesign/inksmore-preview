/* ANGI skill marks. Original 24 x 24 line drawings; inherit the domain color. */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const path = (d, attrs) => ['path', Object.assign({ d }, attrs)];
  const circle = (cx, cy, r, attrs) => ['circle', Object.assign({ cx, cy, r }, attrs)];
  const rect = (x, y, width, height, rx) => ['rect', { x, y, width, height, rx: rx || 0 }];

  const marks = {
    // Math: counting frame, five objects, total, matching, comparison, joining.
    m01: [path('M4 5v14M20 5v14M4 8h16M4 16h16'), circle(8, 8, 2.1), circle(15, 16, 2.1)],
    m02: [circle(6, 6, 1.7), circle(18, 6, 1.7), circle(12, 12, 1.7), circle(6, 18, 1.7), circle(18, 18, 1.7)],
    m03: [path('M7 4H4v16h3M17 4h3v16h-3M8 12h8M12 8v8')],
    m04: [rect(3, 4, 7, 11, 1.5), rect(14, 9, 7, 11, 1.5), path('M6.5 8v3M17.5 13v3M13 4h5v2M6 18v2h5')],
    m05: [path('M12 4v16M8 20h8M4 8l16-3M4 8l-2 6h6L4 8M20 5l-2 6h6L20 5', { transform: 'translate(1 0) scale(.92 1)' })],
    m06: [circle(5, 5, 2), circle(19, 5, 2), circle(12, 19, 2.4), path('M5 9v2c0 3 7 1 7 5M19 9v2c0 3-7 1-7 5')],

    // Logic: matching shapes, sorting, rhythm, continuation, order, two criteria.
    l01: [rect(3, 4, 8, 11, 1.5), rect(13, 9, 8, 11, 1.5), path('m7 7-2 4h4L7 7m10 5-2 4h4l-2-4')],
    l02: [circle(7, 5, 2), rect(15, 3, 4, 4, .7), path('M12 9v5M5 20v-5h14v5M9 18l-2 2-2-2M19 18l-2 2-2-2')],
    l03: [circle(5, 7, 2), rect(10, 5, 4, 4, .5), circle(19, 7, 2), circle(5, 17, 2), rect(10, 15, 4, 4, .5), circle(19, 17, 2)],
    l04: [circle(4.5, 9, 2), rect(10, 7, 4, 4, .5), circle(19.5, 9, 2), path('M4 17h16m-3-3 3 3-3 3')],
    l05: [rect(3, 5, 4, 6, .8), rect(10, 9, 4, 6, .8), rect(17, 13, 4, 6, .8), path('M10 5h7v4m0 0-2-2m2 2 2-2')],
    l06: [rect(3, 3, 18, 18, 2), path('M12 3v18M3 12h18'), circle(7.5, 7.5, 1.6), path('m15 15 3 3m0-3-3 3')],

    // Phonics: listening, rhythm, first sound, letters, voiced letter, blending.
    p01: [path('M9 17c0 3-5 4-5 0 0-2 2-3 2-5a5 5 0 1 1 9 3M8 11a2.5 2.5 0 1 1 4.5 1.5M19 7a9 9 0 0 1 0 10')],
    p02: [path('M5 14V9m4 7V5m4 13V8m4 7V5m4 9V9M4 20h16'), circle(9, 3, .6, { fill: 'currentColor', stroke: 'none' })],
    p03: [path('M3 10h4l5-5v14l-5-5H3zM16 9a5 5 0 0 1 0 6'), circle(20, 6, 1.5)],
    p04: [circle(11, 13, 5), path('M16 8v10M5 21h14')],
    p05: [path('m3 17 4-12 4 12M4.5 13h5M15 9a4 4 0 0 1 0 6M18 5a9 9 0 0 1 0 14')],
    p06: [circle(4, 7, 1.6), circle(12, 7, 1.6), circle(20, 7, 1.6), path('M4 12c1 8 15 8 16 0M9 21h6')],

    // Hands-on: picking, two hands, paper fold, scissors, blocks, collage.
    h01: [circle(7, 6, 2.5), path('M12 4c4 0 6 2 6 6m-3-2 3 2 2-3M4 16v4h16v-4M10 12v4h5v-4z')],
    h02: [path('M3 16V9a1.5 1.5 0 0 1 3 0v4l2-2a1.5 1.5 0 0 1 2 2l-3 5H4l-1-2M21 16V9a1.5 1.5 0 0 0-3 0v4l-2-2a1.5 1.5 0 0 0-2 2l3 5h3l1-2M9 5h6')],
    h03: [path('M5 3h9l5 5v13H5zM14 3v5h5M5 15l7-7v13M5 15h7')],
    h04: [circle(5.5, 17.5, 3), circle(5.5, 6.5, 3), path('m8 8 13 13M8 16 21 3M14 12l7 9')],
    h05: [path('m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3M4 7.5l8 4.5 8-4.5M12 12v9M8 5.2l8 4.6M8 14l4 2.3')],
    h06: [rect(3, 3, 9, 9, 1), circle(17, 7, 3), path('m12 13 8 7H4l8-7')],

    // Chinese: naming, directions, description, character, story, components.
    c01: [path('M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8 8h8v5H8zM12 6v9')],
    c02: [path('M3 6h13m-3-3 3 3-3 3M21 18H8m3-3-3 3 3 3M19 6v6H5v6')],
    c03: [rect(3, 3, 13, 13, 2), path('m5 13 3-4 3 3 2-2M19 8h2v11h-4l-4 3v-3H8'), circle(12, 7, 1)],
    c04: [path('M4 8v11h16V8M12 3v16')],
    c05: [path('M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2v15M6 8h3M6 12h3M15 8h3M15 12h3')],
    c06: [path('M3 8h7M6.5 3v17M3 16l3.5-6 3.5 6M14 6h7v14h-7zM14 13h7')],

    // Drawing: crayon, straight/curved marks, circle, composition, person, idea.
    d01: [path('m5 15 9-11 4 3-9 11-5 2 1-5zM12 6l4 3M5 15l4 3M13 20h7')],
    d02: [path('M4 5h16M4 12c4-8 12 8 16 0M4 20h16')],
    d03: [path('M19 8a8 8 0 1 1-7-4c4 0 7 3 7 7'), circle(19, 8, 1.4, { fill: 'currentColor', stroke: 'none' })],
    d04: [path('m3 11 6-7 6 7M5 11v9h9v-9M8 20v-5h3v5'), circle(18.5, 6, 2.5), path('M17 20h4M19 11v9')],
    d05: [circle(12, 6, 3), path('M12 9v7M5 11l7 2 7-2M7 21l5-5 5 5')],
    d06: [path('M8 16c0-2-3-3-3-7a7 7 0 1 1 14 0c0 4-3 5-3 7H8M9 20h6M10 23h4M9 9l3 3 3-3M12 12v4')],

    // Writing: guided path, strokes, diagonals, tracing, name card, freehand A.
    w01: [path('M4 19c0-7 16-7 16-14M4 19l-2-3m2 3 3-2'), circle(20, 5, 2.2), path('M6 8h3M11 6h3', { 'stroke-dasharray': '1 3' })],
    w02: [path('M4 6h16M8 11v10M16 11v10M4 9h16', { 'stroke-dasharray': '0 0' })],
    w03: [path('m4 4 6 6m0-6-6 6M17 13v8M13 17h8M4 20l5-5')],
    w04: [path('m4 20 8-16 8 16M7.5 13h9', { 'stroke-dasharray': '2.2 2.8' }), circle(4, 20, 1.1, { fill: 'currentColor', stroke: 'none' })],
    w05: [rect(2.5, 5, 19, 14, 2), circle(7.5, 10, 1.8), path('M5 15c0-3 5-3 5 0M13 10h5M13 14h3M8 3v2M16 3v2')],
    w06: [path('m4 20 7-16 7 16M7 13h8M20 8v7m-2-2 2 2 2-2')]
  };

  function create(id) {
    const group = document.createElementNS(NS, 'g');
    const attributes = {
      class: 'angi-skill-icon',
      'aria-hidden': 'true',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.65',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'pointer-events': 'none'
    };
    Object.keys(attributes).forEach((key) => group.setAttribute(key, attributes[key]));
    const shapes = marks[id] || [path('M12 3v18M3 12h18M6 6l12 12M18 6 6 18')];
    shapes.forEach(([tag, attrs]) => {
      const element = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach((key) => element.setAttribute(key, String(attrs[key])));
      group.appendChild(element);
    });
    return group;
  }

  window.InksmoreAngiIcons = Object.freeze({ create, ids: Object.freeze(Object.keys(marks)) });
})();
