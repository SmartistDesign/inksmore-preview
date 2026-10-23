(() => {
'use strict';
const dialog = document.querySelector('#detail-dialog');
const dialogContent = document.querySelector('#dialog-content');
const menu = document.querySelector('#main-nav');
const menuToggle = document.querySelector('.menu-toggle');
const research = window.INKSMORE_RESEARCH || {angi: [], paper: []};
const page = document.body.dataset.page || 'home';
let returnFocus = null;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

// Older links used single-page hashes (#research/our-pilot, #about). Send them to the matching page or section.
const legacySections = {about:'our-people', paper:'our-approach', 'home-top':'welcome', home:'welcome', 'early-access':'welcome'};
const legacyPages = {parents:'parents.html', partners:'partners.html', research:'research.html', 'for-you':'parents.html'};
function followLegacyHash() {
  if (page !== 'home') return;
  const [name, section] = location.hash.slice(1).split('/');
  if (legacyPages[name]) {
    location.replace(legacyPages[name] + (section ? '#' + encodeURIComponent(section) : ''));
  } else if (legacySections[name] && !section) {
    const target = document.getElementById(legacySections[name]);
    if (target) {
      history.replaceState(null, '', '#' + legacySections[name]);
      target.scrollIntoView();
    }
  }
}
followLegacyHash();
addEventListener('hashchange', followLegacyHash);

function researchCard(study, index) {
  const title = escapeHtml(study.title);
  return `<article class="research-card" data-flipped="false" data-card-index="${index}">
  <div class="research-card-inner">
    <div class="research-face research-front">
      <h3>${title}</h3>
      <p>${escapeHtml(study.front)}</p>
      <small>${escapeHtml(study.author)}</small>
      <button class="research-flip" type="button" data-flip aria-label="Read summary: ${title}">Read summary <span aria-hidden="true">↻</span></button>
    </div>
    <div class="research-face research-back" aria-hidden="true" inert>
      <h3>${title}</h3>
      <p>${escapeHtml(study.summary)}</p>
      <small>${escapeHtml(study.scope)}</small>
      <div class="research-back-actions">
        <a class="text-link" href="research.html#${encodeURIComponent(study.id)}">Read More <span aria-hidden="true">→</span><span class="sr-only"> about ${title}</span></a>
        <button class="research-flip research-flip-back" type="button" data-flip aria-label="Flip back: ${title}"><span aria-hidden="true">←</span> Flip back</button>
      </div>
    </div>
  </div>
</article>`;
}
function researchDialog(kind) {
  const isAngi = kind === 'angi';
  return `<h2 id="dialog-title">${isAngi ? 'The Research Behind <em>ANGI</em>' : 'Why <em>Paper?</em>'}</h2><p>${isAngi ? 'Explore research on personalized learning, connected knowledge, and learning progress.' : 'Explore the research behind our paper-first approach.'}</p><p class="research-hint">Tap a card to read a short summary.</p><div class="research-cards">${research[kind].map(researchCard).join('')}</div><p class="research-dialog-note">These studies inform our approach; they do not evaluate Inksmore. <a href="research.html">Visit Research</a></p>`;
}
const dialogs = {
waitlist:`<h2 id="dialog-title">Join the <em>Waitlist</em></h2><p>Starting with math for ages 2 to 6 · Free during early access</p><p>Registration and the waitlist aren’t open yet. When they open, you’ll be able to create an account and join the waitlist here.</p><p class="dialog-note">This preview doesn’t collect any personal information, and nothing has been submitted.</p><button class="button" type="button" data-close>Keep exploring <span aria-hidden="true">↗</span></button>`,
team:`<p class="dialog-eyebrow">AI, NEUROSCIENCE, MATHEMATICS EDUCATION &amp; DESIGN</p><h2 id="dialog-title">Parents.<br><em>With a shared purpose.</em></h2><h3 class="dialog-subtitle">Andrew Ngai</h3><p>Andrew brings 10+ years of AI experience and works as a Software Development Manager in an AI product team at Amazon. He is pursuing a PhD in Artificial Intelligence at The Hong Kong Polytechnic University and holds a master’s degree in big data from The Hong Kong University of Science and Technology.</p><h3 class="dialog-subtitle">Lyn Ge</h3><p>A mathematics educator and software developer pursuing a PhD in Mathematics Education at Simon Fraser University, with a background in mathematics research and university teaching. Lyn brings expertise in how mathematical ideas are taught and understood.</p><h3 class="dialog-subtitle">Dr. Qin Xin</h3><p>A neuroscience researcher with a PhD from the University of British Columbia, studying attention, memory, and learning in ADHD. Xin’s research spans five peer-reviewed papers, including work published in Translational Psychiatry.</p><h3 class="dialog-subtitle">Tero</h3><p>A designer and parent with nine years of experience in graphic design and marketing, helping make Inksmore clear, welcoming, and easy to use.</p>`,
privacy:`<p class="dialog-eyebrow">PRIVACY POLICY</p><h2 id="dialog-title">Before we begin.</h2><p>The full Privacy Policy will be available before account registration opens.</p><p>This website preview does not offer registration or collect children’s learning profiles.</p><button class="button" type="button" data-close>Back to the story</button>`,
terms:`<p class="dialog-eyebrow">TERMS OF USE</p><h2 id="dialog-title">The details matter.</h2><p>The Terms of Use will be available before account registration opens.</p><p>This is a website preview. Learning activities and account services are not yet available here.</p><button class="button" type="button" data-close>Back to the story</button>`,
'research-angi':() => researchDialog('angi'),
'research-paper':() => researchDialog('paper')
};
function setMenu(open) {
  menu.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
}
function openDialog(name, trigger) {
  const content = dialogs[name];
  if (!content) return;
  if (!dialog.open) returnFocus = trigger;
  setMenu(false);
  dialogContent.innerHTML = typeof content === 'function' ? content() : content;
  dialog.classList.toggle('dialog-wide', name.startsWith('research-'));
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
  dialog.scrollTop = 0;
  dialog.querySelector('.dialog-close').focus({preventScroll: true});
}
function flipCard(card) {
  const flipped = card.dataset.flipped !== 'true';
  card.dataset.flipped = String(flipped);
  const [front, back] = card.querySelectorAll('.research-face');
  const shown = flipped ? back : front;
  const hidden = flipped ? front : back;
  hidden.setAttribute('aria-hidden', 'true');
  hidden.inert = true;
  shown.removeAttribute('aria-hidden');
  shown.inert = false;
  shown.querySelector(flipped ? 'a' : '[data-flip]').focus({preventScroll: true});
}
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-dialog]');
  if (trigger) openDialog(trigger.dataset.dialog, trigger);
  if (event.target.closest('#main-nav a')) setMenu(false);
  if (!event.target.closest('.site-header')) setMenu(false);
  if (event.target.closest('[data-close], .dialog-close')) dialog.close();
  const front = event.target.closest('.research-front');
  if (front && !front.closest('[data-flipped="true"]')) flipCard(front.closest('.research-card'));
  else if (event.target.closest('.research-back [data-flip]')) flipCard(event.target.closest('.research-card'));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuToggle.focus();
  }
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  const target = returnFocus;
  returnFocus = null;
  if (target?.isConnected && target.getClientRects().length) target.focus({preventScroll:true});
  else if (menuToggle.getClientRects().length) menuToggle.focus({preventScroll:true});
});
matchMedia('(min-width:901px)').addEventListener('change', () => setMenu(false));
})();
