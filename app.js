(() => {
'use strict';
const dialog = document.querySelector('#detail-dialog');
const menu = document.querySelector('#main-nav');
const menuToggle = document.querySelector('.menu-toggle');
let returnFocus = null;
const dialogs={
waitlist:`<p class="dialog-eyebrow">EARLY ACCESS</p><h2 id="dialog-title">A little patience.<br><em>A lot to look forward to.</em></h2><p>Our first math course is for ages 2–6, free during early access.</p><p>Account registration isn’t open on this preview yet. When it opens, you’ll be able to create an account and join the waitlist.</p><button class="button" data-close>Keep exploring <span aria-hidden="true">↗</span></button>`,
paper:`<p class="dialog-eyebrow">PAPER-FIRST</p><h2 id="dialog-title">Print. Play. <em>Discover.</em></h2><p>Print, cut out, and explore together. From pointing and counting to matching, drawing, and connecting, Inksmore turns printable learning materials into hands-on activities.</p><p>The learning is on paper. The technology works in the background.</p><button class="button" data-close>Back to the story</button>`,
angi:`<p class="dialog-eyebrow">ADAPTIVE NEURAL GRAPH INTELLIGENCE</p><h2 id="dialog-title">A clearer view of<br><em>how learning connects.</em></h2><p>Your child’s ANGI Learning Profile is an evolving picture of their learning—a visual map of skills, how well they’re understood, and how they connect.</p><p>Our AI uses this picture to personalize lessons and practice, building on strengths and revisiting foundations that need more attention.</p><button class="button" data-close>Back to the story</button>`,
parents:`<p class="dialog-eyebrow">FOR FAMILIES</p><h2 id="dialog-title">Learning at home.<br><em>At their own pace.</em></h2><p>Print, cut out, and explore together. Share what you notice, and ANGI helps shape what comes next.</p><p>You decide when to practice. ANGI uses your child’s learning profile to guide the content.</p><p>Our first math course is for ages 2–6, free during early access.</p><button class="button" data-dialog="waitlist">Join the Waitlist <span aria-hidden="true">↗</span></button>`,
partners:`<p class="dialog-eyebrow">FOR SCHOOLS &amp; PARTNERS</p><h2 id="dialog-title">More children.<br><em>More possibilities.</em></h2><p>Help explore how personalized, paper-first learning can reach more children. Join us in a free early research partnership.</p><p>Explore paper-based activities, individual learning profiles, and feedback that helps guide each child’s next step.</p><p class="dialog-note">Partnership enquiries will open soon.</p><button class="button" data-close>Back to the story</button>`,
team:`<p class="dialog-eyebrow">EDUCATION, AI &amp; DESIGN</p><h2 id="dialog-title">Parents.<br><em>With a shared purpose.</em></h2><h3 class="dialog-subtitle">Professor Lyn Ge</h3><p>A mathematics educator and software developer pursuing a PhD in Mathematics Education at Simon Fraser University, with experience teaching university mathematics.</p><h3 class="dialog-subtitle">Andrew Ngai</h3><p>Andrew brings 10+ years of AI experience and works as a Software Development Manager in an AI product team at Amazon. He is pursuing the Doctor of Artificial Intelligence degree at The Hong Kong Polytechnic University and holds a master’s degree in big data from The Hong Kong University of Science and Technology.</p><h3 class="dialog-subtitle">Tero</h3><p>As a designer and parent, Tero focuses on making Inksmore’s visual experience clear and welcoming, drawing on nine years across graphic design and marketing.</p>`,
privacy:`<p class="dialog-eyebrow">PRIVACY POLICY</p><h2 id="dialog-title">Before we begin.</h2><p>The full Privacy Policy will be available before account registration opens.</p><p>This homepage preview does not offer registration or collect children’s learning profiles.</p><button class="button" data-close>Back to the story</button>`,
terms:`<p class="dialog-eyebrow">TERMS OF USE</p><h2 id="dialog-title">The details matter.</h2><p>The Terms of Use will be available before account registration opens.</p><p>This is a homepage preview. Learning activities and account services are not yet available here.</p><button class="button" data-close>Back to the story</button>`
};
function setMenu(open) {
  menu.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
}
function openDialog(name, trigger) {
  if (!dialogs[name]) return;
  if (!dialog.open) returnFocus = trigger;
  setMenu(false);
  document.querySelector('#dialog-content').innerHTML = dialogs[name];
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
  dialog.scrollTop = 0;
  dialog.querySelector('.dialog-close').focus({preventScroll: true});
}
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-dialog]');
  if (trigger) openDialog(trigger.dataset.dialog, trigger);
  if (event.target.closest('#main-nav a')) setMenu(false);
  if (!event.target.closest('.site-header')) setMenu(false);
  if (event.target.closest('[data-close], .dialog-close')) dialog.close();
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
matchMedia('(min-width:801px)').addEventListener('change', () => setMenu(false));
})();
