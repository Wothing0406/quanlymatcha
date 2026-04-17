/**
 * Matcha Pet 3D Interaction Logic (Three.js)
 */

let scene, camera, renderer, model;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let speechBubble = document.getElementById('pet-speech-bubble');
let bubbleTimeout;

const roasts = [
    "Nhìn gì? Đi làm kiếm tiền đi!",
    "Ví còn đéo tiền mà rảnh rỗi click tao à?",
    "Học bài chưa mà ngồi đây nghịch?",
    "Tao đang theo dõi mọi khoản chi của mày đấy nhé!",
    "Bớt tiêu hoang lại không tao vả cho đấy.",
    "Mày định bao giờ mới giàu?",
    "Gắt cái gì mà gắt? Tao đang dạy mày kỷ luật!",
    "Click nữa tao trừ điểm kỷ luật bây giờ!",
    "Đừng có mà lười biếng trước mặt tao."
];

function initPet3D() {
    const container = document.getElementById('matcha-pet-canvas-container');
    if (!container) return;

    // 1. Scene Setup
    scene = new THREE.Scene();
    
    // 2. Camera Setup
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 3;

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 5. Load Model
    const loader = new THREE.GLTFLoader();
    loader.load(
        '/model3d/matcha.glb',
        (gltf) => {
            model = gltf.scene;
            
            // Center model and scale
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3()).length();
            const center = box.getCenter(new THREE.Vector3());
            
            model.position.x += (model.position.x - center.x);
            model.position.y += (model.position.y - center.y);
            model.position.z += (model.position.z - center.z);
            
            const scale = 1.8 / size;
            model.scale.set(scale, scale, scale);
            
            scene.add(model);
            
            // Add click listener
            container.addEventListener('click', onPetClick);
            console.log("Matcha 3D Model Loaded Successfully");
        },
        undefined,
        (error) => {
            console.error('Lỗi tải model:', error);
            container.innerHTML = '<div class="text-2xl">🍵</div>'; // Fallback
        }
    );

    // 6. Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        
        if (model) {
            // Floating effect
            model.position.y = Math.sin(Date.now() * 0.002) * 0.1;
            // Auto-rotate
            model.rotation.y += 0.005;
        }
        
        renderer.render(scene, camera);
    }
    animate();

    // Responsive
    window.addEventListener('resize', () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });
}

function onPetClick(event) {
    if (!model) return;

    // Jump effect
    const originalScale = model.scale.x;
    model.scale.set(originalScale * 1.2, originalScale * 1.2, originalScale * 1.2);
    setTimeout(() => {
        model.scale.set(originalScale, originalScale, originalScale);
    }, 150);

    // Show Speech Bubble
    showRoast();
}

function showRoast() {
    if (!speechBubble) return;
    
    clearTimeout(bubbleTimeout);
    const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
    speechBubble.innerText = randomRoast;
    speechBubble.classList.add('active');
    
    bubbleTimeout = setTimeout(() => {
        speechBubble.classList.remove('active');
    }, 3000);
}

// Global start
window.addEventListener('load', initPet3D);
