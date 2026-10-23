const shareButton = document.querySelector('[data-share]');
const toast = document.querySelector('.toast');
const copyCodeButton = document.querySelector('[data-copy-code]');
const gravityBadge = document.querySelector('#gravity-badge');
const gravityToggle = document.querySelector('#gravity-toggle');
const gravityToggleLabel = document.querySelector('#gravity-toggle-label');
const gravityZero = document.querySelector('#gravity-zero');
const gravityInvert = document.querySelector('#gravity-invert');
const gravitySound = document.querySelector('#gravity-sound');
const codeModal = document.querySelector('#code-modal');
const codeSnippet = document.querySelector('#embed-snippet');

let engine = null;
let runner = null;
let physicsPairs = [];
let walls = [];
let animationFrameId = null;
let isGravityActive = false;
let isZeroGravity = false;
let isInverted = false;
let isDragging = false;
let suppressNextLinkClick = false;
let pointerStart = null;
let soundEnabled = true;
let audioContext = null;
let toastTimer = null;

document.addEventListener('dragstart', (event) => event.preventDefault());

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2300);
}

async function copyText(value, message) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(message);
  } catch (error) {
    console.error('Không thể sao chép:', error);
  }
}

copyCodeButton.addEventListener('click', () => copyText(copyCodeButton.dataset.copyCode, 'Đã sao chép mã HAOVTT1'));

shareButton.addEventListener('click', async () => {
  const shareData = { title: 'Hào VTT | Dịch vụ Roblox', url: window.location.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else await copyText(window.location.href, 'Đã sao chép liên kết trang');
  } catch (error) {
    if (error.name !== 'AbortError') console.error('Không thể chia sẻ liên kết:', error);
  }
});

function setGravityStatus(message, active = false) {
  gravityBadge.textContent = message;
  gravityBadge.classList.toggle('active', active);
}

function createAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  if (audioContext?.state === 'suspended') audioContext.resume();
}

function playBump(intensity = 1) {
  if (!soundEnabled || !audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(Math.min(260, 80 + intensity * 18), now);
  oscillator.frequency.exponentialRampToValueAtTime(32, now + .08);
  gain.gain.setValueAtTime(Math.min(.18, Math.max(.015, intensity * .02)), now);
  gain.gain.exponentialRampToValueAtTime(.001, now + .08);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + .085);
}

function createWalls(width, height) {
  const thickness = 120;
  const wallOptions = { isStatic: true, restitution: .7, friction: .1 };
  return [
    Matter.Bodies.rectangle(width / 2, height + thickness / 2, width * 2, thickness, wallOptions),
    Matter.Bodies.rectangle(width / 2, 65 - thickness / 2, width * 2, thickness, wallOptions),
    Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height * 2, wallOptions),
    Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height * 2, wallOptions)
  ];
}

function updatePhysics() {
  physicsPairs.forEach(({ element, body, width, height }) => {
    element.style.transform = `translate3d(${body.position.x - width / 2}px, ${body.position.y - height / 2}px, 0) rotate(${body.angle}rad)`;
  });
  animationFrameId = window.requestAnimationFrame(updatePhysics);
}

function startGravity() {
  if (isGravityActive) return;
  if (!window.Matter) return showToast('Không tải được Matter.js');
  createAudioContext();
  isGravityActive = true;
  setGravityStatus('Đang hoạt động', true);
  gravityToggleLabel.textContent = 'Tạm dừng';

  const measurements = [...document.querySelectorAll('.physics-item')].map((element) => {
    const rect = element.getBoundingClientRect();
    return { element, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: Math.max(24, rect.width), height: Math.max(24, rect.height) };
  });

  engine = Matter.Engine.create();
  engine.gravity.y = 1.05;
  walls = createWalls(window.innerWidth, window.innerHeight);
  Matter.Composite.add(engine.world, walls);

  physicsPairs = measurements.map(({ element, x, y, width, height }) => {
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.classList.add('physics-active');
    const body = Matter.Bodies.rectangle(x, y, width, height, { restitution: .58, friction: .08, frictionAir: .008, density: .0015, angle: (Math.random() - .5) * .08 });
    Matter.Body.setVelocity(body, { x: (Math.random() - .5) * 2.5, y: Math.random() * 1.5 });
    Matter.Composite.add(engine.world, body);
    return { element, body, width, height };
  });

  const mouse = Matter.Mouse.create(document.body);
  const mouseConstraint = Matter.MouseConstraint.create(engine, { mouse, constraint: { stiffness: .25, damping: .1, render: { visible: false } } });
  Matter.Events.on(mouseConstraint, 'startdrag', () => createAudioContext());
  Matter.Events.on(mouseConstraint, 'enddrag', () => {
    if (isDragging) suppressNextLinkClick = true;
    window.setTimeout(() => { isDragging = false; }, 100);
  });
  Matter.Composite.add(engine.world, mouseConstraint);

  let lastSound = 0;
  Matter.Events.on(engine, 'collisionStart', ({ pairs }) => {
    const now = performance.now();
    if (now - lastSound < 45) return;
    const impact = pairs.reduce((total, pair) => total + (pair.bodyA.speed || 0) + (pair.bodyB.speed || 0), 0);
    if (impact > 3.2) { playBump(impact); lastSound = now; }
  });

  runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);
  updatePhysics();
  showToast('⚡ Trọng lực đã bật, hãy kéo các khối!');
}

function toggleGravity() {
  if (!isGravityActive) return startGravity();
  runner.enabled = !runner.enabled;
  gravityToggleLabel.textContent = runner.enabled ? 'Tạm dừng' : 'Tiếp tục';
  setGravityStatus(runner.enabled ? 'Đang hoạt động' : 'Đã đóng băng', runner.enabled);
  showToast(runner.enabled ? '▶ Tiếp tục vật lý' : '⏸ Đã đóng băng thời gian');
}

function toggleZeroGravity() {
  if (!isGravityActive) startGravity();
  if (!engine) return;
  isZeroGravity = !isZeroGravity;
  engine.gravity.y = isZeroGravity ? 0 : (isInverted ? -1.05 : 1.05);
  gravityZero.classList.toggle('is-active', isZeroGravity);
  setGravityStatus(isZeroGravity ? 'Không trọng lực' : 'Đang hoạt động', true);
  if (isZeroGravity) physicsPairs.forEach(({ body }) => {
    Matter.Body.setVelocity(body, { x: (Math.random() - .5) * 4, y: (Math.random() - .5) * 4 });
    Matter.Body.setAngularVelocity(body, (Math.random() - .5) * .06);
  });
  showToast(isZeroGravity ? '◌ Chế độ không trọng lực' : '🌍 Đã bật lại trọng lực');
}

function invertGravity() {
  if (!isGravityActive) startGravity();
  if (!engine) return;
  isZeroGravity = false;
  gravityZero.classList.remove('is-active');
  isInverted = !isInverted;
  engine.gravity.y = isInverted ? -1.05 : 1.05;
  gravityInvert.classList.toggle('is-active', isInverted);
  setGravityStatus(isInverted ? 'Rơi lên trần' : 'Đang hoạt động', true);
  showToast(isInverted ? '↕ Đảo ngược trọng lực' : '↓ Trọng lực hướng xuống');
}

function explode() {
  if (!isGravityActive) startGravity();
  if (!engine) return;
  createAudioContext();
  physicsPairs.forEach(({ body }) => {
    Matter.Body.setVelocity(body, { x: (Math.random() - .5) * 32, y: -(Math.random() * 22 + 8) });
    Matter.Body.setAngularVelocity(body, (Math.random() - .5) * .35);
  });
  showToast('✹ Bùng nổ, mọi thứ bay tứ tung!');
}

function spawnItem() {
  if (!isGravityActive) startGravity();
  if (!engine) return;
  const catalog = [['✦', 'Kim cương VIP', '＋9999 KC'], ['⚙', 'Bot tự động', 'HAOVTT1 AI'], ['★', 'Top 1 uy tín', '5 sao'], ['⚡', 'Deal đặc biệt', 'Flash sale'], ['⌘', 'Source VIP', 'Full HTML/JS'], ['◉', 'Hỗ trợ 24/7', 'Zalo / Discord']];
  const [icon, title, tag] = catalog[Math.floor(Math.random() * catalog.length)];
  const element = document.createElement('div');
  element.className = 'spawned-item';
  element.innerHTML = `<span class="spawned-icon">${icon}</span><span><strong>${title}</strong><small>${tag}</small></span>`;
  document.querySelector('.page-shell').appendChild(element);
  const width = 175;
  const height = 58;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  const body = Matter.Bodies.rectangle(window.innerWidth * (.25 + Math.random() * .5), 110, width, height, { restitution: .68, friction: .06 });
  Matter.Body.setVelocity(body, { x: (Math.random() - .5) * 10, y: 4 });
  Matter.Composite.add(engine.world, body);
  physicsPairs.push({ element, body, width, height });
  showToast(`＋ Đã thêm ${title}`);
}

function resetGravity() {
  if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
  if (runner) Matter.Runner.stop(runner);
  if (engine) Matter.Composite.clear(engine.world, false);
  document.querySelectorAll('.spawned-item').forEach((element) => element.remove());
  document.querySelectorAll('.physics-item').forEach((element) => {
    element.classList.remove('physics-active');
    element.style.width = '';
    element.style.height = '';
    element.style.transform = '';
  });
  engine = null;
  runner = null;
  physicsPairs = [];
  walls = [];
  isGravityActive = false;
  isZeroGravity = false;
  isInverted = false;
  gravityToggleLabel.textContent = 'Bật trọng lực';
  gravityZero.classList.remove('is-active');
  gravityInvert.classList.remove('is-active');
  setGravityStatus('Sẵn sàng');
  showToast('↺ Đã khôi phục bố cục');
}

gravityToggle.addEventListener('click', toggleGravity);
gravityZero.addEventListener('click', toggleZeroGravity);
gravityInvert.addEventListener('click', invertGravity);
document.querySelector('#gravity-explode').addEventListener('click', explode);
document.querySelector('#gravity-spawn').addEventListener('click', spawnItem);
document.querySelector('#gravity-reset').addEventListener('click', resetGravity);
gravitySound.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  gravitySound.textContent = soundEnabled ? '🔊' : '🔇';
  if (soundEnabled) createAudioContext();
  showToast(soundEnabled ? '🔊 Đã bật âm thanh' : '🔇 Đã tắt âm thanh');
});

document.querySelector('#gravity-code').addEventListener('click', () => {
  codeModal.classList.add('open');
  codeModal.setAttribute('aria-hidden', 'false');
});
document.querySelector('#code-close').addEventListener('click', () => {
  codeModal.classList.remove('open');
  codeModal.setAttribute('aria-hidden', 'true');
});
codeModal.addEventListener('click', (event) => {
  if (event.target === codeModal) document.querySelector('#code-close').click();
});
document.querySelector('#copy-snippet').addEventListener('click', () => copyText(codeSnippet.textContent, 'Đã sao chép code nhúng'));

document.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
  isDragging = false;
}, true);

document.addEventListener('pointermove', (event) => {
  if (!pointerStart || event.buttons === 0) return;
  const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  if (distance > 8) isDragging = true;
}, true);

document.addEventListener('pointerup', () => {
  pointerStart = null;
}, true);

document.addEventListener('click', (event) => {
  if (suppressNextLinkClick && event.target.closest('.link-card, .brand, .share-button')) {
    event.preventDefault();
    event.stopPropagation();
    suppressNextLinkClick = false;
  }
}, true);

window.addEventListener('resize', () => {
  if (!engine) return;
  Matter.Composite.remove(engine.world, walls);
  walls = createWalls(window.innerWidth, window.innerHeight);
  Matter.Composite.add(engine.world, walls);
});