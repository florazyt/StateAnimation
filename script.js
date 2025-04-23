var noise = new SimplexNoise();
var vizInit = function () {
  var startButton = document.getElementById("startMic");
  startButton.onclick = function () {
    startButton.style.display = 'none';
    startMicrophone();
  };

  function startMicrophone() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var context = new AudioContext();
      var src = context.createMediaStreamSource(stream);
      var analyser = context.createAnalyser();
      src.connect(analyser);
      analyser.fftSize = 512;
      var bufferLength = analyser.frequencyBinCount;
      var dataArray = new Uint8Array(bufferLength);

      var scene = new THREE.Scene();
      var group = new THREE.Group();
      var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 0, 100);
      camera.lookAt(scene.position);
      scene.add(camera);

      var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.getElementById('out').appendChild(renderer.domElement);

      var icosahedronGeometry = new THREE.IcosahedronGeometry(10, 4);
      var lambertMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: true });
      var ball = new THREE.Mesh(icosahedronGeometry, lambertMaterial);
      ball.position.set(0, 0, 0);
      group.add(ball);

      var ambientLight = new THREE.AmbientLight(0xaaaaaa);
      scene.add(ambientLight);
      var spotLight = new THREE.SpotLight(0xffffff);
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
        var lowerHalfArray = dataArray.slice(0, (dataArray.length / 2) - 1);
        var upperHalfArray = dataArray.slice((dataArray.length / 2) - 1, dataArray.length - 1);
        var lowerMax = max(lowerHalfArray);
        var lowerAvg = avg(lowerHalfArray);
        var upperMax = max(upperHalfArray);
        var upperAvg = avg(upperHalfArray);
        var lowerMaxFr = lowerMax / lowerHalfArray.length;
        var upperAvgFr = upperAvg / upperHalfArray.length;

        makeRoughBall(ball, modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8), modulate(upperAvgFr, 0, 1, 0, 4));

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
          var offset = mesh.geometry.parameters.radius;
          var amp = 7;
          var time = window.performance.now();
          vertex.normalize();
          var rf = 0.00001;
          var distance = (offset + bassFr) + noise.noise3D(vertex.x + time * rf * 7, vertex.y + time * rf * 8, vertex.z + time * rf * 9) * amp * treFr;
          vertex.multiplyScalar(distance);
        });
        mesh.geometry.verticesNeedUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeFaceNormals();
      }

      function makeRoughGround(mesh, distortionFr) {
        mesh.geometry.vertices.forEach(function (vertex) {
          var amp = 2;
          var time = Date.now();
          var distance = (noise.noise2D(vertex.x + time * 0.0003, vertex.y + time * 0.0001)) * distortionFr * amp;
          vertex.z = distance;
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