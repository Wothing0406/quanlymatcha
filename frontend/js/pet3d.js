let scene, camera, renderer, model;
let speechBubble, container;
let bubbleTimeout;
let isDragging = false;
let startX, startY;
let lastX, lastY;

const roasts = [
    "Nhìn cái gì? Đi làm kiếm tiền đi!",
    "Ví còn đéo tiền mà rảnh rỗi lôi kéo tao à?",
    "Học bài chưa mà ngồi đây nghịch?",
    "Tao đang theo dõi mọi khoản chi của mày đấy nhé!",
    "Bắt quả tang thằng lười biếng!",
    "Click nữa tao trừ điểm kỷ luật bây giờ!",
    "Bỏ tao ra! Tao không phải đồ chơi của mày!",
    "Tao đang bận... thở, đừng làm phiền!",
    "Mẹ mày Péo!",
    "Người Tày
];

function initPet3D() {
    const canvasContainer = document.getElementById('matcha-pet-canvas-container');
    container = document.getElementById('pet-companion-container');
    speechBubble = document.getElementById('pet-speech-bubble');

    if (!canvasContainer || !container) {
        console.warn("Matcha Pet elements not found. Retrying in 500ms...");
        setTimeout(initPet3D, 500);
        return;
    }

    // Load saved position
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
    
    const width = canvasContainer.clientWidth || 220;
    const height = canvasContainer.clientHeight || 220;
    camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5); 

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(renderer.domElement);

    // 4. Balanced Lighting (No Chói Sáng)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5)); 
    
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4); 
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // 5. Load Model
    const loader = new THREE.GLTFLoader();
    loader.load('/model3d/matcha.glb', (gltf) => {
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        model.scale.set(0, 0, 0); 
        model.rotation.set(0, 0, 0); 
        scene.add(model);
        
        let scaleVal = 0;
        const popIn = setInterval(() => {
            scaleVal += 0.12;
            if (scaleVal >= 1.8) {
                model.scale.set(1.8, 1.8, 1.8);
                clearInterval(popIn);
            } else {
                model.scale.set(scaleVal, scaleVal, scaleVal);
            }
        }, 30);
    }, undefined, (error) => {
        console.error("Error loading 3D model:", error);
    });

    // 6. Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        if (model) {
            const time = Date.now();
            
            if (!isDragging) {
                // Hopping Idle
                model.position.y = Math.abs(Math.sin(time * 0.003)) * 0.12; 
                
                // Breathing pulse
                const pulse = 1 + Math.sin(time * 0.002) * 0.02;
                if (model.scale.x > 1.5) { 
                    model.scale.set(1.8 * pulse, 1.8 * pulse, 1.8 * pulse);
                }
                
                model.rotation.y = 0; // Look forward
                model.rotation.z *= 0.85; 
                model.rotation.x *= 0.85;
            }
        }
        renderer.render(scene, camera);
    }
    animate();

    // 7. Dragging Logic (Desktop + Mobile)
    const startDrag = (clientX, clientY) => {
        isDragging = true;
        startX = clientX - container.offsetLeft;
        startY = clientY - container.offsetTop;
        lastX = clientX;
        lastY = clientY;
        container.style.transition = 'none';
        container.style.cursor = 'grabbing';
    };

    const moveDrag = (e) => {
        if (!isDragging) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

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
            model.rotation.z = -(clientX - lastX) * 0.08;
            model.rotation.x = (clientY - lastY) * 0.08;
        }
        lastX = clientX;
        lastY = clientY;

        // Prevent scrolling while dragging on mobile
        if (e.cancelable) e.preventDefault();
    };

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), top 0.3s ease, left 0.3s ease';
        container.style.cursor = 'grab';
        
        localStorage.setItem('matcha_pet_pos', JSON.stringify({
            x: container.offsetLeft,
            y: container.offsetTop
        }));
    };

    // Robust Event Binding
    container.addEventListener('mousedown', (e) => {
        if (e.target.closest('#pet-speech-bubble')) return;
        startDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', moveDrag, { passive: false });
    window.addEventListener('mouseup', endDrag);

    container.addEventListener('touchstart', (e) => {
        if (e.target.closest('#pet-speech-bubble')) return;
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchmove', moveDrag, { passive: false });
    window.addEventListener('touchend', endDrag);

    container.addEventListener('click', () => {
        if (!isDragging) showRoast();
    });
}

function showRoast() {
    if (!speechBubble) return;
    clearTimeout(bubbleTimeout);
    speechBubble.innerText = roasts[Math.floor(Math.random() * roasts.length)];
    speechBubble.classList.add('active');
    bubbleTimeout = setTimeout(() => speechBubble.classList.remove('active'), 3000);
}

// Ensure execution after Load
if (document.readyState === 'complete') {
    initPet3D();
} else {
    window.addEventListener('load', initPet3D);
}
