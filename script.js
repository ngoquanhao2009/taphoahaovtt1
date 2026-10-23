const shareButton = document.querySelector('[data-share]');
const toast = document.querySelector('.toast');
const copyCodeButton = document.querySelector('[data-copy-code]');
const gravityBadge = document.querySelector('#gravity-badge');
const gravitySound = document.querySelector('#gravity-sound');
const gravityMainToggle = document.querySelector('#gravity-main-toggle');
const gravityMainLabel = document.querySelector('#gravity-main-label');
const toyboxToggle = document.querySelector('#toybox-toggle');
const toyboxDropdown = document.querySelector('#toybox-dropdown');
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
let activeTool = 'grab';
let pointerDown = false;
let pointerPosition = { x: 0, y: 0 };
let trampolineOn = false;
let underwaterOn = false;
let gravityMode = 0;
let eyesEnabled = true;
let toyTimers = [];

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

function playToySound(type, customFrequency = null) {
  if (!soundEnabled) return;
  createAudioContext();
  if (!audioContext) return;
  const tones = { quack: [520, 280], boing: [150, 540], pew: [950, 140], boom: [160, 32], crunch: [220, 70], pop: [340, 760], oink: [190, 290], tick: [800, 800], piano: [392, 392] };
  const [startFrequency, endFrequency] = type === 'piano' ? [customFrequency || 392, customFrequency || 392] : (tones[type] || [220, 80]);
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type === 'pew' ? 'square' : 'triangle';
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + (type === 'boom' ? .35 : .14));
  gain.gain.setValueAtTime(.16, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + (type === 'boom' ? .36 : .15));
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + (type === 'boom' ? .37 : .16));
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
  if (pointerDown && (activeTool === 'black-hole' || activeTool === 'wind-fan')) {
    physicsPairs.forEach(({ body }) => {
      const dx = pointerPosition.x - body.position.x;
      const dy = pointerPosition.y - body.position.y;
      const distance = Math.max(35, Math.hypot(dx, dy));
      if (distance > 520) return;
      const force = (520 - distance) * .00003 * body.mass;
      const direction = activeTool === 'black-hole' ? 1 : -1;
      Matter.Body.applyForce(body, body.position, { x: dx / distance * force * direction, y: dy / distance * force * direction });
      if (activeTool === 'black-hole') Matter.Body.setAngularVelocity(body, .14);
    });
  }
  physicsPairs.forEach(({ element, body, width, height }) => {
    const margin = 10;
    const minX = width / 2 + margin;
    const maxX = Math.max(minX, window.innerWidth - width / 2 - margin);
    const minY = 76 + height / 2;
    const maxY = Math.max(minY, window.innerHeight - height / 2 - margin);
    const boundedX = Math.min(maxX, Math.max(minX, body.position.x));
    const boundedY = Math.min(maxY, Math.max(minY, body.position.y));
    const hitHorizontalEdge = boundedX !== body.position.x;
    const hitVerticalEdge = boundedY !== body.position.y;

    if (hitHorizontalEdge || hitVerticalEdge) {
      Matter.Body.setPosition(body, { x: boundedX, y: boundedY });
      Matter.Body.setVelocity(body, {
        x: hitHorizontalEdge ? 0 : body.velocity.x,
        y: hitVerticalEdge ? 0 : body.velocity.y
      });
    }
    element.style.transform = `translate3d(${body.position.x - width / 2}px, ${body.position.y - height / 2}px, 0) rotate(${body.angle}rad)`;
  });
  physicsPairs.forEach((pair) => {
    if (!pair.balloon) return;
    pair.balloonPhase = (pair.balloonPhase || 0) + .035;
    const sway = Math.sin(pair.balloonPhase) * 12;
    pair.balloon.style.transform = `translate3d(${pair.body.position.x - 22 + sway}px, ${pair.body.position.y - pair.height / 2 - 76}px, 0)`;
    pair.balloonString.style.transform = `translate3d(${pair.body.position.x - 1 + sway / 2}px, ${pair.body.position.y - pair.height / 2 - 34}px, 0) rotate(${sway / 18}rad)`;
  });
  animationFrameId = window.requestAnimationFrame(updatePhysics);
}

function startGravity() {
  if (isGravityActive) return;
  if (!window.Matter) return showToast('Không tải được Matter.js');
  createAudioContext();
  isGravityActive = true;
  setGravityStatus('Đang hoạt động', true);
  gravityMainLabel.textContent = 'Tạm dừng';

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
    return { element, body, width, height, meta: {} };
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
    if (impact > 3.2) {
      playBump(impact);
      pairs.forEach(({ bodyA, bodyB }) => {
        const first = physicsPairs.find((item) => item.body === bodyA || item.body === bodyB);
        if (first?.meta?.sound) playToySound(first.meta.sound, first.meta.frequency);
      });
      lastSound = now;
    }
  });

  runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);
  updatePhysics();
  showToast('⚡ Trọng lực đã bật, hãy kéo các khối!');
}

function toggleGravityState() {
  if (!isGravityActive) {
    startGravity();
    return;
  }
  runner.enabled = !runner.enabled;
  gravityMainLabel.textContent = runner.enabled ? 'Tạm dừng' : 'Tiếp tục';
  setGravityStatus(runner.enabled ? 'Đang hoạt động' : 'Đã đóng băng', runner.enabled);
  showToast(runner.enabled ? '▶ Tiếp tục trọng lực' : '⏸ Đã tạm dừng trọng lực');
}

function resetGravity() {
  if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
  if (runner) Matter.Runner.stop(runner);
  toyTimers.forEach((timer) => window.clearInterval(timer));
  toyTimers = [];
  if (engine) Matter.Composite.clear(engine.world, false);
  document.querySelectorAll('.spawned-item').forEach((element) => element.remove());
  document.querySelectorAll('.attached-balloon, .balloon-string').forEach((element) => element.remove());
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
  gravityMainLabel.textContent = 'Bật trọng lực';
  setGravityStatus('Sẵn sàng');
  showToast('↺ Đã khôi phục bố cục');
}

function closeToybox() {
  toyboxDropdown.classList.remove('open');
  toyboxDropdown.setAttribute('aria-hidden', 'true');
}

function selectTool(tool) {
  activeTool = tool;
  document.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('selected', button.dataset.tool === tool));
  closeToybox();
  showToast(`Đã chọn tool: ${tool}`);
}

function shockwaveAt(x, y, power = 1) {
  if (!isGravityActive) startGravity();
  if (!engine) return;
  physicsPairs.forEach(({ body }) => {
    const dx = body.position.x - x;
    const dy = body.position.y - y;
    const distance = Math.max(40, Math.hypot(dx, dy));
    if (distance > 460) return;
    const force = ((460 - distance) / 460) * 18 * power;
    Matter.Body.setVelocity(body, { x: body.velocity.x + Math.cos(Math.atan2(dy, dx)) * force, y: body.velocity.y + Math.sin(Math.atan2(dy, dx)) * force - 5 });
  });
  playToySound('boom');
  showToast('💥 BÙM! Sóng xung kích');
}

function shootCandy(targetX, targetY) {
  if (!isGravityActive) startGravity();
  if (!engine) return;
  const size = 34;
  const element = document.createElement('div');
  element.className = 'physics-item spawned-item toy-object candy-object';
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.innerHTML = `<span class="toy-emoji">${['🍬', '🍓', '🍋', '🍇', '⭐'][Math.floor(Math.random() * 5)]}</span>`;
  document.querySelector('.page-shell').appendChild(element);
  const startX = window.innerWidth / 2;
  const startY = 95;
  const body = Matter.Bodies.circle(startX, startY, size / 2, { restitution: .92, friction: .05 });
  const angle = Math.atan2(targetY - startY, targetX - startX);
  Matter.Body.setVelocity(body, { x: Math.cos(angle) * 18, y: Math.sin(angle) * 18 });
  Matter.Composite.add(engine.world, body);
  physicsPairs.push({ element, body, width: size, height: size, meta: { sound: 'pop', word: 'Pew!' }, scaleState: 0 });
  playToySound('pew');
}

function applyToolToPair(pair) {
  if (!pair || activeTool === 'grab') return;
  const { body } = pair;
  if (activeTool === 'balloon') {
    attachBalloon(pair);
    Matter.Body.applyForce(body, body.position, { x: 0, y: -.008 * body.mass });
    Matter.Body.setVelocity(body, { x: body.velocity.x, y: -6 });
    playToySound('pop');
    showToast('🎈 Bóng bay kéo vật thể lên');
  } else if (activeTool === 'hammer') {
    const factor = pair.scaleState === 0 ? 1.4 : pair.scaleState === 1 ? .5 : 1 / .7;
    Matter.Body.scale(body, factor, factor);
    pair.width *= factor;
    pair.height *= factor;
    pair.scaleState = pair.scaleState === 0 ? 1 : pair.scaleState === 1 ? 2 : 0;
    pair.element.style.width = `${pair.width}px`;
    pair.element.style.height = `${pair.height}px`;
    playToySound('boing');
    showToast(pair.scaleState === 1 ? '🔨 To khổng lồ!' : pair.scaleState === 2 ? '🔨 Nhỏ tí hon!' : '🔨 Về cỡ chuẩn');
  }
}

function attachBalloon(pair) {
  if (pair.balloon) return;
  const balloon = document.createElement('span');
  balloon.className = 'attached-balloon';
  balloon.textContent = ['🎈', '🎈', '🎈'][Math.floor(Math.random() * 3)];
  const balloonString = document.createElement('span');
  balloonString.className = 'balloon-string';
  document.querySelector('.page-shell').append(balloon, balloonString);
  pair.balloon = balloon;
  pair.balloonString = balloonString;
  pair.balloonPhase = Math.random() * Math.PI * 2;
  showToast('🎈 Bóng bay đã buộc vào vật thể');
}

function interactWithPair(pair) {
  if (!pair?.meta?.sound) return;
  playToySound(pair.meta.sound, pair.meta.frequency);
  if (pair.meta.toyType === 'dice') {
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const face = pair.element.querySelector('.toy-face');
    if (face) face.textContent = faces[Math.floor(Math.random() * faces.length)];
  }
  if (pair.meta.word) showToast(`${pair.meta.word}`);
}

function addToy(type, x = window.innerWidth * (.25 + Math.random() * .5), y = 110, frequency = null) {
  if (!isGravityActive) startGravity();
  if (!engine) return;
  const toyData = {
    duck: ['🦆', 68, 'quack', 'Quạc quạc!'], basketball: ['🏀', 66, 'boing', 'Boing!'], bomb: ['💣', 74, 'tick', 'Tích tắc...'],
    dino: ['🦖', 78, 'crunch', 'Ngoàm ngoàm!'], dice: ['🎲', 68, 'pop', 'Lạch cạch!'], piggy: ['🐷', 72, 'oink', 'Ụt ịt!'], piano: ['🎹', 54, 'piano', 'Đồ rê mi!']
  }[type];
  if (!toyData) return;
  const [emoji, size, sound, word] = toyData;
  const element = document.createElement('div');
  element.className = 'physics-item spawned-item toy-object';
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.innerHTML = `<span class="${type === 'dice' ? 'toy-face' : 'toy-emoji'}">${type === 'dice' ? ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.floor(Math.random() * 6)] : emoji}</span><small>${type === 'bomb' ? '3s' : ''}</small>`;
  document.querySelector('.page-shell').appendChild(element);
  const body = type === 'basketball' || type === 'duck' || type === 'piggy' ? Matter.Bodies.circle(x, y, size / 2, { restitution: .85, friction: .08 }) : Matter.Bodies.rectangle(x, y, size, size, { restitution: .72, chamfer: { radius: 14 } });
  Matter.Body.setVelocity(body, { x: (Math.random() - .5) * 8, y: 3 });
  Matter.Composite.add(engine.world, body);
  const pair = { element, body, width: size, height: size, meta: { sound, word, frequency, toyType: type }, scaleState: 0 };
  physicsPairs.push(pair);
  playToySound(sound, frequency);
  showToast(`${emoji} ${word}`);
  if (type === 'bomb') {
    let seconds = 3;
    const timer = window.setInterval(() => {
      if (!physicsPairs.includes(pair)) {
        window.clearInterval(timer);
        return;
      }
      seconds -= 1;
      if (seconds > 0) {
        playToySound('tick');
        element.querySelector('small').textContent = `${seconds}s`;
        showToast(`💣 Tích tắc... ${seconds}s`);
        return;
      }
      window.clearInterval(timer);
      shockwaveAt(body.position.x, body.position.y, 1.3);
      Matter.Composite.remove(engine.world, body);
      pair.balloon?.remove();
      pair.balloonString?.remove();
      element.remove();
      physicsPairs = physicsPairs.filter((item) => item !== pair);
    }, 1000);
    toyTimers.push(timer);
  }
}

function spawnPiano() {
  [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88].forEach((frequency, index) => {
    window.setTimeout(() => addToy('piano', 110 + index * 62, 110, frequency), index * 70);
  });
  showToast('🎹 7 phím piano đã rơi xuống');
}

function spawnSnackRain() {
  const snacks = ['🧋', '🍜', '🍦', '🍭', '🍟', '🍕', '🍩', '🎁'];
  snacks.forEach((emoji, index) => window.setTimeout(() => {
    addToy('piggy', 60 + Math.random() * Math.max(80, window.innerWidth - 120), 90);
    const pair = physicsPairs.at(-1);
    if (pair) pair.element.querySelector('.toy-emoji').textContent = emoji;
  }, index * 90));
}

document.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => selectTool(button.dataset.tool)));
document.querySelectorAll('[data-toy]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.toy === 'piano') spawnPiano();
  else if (button.dataset.toy === 'snacks') spawnSnackRain();
  else addToy(button.dataset.toy);
  closeToybox();
}));
document.querySelector('[data-env="trampoline"]').addEventListener('click', () => {
  trampolineOn = !trampolineOn;
  document.querySelector('[data-env="trampoline"]').classList.toggle('selected', trampolineOn);
  walls.forEach((wall) => { if (wall.label === 'floor') wall.restitution = trampolineOn ? 1.2 : .7; });
  showToast(trampolineOn ? '🎪 Sàn nhún đã bật' : 'Sàn nhún đã tắt');
});
document.querySelector('[data-env="underwater"]').addEventListener('click', () => {
  underwaterOn = !underwaterOn;
  document.body.classList.toggle('underwater-theme', underwaterOn);
  if (engine) engine.gravity.y = underwaterOn ? .22 : (gravityMode === 2 ? -1.05 : gravityMode === 1 ? 0 : 1.05);
  physicsPairs.forEach(({ body }) => { body.frictionAir = underwaterOn ? .065 : .008; });
  showToast(underwaterOn ? '🌊 Chế độ dưới đáy biển' : 'Đã về môi trường thường');
});
document.querySelector('[data-env="gravity"]').addEventListener('click', () => {
  if (!isGravityActive) startGravity();
  gravityMode = (gravityMode + 1) % 3;
  if (engine) engine.gravity.y = gravityMode === 0 ? 1.05 : gravityMode === 1 ? 0 : -1.05;
  showToast(gravityMode === 0 ? '🌍 Trọng lực chuẩn' : gravityMode === 1 ? '🚀 Không trọng lực' : '🙃 Trọng lực ngược');
});
document.querySelector('[data-env="eyes"]').addEventListener('click', () => {
  eyesEnabled = !eyesEnabled;
  document.querySelector('[data-env="eyes"]').classList.toggle('selected', eyesEnabled);
  showToast(eyesEnabled ? '👀 Mắt hoạt hình bật' : 'Mắt hoạt hình tắt');
});

toyboxToggle.addEventListener('click', () => {
  const open = toyboxDropdown.classList.toggle('open');
  toyboxDropdown.setAttribute('aria-hidden', String(!open));
});
document.querySelector('#toybox-close').addEventListener('click', closeToybox);
gravitySound.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  gravitySound.textContent = soundEnabled ? '🔊' : '🔇';
  if (soundEnabled) createAudioContext();
  showToast(soundEnabled ? '🔊 Đã bật âm thanh' : '🔇 Đã tắt âm thanh');
});
document.querySelector('#gravity-reset').addEventListener('click', resetGravity);
gravityMainToggle.addEventListener('click', toggleGravityState);

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
  if (event.target.closest('.gravity-dock, .code-modal')) return;
  pointerStart = { x: event.clientX, y: event.clientY };
  isDragging = false;
  pointerDown = true;
  pointerPosition = { x: event.clientX, y: event.clientY };
  if (activeTool === 'candy-gun') shootCandy(event.clientX, event.clientY);
  if (activeTool === 'shockwave') shockwaveAt(event.clientX, event.clientY);
  const pair = physicsPairs.find((item) => item.element.contains(event.target));
  if (pair) {
    interactWithPair(pair);
    applyToolToPair(pair);
  }
}, true);

document.addEventListener('pointermove', (event) => {
  pointerPosition = { x: event.clientX, y: event.clientY };
  if (!pointerStart || event.buttons === 0) return;
  const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  if (distance > 8) isDragging = true;
}, true);

document.addEventListener('pointerup', () => {
  pointerStart = null;
  pointerDown = false;
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