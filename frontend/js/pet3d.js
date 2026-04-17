let scene, camera, renderer, model;
let speechBubble = document.getElementById('pet-speech-bubble');
let bubbleTimeout;
let isDragging = false;
let startX, startY;
let lastX, lastY;
const container = document.getElementById('pet-companion-container');

const roasts = [
    "Nhìn cái gì? Đi làm kiếm tiền đi!",
    "Ví còn đéo tiền mà rảnh rỗi lôi kéo tao à?",
    "Học bài chưa mà ngồi đây nghịch?",
    "Tao đang theo dõi mọi khoản chi của mày đấy nhé!",
    "Bắt quả tang thằng lười biếng!",
    "Click nữa tao trừ điểm kỷ luật bây giờ!",
    "Bỏ tao ra! Tao không phải đồ chơi của mày!",
    "Tao đang bận... thở, đừng làm phiền!",
];

function initPet3D() {
    const canvasContainer = document.getElementById('matcha-pet-canvas-container');
    if (!canvasContainer || !container) return;

    // Load saved position with Safety Bounds Check
    const savedPos = JSON.parse(localStorage.getItem('matcha_pet_pos'));
    if (savedPos) {
        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;
        container.style.left = Math.min(Math.max(0, savedPos.x), maxX) + 'px';
        container.style.top = Math.min(Math.max(0, savedPos.y), maxY) + 'px';
        container.style.bottom = 'auto';
        container.style.right = 'auto';
    }

    // 1. Scene Setup
    scene = new THREE.Scene();
    
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8);

    // 3. Renderer Setup (High quality)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(renderer.domElement);

    // 4. Lighting (WARM & SOFT - NOT SCARY)
    scene.add(new THREE.AmbientLight(0xffffff, 1.3)); // Bright global light
    
    // Hemisphere light for soft shadows
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // 5. Load Model
    const loader = new THREE.GLTFLoader();
    loader.load('/model3d/matcha.glb', (gltf) => {
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        model.scale.set(1.1, 1.1, 1.1); // Small & Cute
        model.rotation.set(0, 0.2, 0); // Slight fixed angle
        scene.add(model);
    });

    // 6. Animation Loop (Expressive Idle)
    function animate() {
        requestAnimationFrame(animate);
        if (model && !isDragging) {
            const time = Date.now();
            
            // 1. "Hopping" Idle gesture
            model.position.y = Math.abs(Math.sin(time * 0.003)) * 0.2; 
            
            // 2. "Breathing" scale gesture
            const pulse = 1 + Math.sin(time * 0.002) * 0.05;
            model.scale.set(1.1 * pulse, 1.1 * pulse, 1.1 * pulse);
            
            // 3. Reset rotations from any leftover spin
            model.rotation.y = 0.2; // Fixed front-right pose
            model.rotation.z *= 0.9; 
            model.rotation.x *= 0.9;
        }
        renderer.render(scene, camera);
    }
    animate();

    // 7. Interaction Helpers
    const startDrag = (clientX, clientY) => {
        isDragging = true;
        startX = clientX - container.offsetLeft;
        startY = clientY - container.offsetTop;
        lastX = clientX;
        lastY = clientY;
        container.style.transition = 'none';
    };

    const moveDrag = (clientX, clientY) => {
        if (!isDragging) return;
        let x = clientX - startX;
        let y = clientY - startY;
        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;
        x = Math.min(Math.max(0, x), maxX);
        y = Math.min(Math.max(0, y), maxY);
        container.style.left = x + 'px';
        container.style.top = y + 'px';
        container.style.bottom = 'auto';
        container.style.right = 'auto';

        if (model) {
            model.rotation.z = -(clientX - lastX) * 0.05;
            model.rotation.x = (clientY - lastY) * 0.05;
        }
        lastX = clientX;
        lastY = clientY;
    };

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), top 0.3s ease, left 0.3s ease';
        localStorage.setItem('matcha_pet_pos', JSON.stringify({
            x: container.offsetLeft,
            y: container.offsetTop
        }));
    };

    // Events
    container.onmousedown = (e) => (e.target.closest('#pet-speech-bubble') ? null : startDrag(e.clientX, e.clientY));
    document.onmousemove = (e) => moveDrag(e.clientX, e.clientY);
    document.onmouseup = () => endDrag();

    container.ontouchstart = (e) => (e.target.closest('#pet-speech-bubble') ? null : startDrag(e.touches[0].clientX, e.touches[0].clientY));
    document.ontouchmove = (e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    document.ontouchend = () => endDrag();

    container.onclick = (e) => (isDragging ? null : showRoast());
}

function showRoast() {
    if (!speechBubble) return;
    clearTimeout(bubbleTimeout);
    speechBubble.innerText = roasts[Math.floor(Math.random() * roasts.length)];
    speechBubble.classList.add('active');
    bubbleTimeout = setTimeout(() => speechBubble.classList.remove('active'), 3000);
}

window.addEventListener('load', initPet3D);
