import { runCanvasWatch } from './canvasWatch';

const deadline = setTimeout(() => {
  console.error('Canvas watch failed: overall execution timeout');
  process.exit(1);
}, 180_000);
deadline.unref();

runCanvasWatch()
  .then(code => { process.exitCode = code; })
  .catch(async error => {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('Canvas watch failed: ' + message);
    process.exitCode = 1;
  });
