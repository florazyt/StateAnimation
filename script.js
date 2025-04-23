var noise = new SimplexNoise();

var vizInit = function() {
  var startButton = document.getElementById("startMic");
  
  startButton.onclick = function() {
    startButton.style.display = 'none';
    startMicrophone();
  };

  function startMicrophone() {
    var context = new AudioContext();
    console.log('Initial AudioContext state:', context.state);
    if (context.state === 'suspended') {
      context.resume().then(() => {
        console.log('AudioContext resumed successfully');
      }).catch(err => {
        console.error('Failed to resume AudioContext:', err);
      });
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        console.log('Microphone stream acquired');
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
        renderer.setClearColor(0x000000, 1);

        console.log('EffectComposer available:', !!THREE.EffectComposer);
        console.log('RenderPass available:', !!THREE.RenderPass);
        console.log('UnrealBloomPass available:', !!THREE.UnrealBloomPass);
        var composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        var bloomPass = new THREE.UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          1.5, // strength
          0.4, // radius
          0.85 // threshold
        );
        composer.addPass(bloomPass);

        var icosahedronGeometry = new THREE.IcosahedronGeometry(10, 4);
        var material = new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: 0xff00ee,
          emissiveIntensity: 1,
          wireframe: true
        });

        var ball = new THREE.Mesh(icosahedronGeometry, material);
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

        document.getElementById('out').appendChild(renderer.domElement);

        window.addEventListener('resize', onWindowResize, false);

        render();

        function render() {
          analyser.getByteFrequencyData(dataArray);
          console.log('Frequency Data Sample:', dataArray.slice(0, 10));

          var lowerHalfArray = dataArray.slice(0, (dataArray.length / 2) - 1);
          var upperHalfArray = dataArray.slice((dataArray.length / 2) - 1, dataArray.length - 1);

          var lowerMax = max(lowerHalfArray);
          var lowerAvg = avg(lowerHalfArray);
          var upperAvg = avg(upperHalfArray);

          var lowerMaxFr = lowerMax / lowerHalfArray.length;
          var upperAvgFr = upperAvg / upperHalfArray.length;

          makeRoughBall(ball, modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8), modulate(upperAvgFr, 0, 1, 0, 4));

          group.rotation.y += 0.005;
          composer.render();
          requestAnimationFrame(render);
        }

        function onWindowResize() {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
          composer.setSize(window.innerWidth, window.innerHeight);
        }

        function makeRoughBall(mesh, bassFr, treFr) {
          var positionAttribute = mesh.geometry.attributes.position;
          for (let i = 0; i < positionAttribute.count; i++) {
            var vertex = new THREE.Vector3();
            vertex.fromBufferAttribute(positionAttribute, i);
            vertex.normalize();
            var offset = mesh.geometry.parameters.radius;
            var amp = 7;
            var time = window.performance.now();
            var rf = 0.00001;
            var distance = (offset + bassFr) + noise.noise3D(vertex.x + time * rf * 7, vertex.y + time * rf * 8, vertex.z + time * rf * 9) * amp * treFr;
            vertex.multiplyScalar(distance);
            positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
          }
          positionAttribute.needsUpdate = true;
          mesh.geometry.computeVertexNormals();
        }
      })
      .catch(function(err) {
        console.error('Microphone access failed: ', err);
        alert('Failed to access microphone: ' + err.message);
      });
  }
};

window.onload = vizInit();

function fractionate(val, minVal, maxVal) {
  return (val - minVal) / (maxVal - minVal);
}

function modulate(val, minVal, maxVal, outMin, outMax) {
  var fr = fractionate(val, minVal, maxVal);
  var delta = outMax - outMin;
  return outMin + (fr * delta);
}

function avg(arr) {
  var total = arr.reduce(function(sum, b) { return sum + b; });
  return (total / arr.length);
}

function max(arr) {
  return arr.reduce(function(a, b) { return Math.max(a, b); });
}
