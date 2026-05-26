// Map a video URL (/videos/foo.mp4) to its poster thumbnail
// (/videos/posters/foo.jpg). Posters are first-frame stills generated with
// ffmpeg (see public/videos/posters/) so every clip shows a thumbnail until
// the video itself has loaded — important on iOS / in-app webviews where a
// not-yet-decoded <video> otherwise renders black.
export function posterFor(videoSrc: string): string {
  return videoSrc
    .replace("/videos/", "/videos/posters/")
    .replace(/\.mp4$/, ".jpg");
}
