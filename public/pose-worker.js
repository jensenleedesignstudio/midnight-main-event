/* A classic worker is intentional: MediaPipe 0.10.32 loads WASM with importScripts. */
let pose = null;
self.onmessage = async ({ data }) => {
  const { type, bitmap, timestamp } = data;
  try {
    if (type === 'init') {
      // MediaPipe 0.10.32 ships its classic-compatible browser bundle as CJS.
      // Providing `exports` lets importScripts expose the API in this worker.
      self.exports = {};
      importScripts('/mediapipe/vision_bundle.js');
      const mediaPipe = self.exports;
      const fileset = await mediaPipe.FilesetResolver.forVisionTasks('/mediapipe/wasm');
      pose = await mediaPipe.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      self.postMessage({ type: 'ready' });
    } else if (type === 'frame' && pose) {
      const result = pose.detectForVideo(bitmap, timestamp);
      self.postMessage({ type: 'pose', landmarks: result.landmarks[0] || [], worldLandmarks: result.worldLandmarks[0] || [], timestamp });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Pose tracking failed' });
  } finally {
    bitmap?.close();
  }
};
