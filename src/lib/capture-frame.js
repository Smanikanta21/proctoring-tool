export async function captureFrame(video, type) {
  if (!video?.srcObject || video.readyState < 2 || !video.videoWidth) {
    throw new Error('The video is not ready. Enable the feed and try again.');
  }
  const canvas = document.createElement('canvas');
  const maximumWidth = type === 'image/jpeg' ? 960 : 1600;
  const scale = Math.min(1, maximumWidth / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.8));
  if (!blob) throw new Error('Could not capture a video frame.');
  return new Uint8Array(await blob.arrayBuffer());
}
