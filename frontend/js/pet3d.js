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
    "Bớt tiêu hoang lại không tao vả cho đấy.",
    "Click nữa tao trừ điểm kỷ luật bây giờ!",
    "Bỏ tao ra! Tao không phải đồ chơi của mày!",
    "Dừng lại ngay! Mày đang làm phiền giấc ngủ của tao.",
];

function initPet3D() {
    const canvasContainer = document.getElementById('matcha-pet-canvas-container');
    if (!canvasContainer || !container) return;

    // Load saved position with Safety Bounds Check
    const savedPos = JSON.parse(localStorage.getItem('matcha_pet_pos'));
    if (savedPos) {
        // Ensure not off-screen (e.g. desktop to mobile switch)
        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;
        
        container.style.left = Math.min(Math.max(0, savedPos.x), maxX) + 'px';
        container.style.top = Math.min(Math.max(0, savedPos.y), maxY) + 'px';
        container.style.bottom = 'auto';
        container.style.right = 'auto';
    }

    // 1. Scene Setup
    scene = new THREE.Scene();
    
    // Low-poly style optimization
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000);
    camera.position.z = 8;

    // 3. Renderer Setup (Performance optimized)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(renderer.domElement);

    // 4. Lighting (Flat look)
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(0, 5, 10);
    scene.add(pointLight);

    // 5. Load Model
    const loader = new THREE.GLTFLoader();
    loader.load('/model3d/matcha.glb', (gltf) => {
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.scale.set(1.3, 1.3, 1.3); 
        model.rotation.y = 0; 
        scene.add(model);
    });

    // 6. Animation Loop (Higher FPS orientation)
    function animate() {
        requestAnimationFrame(animate);
        if (model && !isDragging) {
            // Very subtle breathing instead of spinning
            model.position.y = Math.sin(Date.now() * 0.001) * 0.1;
            model.rotation.y = 0; // FORCE STAND STILL
            model.rotation.z *= 0.95; // Smooth jiggle return
            model.rotation.x *= 0.95;
        }
        renderer.render(scene, camera);
    }
    animate();

    const startDrag = (clientX, clientY) => {
        isDragging = true;
        startX = clientX - container.offsetLeft;
        startY = clientY - container.offsetTop;
        lastX = clientX;
        lastY = clientY;
        container.style.transition = 'none';
        if (model) model.scale.set(1.5, 1.5, 1.5);
    };

    const moveDrag = (clientX, clientY) => {
        if (!isDragging) return;
        
        let x = clientX - startX;
        let y = clientY - startY;

        // Screen Boundaries
        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;
        x = Math.min(Math.max(0, x), maxX);
        y = Math.min(Math.max(0, y), maxY);

        container.style.left = x + 'px';
        container.style.top = y + 'px';
        container.style.bottom = 'auto';
        container.style.right = 'auto';

        if (model) {
            const velX = clientX - lastX;
            model.rotation.z = -velX * 0.03; 
            model.rotation.x = (clientY - lastY) * 0.03;
        }
        lastX = clientX;
        lastY = clientY;
    };

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), top 0.3s ease, left 0.3s ease';
        if (model) {
            model.scale.set(1.3, 1.3, 1.3);
            model.rotation.y = 0;
        }
        localStorage.setItem('matcha_pet_pos', JSON.stringify({
            x: container.offsetLeft,
            y: container.offsetTop
        }));
    };

    // Responsive Support
    window.addEventListener('resize', () => {
        const newWidth = canvasContainer.clientWidth;
        const newHeight = canvasContainer.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });

    // Events...
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
