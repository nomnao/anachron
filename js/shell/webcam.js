// Using the webcam, for Camera and Video Recorder.
// Both show the same mirrored, chunky-pixel picture, the same
// size as a Paint picture.

export const FRAME_WIDTH = 360;
export const FRAME_HEIGHT = 220;

// Asks the browser for the webcam. With withSound, it asks for the
// microphone too, but still records without sound if there is no
// microphone or it isn't allowed.
// Throws the browser's error if the webcam can't be used.
export async function openWebcam({ withSound = false } = {}) {
  // Browsers only allow the camera on https:// pages and on localhost
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error('No camera support');
    error.name = 'NotSupportedError';
    throw error;
  }

  const video = { width: { ideal: 640 }, height: { ideal: 480 } };
  if (!withSound) {
    return navigator.mediaDevices.getUserMedia({ video, audio: false });
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: true });
  } catch {
    return navigator.mediaDevices.getUserMedia({ video, audio: false });
  }
}

// Turns the browser's error into words people can act on
export function explainWebcamError(error) {
  if (error.name === 'NotSupportedError') {
    return 'This browser cannot use a camera here.';
  }
  if (error.name === 'NotAllowedError') {
    return 'Camera access was blocked. Allow it in your browser, then press Try Again.';
  }
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
    return 'No camera was found. Connect one, then press Try Again.';
  }
  if (error.name === 'NotReadableError') {
    return 'The camera is being used by another program.';
  }
  return 'The camera could not be started.';
}

// Draws the middle of the webcam picture, cut to the frame's shape,
// and mirrored so moving left moves left, like a mirror
export function drawMirroredFrame(ctx, video) {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth) return;

  const scale = Math.max(FRAME_WIDTH / videoWidth, FRAME_HEIGHT / videoHeight);
  const cropWidth = FRAME_WIDTH / scale;
  const cropHeight = FRAME_HEIGHT / scale;
  const cropX = (videoWidth - cropWidth) / 2;
  const cropY = (videoHeight - cropHeight) / 2;

  ctx.save();
  ctx.translate(FRAME_WIDTH, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  ctx.restore();
}

// Turns the webcam off (its light goes out)
export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
