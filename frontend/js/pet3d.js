let scene, camera, renderer, model;
let speechBubble = document.getElementById('pet-speech-bubble');
let bubbleTimeout;
let isDragging = false;
let startX, startY;
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

    // Load saved position
    const savedPos = JSON.parse(localStorage.getItem('matcha_pet_pos'));
    if (savedPos) {
        container.style.left = savedPos.x + 'px';
        container.style.top = savedPos.y + 'px';
        container.style.bottom = 'auto';
        container.style.right = 'auto';
    }

    // 1. Scene Setup
    scene = new THREE.Scene();
    
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5;

    // 3. Renderer Setup (Transparent)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(renderer.domElement);

    // 4. Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // 5. Load Model
    const loader = new THREE.GLTFLoader();
    loader.load('/model3d/matcha.glb', (gltf) => {
        model = gltf.scene;
        // Center and Scale Up
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        // Increase Scale (Size 20 - significantly bigger)
        model.scale.set(2.5, 2.5, 2.5); 
        scene.add(model);
    });

    // 6. Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        if (model && !isDragging) {
            model.position.y = Math.sin(Date.now() * 0.002) * 0.2;
            model.rotation.y += 0.01;
        }
        renderer.render(scene, camera);
    }
    animate();

    // 7. Drag & Drop Logic
    container.onmousedown = (e) => {
        if (e.target.closest('#pet-speech-bubble')) return;
        isDragging = true;
        startX = e.clientX - container.offsetLeft;
        startY = e.clientY - container.offsetTop;
        container.style.transition = 'none';
        
        // Jump animation on grab
        if (model) model.scale.set(3, 3, 3);
    };

    document.onmousemove = (e) => {
        if (!isDragging) return;
        const x = e.clientX - startX;
        const y = e.clientY - startY;
        container.style.left = x + 'px';
        container.style.top = y + 'px';
        container.style.bottom = 'auto';
        container.style.right = 'auto';
    };

    document.onmouseup = () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        if (model) model.scale.set(2.5, 2.5, 2.5);
        
        // Save position
        localStorage.setItem('matcha_pet_pos', JSON.stringify({
            x: container.offsetLeft,
            y: container.offsetTop
        }));
    };

    // Click to Roast
    container.onclick = (e) => {
        if (Math.abs(e.clientX - (startX + container.offsetLeft)) > 5) return; // Prevent roast on drag
        showRoast();
    };
}

function showRoast() {
    if (!speechBubble) return;
    clearTimeout(bubbleTimeout);
    speechBubble.innerText = roasts[Math.floor(Math.random() * roasts.length)];
    speechBubble.classList.add('active');
    bubbleTimeout = setTimeout(() => speechBubble.classList.remove('active'), 3000);
}

window.addEventListener('load', initPet3D);
