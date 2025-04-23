let listening = false;
let smoothedBass = 0;
let smoothedTreble = 0;

var noise = new SimplexNoise();

var vizInit = function () {
  const startButton = document.getElementById("startMic");
  const toggleButton = document.getElementById("toggleListening");

  // 设置 toggle 按钮行为
  toggleButton.onclick = function () {
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

      const icosahedronGeometry = new THREE.IcosahedronGeometry(10, 4);
      const lambertMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: true });
      const ball = new THREE.Mesh(icosahedronGeometry, lambertMaterial);
      ball.position.set(0, 0, 0);
      group.add(ball);

      const ambientLight = new THREE.AmbientLight(0xaaaaaa);
      scene.add(ambientLight);
      const spotLight = new THREE.SpotLight(0xffffff);
      spotLight.intensity = 0.9;
      spotLight.position.set(-10, 40, 20);
      spotLight.lookAt(ball);
      spotLight.castShadow = true;
      scene.add(spotLight);
      scene.add(group);

      window.addEventListener('resize', onWindowResize, false);
      render();

      function render() {
        analyser.getByteFrequencyData(dataArray);
        const lowerHalfArray = dataArray.slice(0, (dataArray.length / 2) - 1);
        const upperHalfArray = dataArray.slice((dataArray.length / 2) - 1, dataArray.length - 1);
        const lowerMax = max(lowerHalfArray);
        const upperAvg = avg(upperHalfArray);
        const lowerMaxFr = lowerMax / lowerHalfArray.length;
        const upperAvgFr = upperAvg / upperHalfArray.length;

        if (listening) {
          smoothedBass = smoothedBass * 0.9 + modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8) * 0.1;
          smoothedTreble = smoothedTreble * 0.9 + modulate(upperAvgFr, 0, 1, 0, 4) * 0.1;
        } else {
          const targetBass = listening ? modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8) : 0;
          const targetTreble = listening ? modulate(upperAvgFr, 0, 1, 0, 4) : 0;

          smoothedBass = smoothedBass * 0.9 + targetBass * 0.1;
          smoothedTreble = smoothedTreble * 0.9 + targetTreble * 0.1;

        }

        makeRoughBall(ball, smoothedBass, smoothedTreble);
        group.rotation.y += 0.005;
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      }

      function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }

      function makeRoughBall(mesh, bassFr, treFr) {
        mesh.geometry.vertices.forEach(function (vertex) {
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
    }).catch(function (err) {
      console.error("Microphone error:", err);
      alert("⚠️ 无法访问麦克风，请确认权限是否开启，并检查设备设置。");
    });
  }
};

window.onload = vizInit;

function fractionate(val, minVal, maxVal) {
  return (val - minVal) / (maxVal - minVal);
}
function modulate(val, minVal, maxVal, outMin, outMax) {
  var fr = fractionate(val, minVal, maxVal);
  var delta = outMax - outMin;
  return outMin + (fr * delta);
}
function avg(arr) {
  var total = arr.reduce(function (sum, b) { return sum + b; });
  return (total / arr.length);
}
function max(arr) {
  return arr.reduce(function (a, b) { return Math.max(a, b); });
}
