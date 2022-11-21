import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMUtils, VRMSchema } from '@pixiv/three-vrm';
import { Camera } from '@mediapipe/camera_utils';
import { FACEMESH_TESSELATION, HAND_CONNECTIONS, Holistic, POSE_CONNECTIONS } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Face, Hand, Pose, Vector, Utils } from 'kalidokit';
import { clamp, lerp } from 'three/src/math/MathUtils';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  @ViewChild('inputCamera', { static: true }) inputCamera: ElementRef;
  @ViewChild('guidecanvas', { static: true }) guidecanvas: ElementRef;

  title = 'vtuber';


  gltf_url = "https://cdn.glitch.com/29e07830-2317-4b15-a044-135e73c7f840%2FAshtra.vrm?v=1630342336981";
  // gltf_url = '../assets/sample12_210407_unity.vrm';

  currentVrm: any;
  oldLookTarget = new THREE.Euler();


  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  scene = new THREE.Scene();
  controls = new OrbitControls(this.camera, this.renderer.domElement);

  loader = new GLTFLoader();
  clock = new THREE.Clock();


  holistic = new Holistic({
    locateFile: file => {
      // return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137/${file}`;
      return `../assets/holistic/${file}`;
    }
  });

  onresults = (results) => {
    this.drawResults(results);
    this.animateVRM(this.currentVrm, results);
  }


  ngOnInit() {
    this.holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
      refineFaceLandmarks: true
    });
    this.holistic.onResults(this.onresults)

    const camera = new Camera(this.inputCamera.nativeElement, {
      onFrame: async () => {
        await this.holistic.send({ image: this.inputCamera.nativeElement });
      }
    });
    camera.start();
    /** three js */
    const container = document.getElementById('vr-container');
    const height = container.clientHeight;
    const width = container.clientWidth;

    this.setupScene();
    this.loadModel();

    this.camera.aspect = width / height;
    this.camera.position.set(0.0, 1.4, 0.7);
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    // this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    this.animate();

    /** end three js */
  }


  /**
   * Three Js functions
   */

  setupScene() {
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(1.0, 1.0, 1.0).normalize();

    this.scene.background = new THREE.Color(0xbfe3dd);
    this.scene.add(light);

    // this.controls.target.set(0, 0.5, 0);
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0.0, 1.4, 0.0);
    this.controls.update();
    this.controls.enablePan = false;
    this.controls.enableRotate = false;
    // this.controls.enableDamping = true;
  }

  loadModel() {
    let loader = new THREE.TextureLoader();
    let texture = loader.load('../assets/test.png');
    texture.minFilter = THREE.NearestFilter;
    var material = new THREE.MeshLambertMaterial({
      map: texture,
      blending: 1,
      transparent: true,
    });
    var geometry = window.innerWidth <= 420 ? new THREE.PlaneGeometry(.15, .15) : new THREE.PlaneGeometry(.40, .40);

    var rightlogomesh = new THREE.Mesh(geometry, material);
    window.innerWidth <= 420 ? rightlogomesh.position.set(0.25, 1.60, -0.2) : rightlogomesh.position.set(0.50, 1.53, -0.2);

    var leftlogomesh = new THREE.Mesh(geometry, material);
    window.innerWidth <= 420 ? leftlogomesh.position.set(-0.25, 1.60, -0.2) : leftlogomesh.position.set(-0.50, 1.53, -0.2);


    // this.scene.add(rightlogomesh);
    // this.scene.add(leftlogomesh);

    // const dragcontrols = new DragControls([group, anothermesh], this.camera, this.renderer.domElement);

    // dragcontrols.addEventListener('drag', (event) => {
    //   console.log(anothermesh.position)
    // })

    // var light = new THREE.PointLight(0xffffff, 1, 0);
    // light.position.set(1, 1, 100);
    // this.scene.add(light);

    this.loader.crossOrigin = "anonymous";
    this.loader.load(this.gltf_url, (gltf) => {
      VRMUtils.removeUnnecessaryJoints(gltf.scene);

      VRM.from(gltf).then(vrm => {
        this.scene.add(vrm.scene);
        this.currentVrm = vrm;
        this.currentVrm.scene.rotation.y = Math.PI; // Rotate model 180deg to face camera
      })
      this.scene.add(gltf.scene);
    });
  }

  animate() {
    let comp = this;
    (function render() {
      // const clock = new THREE.Clock();

      requestAnimationFrame(render);
      if (comp.currentVrm) {
        // console.log(clock.getDelta())
        comp.currentVrm.update(comp.clock.getDelta())
      }
      comp.controls.update();
      comp.renderer.render(comp.scene, comp.camera);
    }())
  }

  /**
   * end 
   */

  drawResults(results) {
    let canvas = <HTMLCanvasElement>document.querySelector('#guidecanvas');
    canvas.width = this.inputCamera.nativeElement.videoWidth;
    canvas.height = this.inputCamera.nativeElement.videoHeight;

    let canvasCtx = canvas.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00cff7', lineWidth: 2 }); //skyblue
    drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 }); //face gray
    drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#ff0364', lineWidth: 2 }) //medyo red

    if (results.faceLandmarks && results.faceLandmarks.length === 478)
      drawLandmarks(canvasCtx, [results.faceLandmarks[468], results.faceLandmarks[468 + 5]], { color: "#ffe603", lineWidth: 2 }); //medyo yellow (draw pupils)

    drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: "#eb1064", lineWidth: 3 }); // medyo red (left hand lines )
    drawLandmarks(canvasCtx, results.leftHandLandmarks, { color: "#00cff7", lineWidth: 1 }); // skyblue left hand dots 
    drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: "#22c3e3", lineWidth: 3 }); // skyblue (right hind lines)
    drawLandmarks(canvasCtx, results.rightHandLandmarks, { color: "#ff0364", lineWidth: 1 }); // medyo red (right hand dots)
  }

  animateVRM(vrm, results) {
    if (!vrm) return;

    // Take the results from `Holistic` and animate character based on its Face, Pose, and Hand Keypoints.
    let riggedFace, riggedPose, riggedLeftHand, riggedRightHand;

    const faceLandmarks = results.faceLandmarks;
    const pose3DLandmarks = results.ea; // pose 3D Landmarks are with respect to Hip distance in meters
    const pose2DLandmarks = results.poseLandmarks; // pose 2D Landmarks are with respect to videoWidth and videoHeight
    //careful, hand landmarks may reversed
    const leftHandLandmarks = results.rightHandLandmarks;
    const rightHandLandmarks = results.leftHandLandmarks;

    if (faceLandmarks) {
      riggedFace = Face.solve(faceLandmarks, { runtime: 'mediapipe', video: this.inputCamera.nativeElement });
      this.rigFace(riggedFace);
    }

    if (pose2DLandmarks && pose3DLandmarks) {
      riggedPose = Pose.solve(pose3DLandmarks, pose2DLandmarks, { runtime: 'mediapipe', video: this.inputCamera.nativeElement });
      this.rigRotation("Hips", riggedPose.Hips.rotation, 0.7);
      this.rigPosition(
        "Hips",
        {
          x: -riggedPose.Hips.position.x - .1, // Reverse direction
          y: riggedPose.Hips.position.y + 1, // Add a bit of height
          z: -riggedPose.Hips.position.z // Reverse direction
        }, 1, 0.07);

      this.rigRotation("Chest", riggedPose.Spine, 0.25, .3);
      this.rigRotation("Spine", riggedPose.Spine, 0.45, .3);

      this.rigRotation("RightUpperArm", riggedPose.RightUpperArm, 1, .3);
      this.rigRotation("RightLowerArm", riggedPose.RightLowerArm, 1, .3);
      this.rigRotation("LeftUpperArm", riggedPose.LeftUpperArm, 1, .3);
      this.rigRotation("LeftLowerArm", riggedPose.LeftLowerArm, 1, .3);

      this.rigRotation("LeftUpperLeg", riggedPose.LeftUpperLeg, 1, .3);
      this.rigRotation("LeftLowerLeg", riggedPose.LeftLowerLeg, 1, .3);
      this.rigRotation("RightUpperLeg", riggedPose.RightUpperLeg, 1, .3);
      this.rigRotation("RightLowerLeg", riggedPose.RightLowerLeg, 1, .3);
    }

    // Animate Hands
    if (leftHandLandmarks) {
      riggedLeftHand = Hand.solve(leftHandLandmarks, "Left");
      this.rigRotation("LeftHand", {
        // Combine pose rotation Z and hand rotation X Y
        z: riggedPose.LeftHand.z,
        y: riggedLeftHand.LeftWrist.y,
        x: riggedLeftHand.LeftWrist.x
      });
      this.rigRotation("LeftRingProximal", riggedLeftHand.LeftRingProximal);
      this.rigRotation("LeftRingIntermediate", riggedLeftHand.LeftRingIntermediate);
      this.rigRotation("LeftRingDistal", riggedLeftHand.LeftRingDistal);
      this.rigRotation("LeftIndexProximal", riggedLeftHand.LeftIndexProximal);
      this.rigRotation("LeftIndexIntermediate", riggedLeftHand.LeftIndexIntermediate);
      this.rigRotation("LeftIndexDistal", riggedLeftHand.LeftIndexDistal);
      this.rigRotation("LeftMiddleProximal", riggedLeftHand.LeftMiddleProximal);
      this.rigRotation("LeftMiddleIntermediate", riggedLeftHand.LeftMiddleIntermediate);
      this.rigRotation("LeftMiddleDistal", riggedLeftHand.LeftMiddleDistal);
      this.rigRotation("LeftThumbProximal", riggedLeftHand.LeftThumbProximal);
      this.rigRotation("LeftThumbIntermediate", riggedLeftHand.LeftThumbIntermediate);
      this.rigRotation("LeftThumbDistal", riggedLeftHand.LeftThumbDistal);
      this.rigRotation("LeftLittleProximal", riggedLeftHand.LeftLittleProximal);
      this.rigRotation("LeftLittleIntermediate", riggedLeftHand.LeftLittleIntermediate);
      this.rigRotation("LeftLittleDistal", riggedLeftHand.LeftLittleDistal);
    }
    if (rightHandLandmarks) {
      riggedRightHand = Hand.solve(rightHandLandmarks, "Right");
      this.rigRotation("RightHand", {
        // Combine Z axis from pose hand and X/Y axis from hand wrist rotation
        z: riggedPose.RightHand.z,
        y: riggedRightHand.RightWrist.y,
        x: riggedRightHand.RightWrist.x
      });
      this.rigRotation("RightRingProximal", riggedRightHand.RightRingProximal);
      this.rigRotation("RightRingIntermediate", riggedRightHand.RightRingIntermediate);
      this.rigRotation("RightRingDistal", riggedRightHand.RightRingDistal);
      this.rigRotation("RightIndexProximal", riggedRightHand.RightIndexProximal);
      this.rigRotation("RightIndexIntermediate", riggedRightHand.RightIndexIntermediate);
      this.rigRotation("RightIndexDistal", riggedRightHand.RightIndexDistal);
      this.rigRotation("RightMiddleProximal", riggedRightHand.RightMiddleProximal);
      this.rigRotation("RightMiddleIntermediate", riggedRightHand.RightMiddleIntermediate);
      this.rigRotation("RightMiddleDistal", riggedRightHand.RightMiddleDistal);
      this.rigRotation("RightThumbProximal", riggedRightHand.RightThumbProximal);
      this.rigRotation("RightThumbIntermediate", riggedRightHand.RightThumbIntermediate);
      this.rigRotation("RightThumbDistal", riggedRightHand.RightThumbDistal);
      this.rigRotation("RightLittleProximal", riggedRightHand.RightLittleProximal);
      this.rigRotation("RightLittleIntermediate", riggedRightHand.RightLittleIntermediate);
      this.rigRotation("RightLittleDistal", riggedRightHand.RightLittleDistal);
    }
  }
  rigFace(riggedFace) {
    if (!this.currentVrm) return;
    this.rigRotation("Neck", riggedFace.head, 0.7);
    // console.log(riggedFace)
    const Blendshape = this.currentVrm.blendShapeProxy;
    const PresetName = VRMSchema.BlendShapePresetName;

    //get if the Blinks params if exist
    const BlinkL = Blendshape['_blendShapeGroups']['Blink_L'] ? PresetName.BlinkL : "EyeBlinkLeft";
    const BlinkR = Blendshape['_blendShapeGroups']['Blink_R'] ? PresetName.BlinkR : "EyeBlinkRight";

    // for VRM, 1 is closed, 0 is open.
    // riggedFace.eye.l = Vector.lerp(Utils.clamp(1 - riggedFace.eye.l, 0, 1), Blendshape.getValue(BlinkL), .5)
    // riggedFace.eye.r = Vector.lerp(Utils.clamp(1 - riggedFace.eye.r, 0, 1), Blendshape.getValue(BlinkR), .5)
    riggedFace.eye.l = Vector.lerp(Utils.clamp(1 - riggedFace.eye.l, 0, 1), Blendshape.getValue(BlinkL), .3)
    riggedFace.eye.r = Vector.lerp(Utils.clamp(1 - riggedFace.eye.r, 0, 1), Blendshape.getValue(BlinkR), .3)
    // riggedFace.eye = Face.stabilizeBlink(riggedFace.eye,riggedFace.head)
    // Blendshape.setValue(PresetName.BlinkL, riggedFace.eye.l);
    // Blendshape.setValue(PresetName.BlinkR, riggedFace.eye.r);
    Blendshape.setValue(BlinkL, riggedFace.eye.l);
    Blendshape.setValue(BlinkR, riggedFace.eye.r);

    // Interpolate and set mouth blendshapes
    Blendshape.setValue(PresetName.I, lerp(riggedFace.mouth.shape.I, Blendshape.getValue(PresetName.I), .1));
    Blendshape.setValue(PresetName.A, lerp(riggedFace.mouth.shape.A, Blendshape.getValue(PresetName.A), .1));
    Blendshape.setValue(PresetName.E, lerp(riggedFace.mouth.shape.E, Blendshape.getValue(PresetName.E), .1));
    Blendshape.setValue(PresetName.O, lerp(riggedFace.mouth.shape.O, Blendshape.getValue(PresetName.O), .1));
    Blendshape.setValue(PresetName.U, lerp(riggedFace.mouth.shape.U, Blendshape.getValue(PresetName.U), .1));

    // interpolate pupil and keep a copy of the value
    let lookTarget = new THREE.Euler(
      lerp(this.oldLookTarget.x, riggedFace.pupil.y, .4),
      lerp(this.oldLookTarget.y, riggedFace.pupil.x, .4),
      0, "XYZ");
    this.oldLookTarget.copy(lookTarget)
    this.currentVrm.lookAt.applyer.lookAt(lookTarget);

  }

  // Animate Rotation Helper function
  rigRotation(name, rotation = { x: 0, y: 0, z: 0 }, dampener = 1, lerpAmount = 0.3) {

    if (!this.currentVrm) return;

    const part = this.currentVrm.humanoid.getBoneNode(
      VRMSchema.HumanoidBoneName[name]
    );

    if (!part) return;

    let euler = new THREE.Euler(rotation.x * dampener, rotation.y * dampener, rotation.z * dampener);
    let quaternion = new THREE.Quaternion().setFromEuler(euler);
    part.quaternion.slerp(quaternion, lerpAmount);
  }

  rigPosition(name, position = { x: 0, y: 0, z: 0 }, dampener = 1, lerpAmount = 0.3) {
    if (!this.currentVrm) return;
    const part = this.currentVrm.humanoid.getBoneNode(
      VRMSchema.HumanoidBoneName[name]
    );
    if (!part) return;
    let vector = new THREE.Vector3(position.x * dampener, position.y * dampener, position.z * dampener);
    part.position.lerp(vector, lerpAmount); // interpolate
  }

}
