let listening = false;
let smoothedBass = 0;
let smoothedTreble = 0;
let bloomEnabled = true;

const fresnelMaterial = new THREE.ShaderMaterial({
  uniforms: {
    color1: { value: new THREE.Color(0x00ffff) }, // 青绿色
    color2: { value: new THREE.Color(0x0033ff) }, // 蓝色
    viewVector: { value: new THREE.Vector3() }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 viewVector;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      float fresnel = abs(dot(normalize(vViewPosition), vNormal));
      fresnel = pow(1.0 - fresnel, 2.0);
      vec3 color = mix(color1, color2, fresnel);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  wireframe: true

});


var noise = new SimplexNoise();

var vizInit = function () {
  const startButton = document.getElementById("startMic");
  
  const playButton = document.getElementById("playAudio");
  const audio = document.getElementById("voicePlayer");
  const toggleButton = document.getElementById("toggleListening");
  const bloomToggle = document.getElementById("toggleBloom");
bloomToggle.onclick = function () {
  bloomEnabled = !bloomEnabled;
  bloomToggle.textContent = bloomEnabled ? "Bloom ON" : "Bloom OFF";
};


  let isSpeaking = false;
  let listening = false;
  audio.loop = true;

  playButton.onclick = function () {
    if (listening) {
      listening = false;
      toggleButton.textContent = "Not Listening";
      toggleButton.classList.remove("active");
    }

    if (isSpeaking) {
      audio.pause();
      playButton.classList.remove("active");
      playButton.textContent = "Speaking";
    } else {
      audio.currentTime = 0;
      audio.play();
      playButton.classList.add("active");
      playButton.textContent = "Silence";
    }
    isSpeaking = !isSpeaking;
  };

  toggleButton.onclick = function () {
    if (isSpeaking) {
      audio.pause();
      isSpeaking = false;
      playButton.textContent = "Speaking";
      playButton.classList.remove("active");
    }

    listening = !listening;
    toggleButton.textContent = listening ? "Listening" : "Not Listening";
    toggleButton.classList.toggle("active", listening);
  };




  startButton.onclick = function () {
    startButton.style.display = 'none';
    startMicrophone();
  };

  function startMicrophone() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      const context = new AudioContext();
      const src = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      src.connect(analyser);
      analyser.fftSize = 512;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const scene = new THREE.Scene();
      const group = new THREE.Group();
      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 0, 100);
      camera.lookAt(scene.position);
      scene.add(camera);

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.getElementById('out').appendChild(renderer.domElement);

      const composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));

      const bloomPass = new THREE.BloomPass(1.5, 25, 4.0, 256);
      const bloomSlider = document.getElementById('bloomSlider');
      bloomSlider.addEventListener('input', () => {
        const sliderValue = parseFloat(bloomSlider.value);
        bloomPass.enabled = bloomEnabled;
        bloomPass.copyUniforms.opacity.value = parseFloat(bloomSlider.value);
              });
      composer.addPass(bloomPass);

      const copyPass = new THREE.ShaderPass(THREE.CopyShader);
      copyPass.renderToScreen = true;
      composer.addPass(copyPass);

      const icosahedronGeometry = new THREE.IcosahedronGeometry(10, 4);
      const ball = new THREE.Mesh(icosahedronGeometry, fresnelMaterial);

      group.add(ball);

      // Add planet ring
      
      const ringGeometry = new THREE.TorusGeometry(13, 0.5, 16, 100);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.0 });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      group.add(ring);


      scene.add(new THREE.AmbientLight(0xaaaaaa));
      const spotLight = new THREE.SpotLight(0xffffff, 0.9);
      spotLight.position.set(-10, 40, 20);
      spotLight.lookAt(ball);
      scene.add(spotLight);
      scene.add(group);

      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      function render() {
        analyser.getByteFrequencyData(dataArray);
        const lowerHalfArray = dataArray.slice(0, bufferLength / 2);
        const upperHalfArray = dataArray.slice(bufferLength / 2);
        const lowerMax = max(lowerHalfArray);
        const upperAvg = avg(upperHalfArray);
        const lowerMaxFr = lowerMax / lowerHalfArray.length;
        const upperAvgFr = upperAvg / upperHalfArray.length;

        const targetBass = listening ? modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8) : 0;
        const targetTreble = listening ? modulate(upperAvgFr, 0, 1, 0, 4) : 0;
        smoothedBass = smoothedBass * 0.9 + targetBass * 0.1;
        smoothedTreble = smoothedTreble * 0.9 + targetTreble * 0.1;

        makeRoughBall(ball, smoothedBass, smoothedTreble);
        group.rotation.y += 0.005;
        
        if (isSpeaking) {
          ringMaterial.opacity = Math.min(1, ringMaterial.opacity + 0.05);
          ring.rotation.x += 0.005;
          ring.rotation.y += 0.003;
          ring.rotation.z += 0.002;
        } else {
          ringMaterial.opacity = Math.max(0, ringMaterial.opacity - 0.05);
        }
        bloomPass.enabled = bloomEnabled;
if (bloomEnabled) {
  bloomPass.copyUniforms.opacity.value = parseFloat(bloomSlider.value);
}


        composer.render();
        requestAnimationFrame(render);
      }

      render();

      function makeRoughBall(mesh, bassFr, treFr) {
        mesh.geometry.vertices.forEach(vertex => {
          const offset = mesh.geometry.parameters.radius;
          const amp = 10;
          const time = window.performance.now();
          vertex.normalize();
          const rf = 0.00001;
          const distance = (offset + bassFr) + noise.noise3D(vertex.x + time * rf * 7, vertex.y + time * rf * 8, vertex.z + time * rf * 9) * amp * treFr;
          vertex.multiplyScalar(distance);
        });
        mesh.geometry.verticesNeedUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeFaceNormals();
      }
    });
  }
};

window.onload = vizInit;

function fractionate(val, minVal, maxVal) {
  return (val - minVal) / (maxVal - minVal);
}
function modulate(val, minVal, maxVal, outMin, outMax) {
  const fr = fractionate(val, minVal, maxVal);
  return outMin + (fr * (outMax - outMin));
}
function avg(arr) {
  return arr.reduce((sum, b) => sum + b, 0) / arr.length;
}
function max(arr) {
  return arr.reduce((a, b) => Math.max(a, b));
}