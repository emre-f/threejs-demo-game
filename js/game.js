window.focus(); // Capture keys right away

let camera, scene, renderer; // ThreeJS globals
let world;
const originalBoxSize = 3;

let stack = [];
let overhangs = [];
const boxHeight = 1; // Height of each layer

init();

function init() {

    // Init cannon JS
    world = new CANNON.World();
    world.gravity.set(0, -10, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;

    // 0) Scene
    scene = new THREE.Scene();

    // Foundation
    addLayer(0, 0, originalBoxSize, originalBoxSize);

    // First layer
    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

    // 1) Set up lights

    // 1.0) Ambient light (every direction)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 1.1) Directional light (also has a position)
    // directional light shines to everything with the same angle from very far away
    // set the position to be above, highest value is y-axis aka top of boxes will shine the most
    // x-axis is 10, therefore right side of the boxes will get a bit of light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 0);
    scene.add(directionalLight);

    // 2) Camera
    // perspective vs orthographic cameras
    // perspective is more common in video games (further away objects are smaller)
    // orthographic projection: things have same size no matter how far they are
    // (geometries are not distorted), gives more minimalistic geometry look

    // ortographic: projecting towards a plane, perspective: projecting towards a surface
    const width = 10;
    const height = width * (window.innerHeight / window.innerWidth);

    camera = new THREE.OrthographicCamera(
        width / -2, // left
        width / -2, // right
        height / 2, // top
        height / -2, // bottom
        1, // near plane
        100 // far plane
    );

    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    // 3) Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);

    // Add it to HTML
    document.body.appendChild(renderer.domElement);
}

function addLayer(x, z, width, depth, direction) {
    const y = boxHeight * stack.length; // Add it one layer higher

    const layer = generateBox(x, y, z, width, depth, false);
    layer.direction = direction;
    stack.push(layer);
}

function addOverhang(x, z, width, depth) {
    const y = boxHeight * (stack.length - 1); // Add new box to the same layer
    const overhang = generateBox(x, y, z, width, depth, true);
    overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls) {
    // Add a cube to the scene
    const geometry = new THREE.BoxGeometry(3, 1, 3);

    // MeshLambert is the simplest material that takes light into consideration
    const color = new THREE.Color(`hsl(${30 + stack.length * 4}, 100%, 50%)`);
    const material = new THREE.MeshLambertMaterial({ color }); 
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    // CannonJS
    const shape = new CANNON.Box(
        new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
    );
    let mass = falls ? 5 : 0;
    const body = new CANNON.Body( { mass, shape } );
    body.position.set(x, y, z);
    world.addBody(body);

    return {
        threejs: mesh,
        cannonjs: body,
        width,
        depth,
    };
}

// Game logic
let gameStarted = false;

window.addEventListener("click", () => {
    if (!gameStarted) {
        renderer.setAnimationLoop(animation);
        gameStarted = true;
    } else {

        // Get the top 2 boxes to compare
        const topLayer = stack[stack.length - 1];
        const previousLayer = stack[stack.length - 2];

        const direction = topLayer.direction;

        // calculating the remaining box (rest will fall)
        const delta = 
            topLayer.threejs.position[direction] - 
            previousLayer.threejs.position[direction];

        const overhangSize = Math.abs(delta); // abs cuz both can be (+) or (-), if we stop too early or too late
        const size = direction == "x" ? topLayer.width : topLayer.depth;
        const overlap = size - overhangSize;

        // Next layer
        
        if (overlap > 0) {
            // Cut layer
            const newWidth = direction === "x" ? overlap : topLayer.width;
            const newDepth = direction === "z" ? overlap : topLayer.depth;

            // Update metadata
            topLayer.width = newWidth;
            topLayer.depth = newDepth;

            // Update threejs model
            topLayer.threejs.scale[direction] = overlap / size;
            topLayer.threejs.position[direction] -= delta / 2;

            // Overhang
            const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta); //multiply with +1/-1 depending on the sign of delta
            const overhangX = 
                direction === "x" 
                    ? topLayer.threejs.position.x + overhangShift
                    : topLayer.threejs.position.x;
            const overhangZ = 
                direction === "z" 
                    ? topLayer.threejs.position.z + overhangShift
                    : topLayer.threejs.position.z;

            const overhangWidth = direction === "x" ? overhangSize : newWidth;
            const overhangDepth = direction === "z" ? overhangSize : newDepth;

            addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

            // Next layer
            const nextX = direction === "x" ? topLayer.threejs.position.x : - 10;
            const nextZ = direction === "z" ? topLayer.threejs.position.z : - 10;
    
            const nextDirection = direction === "x" ? "z" : "x";

            addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
        } else {
            // end game, no overlap
        }
    }
});

function animation() {
    const speed = 0.15;

    const topLayer = stack[stack.length - 1];
    topLayer.threjs.position[topLayer.direction] += speed;
    topLayer.cannonjs.position[topLayer.direction] += speed; // CannonJS

    // 4 is the initial camera height
    if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
        camera.position.y += speed;
    }

    updatePhysics();
    renderer.render(scene,camera);
}

function cutBox(topLayer, overlap, size, delta) {
    const direction = topLayer.direction;
    const newWidth = direction == "x" ? overlap : topLayer.width;
    const newDepth = direction == "z" ? overlap : topLayer.depth;
  
    // Update metadata
    topLayer.width = newWidth;
    topLayer.depth = newDepth;
  
    // Update ThreeJS model
    topLayer.threejs.scale[direction] = overlap / size;
    topLayer.threejs.position[direction] -= delta / 2;
  
    // Update CannonJS model
    topLayer.cannonjs.position[direction] -= delta / 2;
  
    // Replace shape to a smaller one (in CannonJS you can't simply just scale a shape)
    const shape = new CANNON.Box(
      new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
    );
    topLayer.cannonjs.shapes = [];
    topLayer.cannonjs.addShape(shape);
}

function updatePhysics(timePassed) {
    world.step(timePassed / 1000); // Step the physics world

    // Copy coordinates from Cannon.js to Three.js
    overhangs.forEach((element) => {
        element.threejs.position.copy(element.cannonjs.position);
        element.threejs.quaternion.copy(element.cannonjs.quaternion);
    });
}

window.addEventListener("resize", () => {
    // Adjust camera
    console.log("resize", window.innerWidth, window.innerHeight);
    const aspect = window.innerWidth / window.innerHeight;
    const width = 10;
    const height = width / aspect;

    camera.top = height / 2;
    camera.bottom = height / -2;

    // Reset renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
});

